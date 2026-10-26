/**
 * Firebase Cloud Functions (2nd Gen) for Teggram-X Administrative Operations
 * Enforces server-side authentication, custom claims verification, atomic Firestore transactions,
 * financial balance invariants, and immutable audit logs.
 */

import * as admin from 'firebase-admin';
import { CallableRequest, HttpsError, onCall } from 'firebase-functions/v2/https';

// Initialize admin app if not already initialized
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

interface AdminCallContext {
  uid: string;
  email: string;
  isAdmin: boolean;
  isSuperAdmin: boolean;
}

/**
 * Validates whether the caller has verified custom claims.
 * Does NOT rely on client parameters.
 */
function assertAdminAuth(request: CallableRequest): AdminCallContext {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Utilizador não autenticado.');
  }

  const token = request.auth.token;
  const isAdmin = token.admin === true || token.role === 'admin' || token.role === 'superadmin';
  const isSuperAdmin = token.role === 'superadmin';

  if (!isAdmin) {
    throw new HttpsError('permission-denied', 'Acesso negado: Requer privilégios administrativos (custom claims).');
  }

  return {
    uid: request.auth.uid,
    email: token.email || 'admin@teggram.com',
    isAdmin,
    isSuperAdmin,
  };
}

/**
 * 1. APPROVE RECHARGE (paymentbot)
 * Atomically credits user balance, marks payment as 'concluido', creates 'extrato_mcpn' entry,
 * and writes to 'admin_audit_logs'. Idempotent.
 */
export const adminApproveRecharge = onCall({ cors: true }, async (request) => {
  const adminCtx = assertAdminAuth(request);
  const { paymentId, idempotencyKey } = request.data || {};

  if (!paymentId) {
    throw new HttpsError('invalid-argument', 'O ID do pedido de recarga (paymentId) é obrigatório.');
  }

  const paymentRef = db.collection('paymentbot').doc(paymentId);

  return await db.runTransaction(async (transaction) => {
    const paymentDoc = await transaction.get(paymentRef);
    if (!paymentDoc.exists) {
      throw new HttpsError('not-found', `Pedido de recarga #${paymentId} não foi encontrado.`);
    }

    const paymentData = paymentDoc.data()!;
    if (paymentData.status !== 'pendente') {
      throw new HttpsError('failed-precondition', `Pedido #${paymentId} já está com status '${paymentData.status}'.`);
    }

    const valorRaw = paymentData.valor;
    const valor = typeof valorRaw === 'number' ? valorRaw : parseFloat(String(valorRaw));
    if (isNaN(valor) || valor <= 0) {
      throw new HttpsError('invalid-argument', 'Valor de recarga inválido.');
    }

    const userUid = [paymentData.uid, paymentData.user_id, paymentData.usuario_id, paymentData.uid_usuario]
      .find((value): value is string => typeof value === 'string' && value.trim().length > 0);
    if (!userUid) {
      throw new HttpsError('failed-precondition', `Pedido #${paymentId} não tem um utilizador associado.`);
    }

    const userRef = db.collection('users').doc(userUid);
    const userDoc = await transaction.get(userRef);
    if (!userDoc.exists) {
      throw new HttpsError('not-found', `Utilizador proprietário ${userUid} não encontrado.`);
    }

    const userData = userDoc.data()!;
    const saldoRaw = userData.saldo ?? userData.balance;
    const saldoAtual = typeof saldoRaw === 'number' ? saldoRaw : Number(saldoRaw);
    if (!Number.isFinite(saldoAtual) || saldoAtual < 0) {
      throw new HttpsError('failed-precondition', `Saldo atual do utilizador ${userUid} inválido.`);
    }
    const novoSaldo = Math.round((saldoAtual + valor) * 100) / 100;
    const now = admin.firestore.FieldValue.serverTimestamp();
    const isoDate = new Date().toISOString();

    // 1. Update Payment status
    transaction.update(paymentRef, {
      status: 'concluido',
      atualizado_em: isoDate,
      decisao: {
        admin_uid: adminCtx.uid,
        admin_email: adminCtx.email,
        data: isoDate,
        idempotency_key: idempotencyKey || `rec-${paymentId}-${Date.now()}`,
      },
    });

    // 2. Atomic credit to user balance
    transaction.update(userRef, {
      saldo: novoSaldo,
      balance: novoSaldo,
      atualizado_em: isoDate,
    });

    // 3. Extrato financial statement record
    const extratoRef = db.collection('extrato_mcpn').doc(`ext_rec_${paymentId}`);
    transaction.set(extratoRef, {
      uid: userUid,
      tipo: 'recarga',
      valor: valor,
      saldo_anterior: saldoAtual,
      saldo_posterior: novoSaldo,
      descricao: `Recarga aprovada via ${paymentData.metodo || 'Multicaixa'} (#${paymentId})`,
      referencia_id: paymentId,
      status: 'concluido',
      criado_em: isoDate,
      timestamp: now,
    });

    // 4. Immutable Audit Log
    const auditRef = db.collection('admin_audit_logs').doc();
    transaction.set(auditRef, {
      admin_uid: adminCtx.uid,
      admin_email: adminCtx.email,
      acao: 'APROVAR_RECARGA',
      entidade: 'paymentbot',
      entidade_id: paymentId,
      decisao: 'aprovado',
      data: isoDate,
      timestamp: now,
      dados_anteriores: { status: paymentData.status, valor: paymentData.valor },
      dados_novos: { status: 'concluido', valor: valor, novoSaldo: novoSaldo, target_uid: userUid },
    });

    return {
      success: true,
      message: `Recarga de ${valor} KZ aprovada com sucesso para o utilizador ${paymentData.uid}.`,
      novoSaldo,
    };
  });
});

/**
 * 2. REJECT RECHARGE (paymentbot)
 * Marks payment as 'rejeitado' with mandatory reason. Does not alter balances. Preserves proof.
 */
export const adminRejectRecharge = onCall({ cors: true }, async (request) => {
  const adminCtx = assertAdminAuth(request);
  const { paymentId, motivo } = request.data || {};

  if (!paymentId) {
    throw new HttpsError('invalid-argument', 'O ID do pedido de recarga (paymentId) é obrigatório.');
  }
  if (!motivo || motivo.trim().length < 3) {
    throw new HttpsError('invalid-argument', 'O motivo da rejeição é obrigatório (mínimo 3 caracteres).');
  }

  const paymentRef = db.collection('paymentbot').doc(paymentId);

  return await db.runTransaction(async (transaction) => {
    const paymentDoc = await transaction.get(paymentRef);
    if (!paymentDoc.exists) {
      throw new HttpsError('not-found', `Pedido #${paymentId} não encontrado.`);
    }

    const paymentData = paymentDoc.data()!;
    if (paymentData.status !== 'pendente') {
      throw new HttpsError('failed-precondition', `Pedido #${paymentId} já está '${paymentData.status}'.`);
    }

    const isoDate = new Date().toISOString();
    const now = admin.firestore.FieldValue.serverTimestamp();

    transaction.update(paymentRef, {
      status: 'rejeitado',
      atualizado_em: isoDate,
      decisao: {
        admin_uid: adminCtx.uid,
        admin_email: adminCtx.email,
        data: isoDate,
        motivo: motivo.trim(),
      },
    });

    const auditRef = db.collection('admin_audit_logs').doc();
    transaction.set(auditRef, {
      admin_uid: adminCtx.uid,
      admin_email: adminCtx.email,
      acao: 'REJEITAR_RECARGA',
      entidade: 'paymentbot',
      entidade_id: paymentId,
      decisao: 'rejeitado',
      motivo: motivo.trim(),
      data: isoDate,
      timestamp: now,
      dados_anteriores: { status: paymentData.status },
      dados_novos: { status: 'rejeitado', motivo: motivo.trim() },
    });

    return { success: true, message: `Recarga #${paymentId} rejeitada.` };
  });
});

/**
 * 3. PROCESS WITHDRAWAL (retiradas)
 * Handles payment approval (marks 'pago' + increases total_retirado) OR rejection (refunds user saldo).
 */
export const adminProcessWithdrawal = onCall({ cors: true }, async (request) => {
  const adminCtx = assertAdminAuth(request);
  const { retiradaId, acao, motivo, valorPago } = request.data || {};

  if (!retiradaId || !acao || !['pagar', 'rejeitar'].includes(acao)) {
    throw new HttpsError('invalid-argument', 'Parâmetros inválidos: informe retiradaId e acao ("pagar" ou "rejeitar").');
  }
  if (acao === 'rejeitar' && (!motivo || motivo.trim().length < 3)) {
    throw new HttpsError('invalid-argument', 'Rejeição de saque requer motivo detalhado para justificar o estorno.');
  }

  const retiradaRef = db.collection('retiradas').doc(retiradaId);

  return await db.runTransaction(async (transaction) => {
    const retiradaDoc = await transaction.get(retiradaRef);
    if (!retiradaDoc.exists) {
      throw new HttpsError('not-found', `Pedido de retirada #${retiradaId} não encontrado.`);
    }

    const retiradaData = retiradaDoc.data()!;
    if (retiradaData.status !== 'pendente') {
      throw new HttpsError('failed-precondition', `Pedido #${retiradaId} já está com status '${retiradaData.status}'.`);
    }

    const userUid = [retiradaData.uid, retiradaData.user_id, retiradaData.usuario_id, retiradaData.uid_usuario]
      .find((value): value is string => typeof value === 'string' && value.trim().length > 0);
    if (!userUid) {
      throw new HttpsError('failed-precondition', `Pedido #${retiradaId} não tem um utilizador associado.`);
    }

    const amountDebited = Number(retiradaData.valor ?? retiradaData.valor_bruto);
    const amountToPay = Number(retiradaData.valor_liquido ?? retiradaData.valor_bruto ?? retiradaData.valor);
    if (!Number.isFinite(amountDebited) || amountDebited <= 0 || !Number.isFinite(amountToPay) || amountToPay <= 0) {
      throw new HttpsError('failed-precondition', `Os valores do pedido #${retiradaId} são inválidos.`);
    }
    if (
      acao === 'pagar'
      && (typeof valorPago !== 'number'
        || !Number.isFinite(valorPago)
        || Math.round(valorPago * 100) !== Math.round(amountToPay * 100))
    ) {
      throw new HttpsError('failed-precondition', `O valor pago deve ser exatamente ${amountToPay.toFixed(2)} KZ.`);
    }

    const userRef = db.collection('users').doc(userUid);
    const userDoc = await transaction.get(userRef);
    if (!userDoc.exists) {
      throw new HttpsError('not-found', `Utilizador ${userUid} não encontrado.`);
    }

    const userData = userDoc.data()!;
    const isoDate = new Date().toISOString();
    const now = admin.firestore.FieldValue.serverTimestamp();
    const valorBruto = amountDebited;

    if (acao === 'pagar') {
      const totalRetiradoAtual = Number(userData.total_retirado) || 0;
      const novoTotalRetirado = Math.round((totalRetiradoAtual + valorBruto) * 100) / 100;

      transaction.update(retiradaRef, {
        status: 'concluido',
        atualizado_em: isoDate,
        decisao: {
          admin_uid: adminCtx.uid,
          admin_email: adminCtx.email,
          data: isoDate,
          idempotency_key: `payout-${retiradaId}-${Date.now()}`,
        },
      });

      transaction.update(userRef, {
        total_retirado: novoTotalRetirado,
        atualizado_em: isoDate,
      });

      const auditRef = db.collection('admin_audit_logs').doc();
      transaction.set(auditRef, {
        admin_uid: adminCtx.uid,
        admin_email: adminCtx.email,
        acao: 'PAGAR_SAQUE',
        entidade: 'retiradas',
        entidade_id: retiradaId,
        decisao: 'aprovado',
        data: isoDate,
        timestamp: now,
        dados_novos: { status: 'concluido', valor_liquido: amountToPay },
      });

      return { success: true, message: `Saque #${retiradaId} marcado como pago com sucesso.` };
    } else {
      // Rejection: refund the debited amount to user balance
      const saldoAtual = Number(userData.saldo ?? userData.balance);
      if (!Number.isFinite(saldoAtual) || saldoAtual < 0) {
        throw new HttpsError('failed-precondition', `Saldo atual do utilizador ${userUid} inválido.`);
      }
      const novoSaldo = Math.round((saldoAtual + amountDebited) * 100) / 100;

      transaction.update(retiradaRef, {
        status: 'rejeitado',
        atualizado_em: isoDate,
        decisao: {
          admin_uid: adminCtx.uid,
          admin_email: adminCtx.email,
          data: isoDate,
          motivo: motivo.trim(),
        },
      });

      transaction.update(userRef, {
        saldo: novoSaldo,
        balance: novoSaldo,
        atualizado_em: isoDate,
      });

      const extratoRef = db.collection('extrato_mcpn').doc(`ext_reemb_${retiradaId}`);
      transaction.set(extratoRef, {
        uid: userUid,
        tipo: 'reembolso_retirada',
        valor: valorBruto,
        saldo_anterior: saldoAtual,
        saldo_posterior: novoSaldo,
        descricao: `Estorno de saque #${retiradaId}: ${motivo.trim()}`,
        referencia_id: retiradaId,
        status: 'concluido',
        criado_em: isoDate,
        timestamp: now,
      });

      const auditRef = db.collection('admin_audit_logs').doc();
      transaction.set(auditRef, {
        admin_uid: adminCtx.uid,
        admin_email: adminCtx.email,
        acao: 'REJEITAR_SAQUE',
        entidade: 'retiradas',
        entidade_id: retiradaId,
        decisao: 'rejeitado',
        motivo: motivo.trim(),
        data: isoDate,
        timestamp: now,
        dados_novos: { status: 'rejeitado', estorno: valorBruto, novoSaldo },
      });

      return { success: true, message: `Saque #${retiradaId} rejeitado e saldo de ${valorBruto} KZ estornado.` };
    }
  });
});

/**
 * 4. SAVE / UPDATE PRODUCT (produtos)
 */
export const adminSaveProduct = onCall({ cors: true }, async (request) => {
  const adminCtx = assertAdminAuth(request);
  const { produto } = request.data || {};

  if (!produto || !produto.nome) {
    throw new HttpsError('invalid-argument', 'Dados do produto são inválidos.');
  }

  const id = produto.id || `bot_${produto.nome.toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
  const prodRef = db.collection('produtos').doc(id);
  const now = admin.firestore.FieldValue.serverTimestamp();
  const isoDate = new Date().toISOString();

  const doc = await prodRef.get();
  const isUpdate = doc.exists;

  await prodRef.set(
    {
      ...produto,
      id,
      atualizado_em: isoDate,
      criado_em: isUpdate ? doc.data()?.criado_em || isoDate : isoDate,
    },
    { merge: true }
  );

  await db.collection('admin_audit_logs').add({
    admin_uid: adminCtx.uid,
    admin_email: adminCtx.email,
    acao: isUpdate ? 'ATUALIZAR_PRODUTO' : 'CRIAR_PRODUTO',
    entidade: 'produtos',
    entidade_id: id,
    decisao: isUpdate ? 'atualizado' : 'criado',
    data: isoDate,
    timestamp: now,
    dados_novos: produto,
  });

  return { success: true, id, message: `Produto ${produto.nome} salvo com sucesso.` };
});

/**
 * 5. SAVE / UPDATE PAYMENT METHOD (pasta)
 */
export const adminSavePaymentMethod = onCall({ cors: true }, async (request) => {
  const adminCtx = assertAdminAuth(request);
  const { methodId, data } = request.data || {};

  if (!methodId || !data) {
    throw new HttpsError('invalid-argument', 'methodId e dados são obrigatórios.');
  }

  const docRef = db.collection('pasta').doc(methodId);
  const isoDate = new Date().toISOString();

  await docRef.set(
    {
      ...data,
      id: methodId,
      atualizado_em: isoDate,
    },
    { merge: true }
  );

  await db.collection('admin_audit_logs').add({
    admin_uid: adminCtx.uid,
    admin_email: adminCtx.email,
    acao: 'EDITAR_COORDENADAS_PAGAMENTO',
    entidade: 'pasta',
    entidade_id: methodId,
    decisao: 'atualizado',
    data: isoDate,
    timestamp: admin.firestore.FieldValue.serverTimestamp(),
    dados_novos: {
      banco: data.banco,
      titular: data.titular,
      ativo: data.ativo,
      tipo: data.tipo,
    },
  });

  return { success: true, message: `Coordenadas bancárias para ${methodId} atualizadas com sucesso.` };
});

/**
 * 6. ASSIGN CUSTOM CLAIMS (SUPERADMIN ONLY)
 */
export const adminSetUserRole = onCall({ cors: true }, async (request) => {
  const adminCtx = assertAdminAuth(request);
  if (!adminCtx.isSuperAdmin) {
    throw new HttpsError('permission-denied', 'Apenas Super Administradores podem gerir privilégios de acesso.');
  }

  const { targetUid, role } = request.data || {};
  if (!targetUid || !['admin', 'superadmin', 'user'].includes(role)) {
    throw new HttpsError('invalid-argument', 'UID de destino ou perfil inválido.');
  }

  const claims = role === 'user' ? { admin: false, role: 'user' } : { admin: true, role };
  await admin.auth().setCustomUserClaims(targetUid, claims);

  await db.collection('admin_audit_logs').add({
    admin_uid: adminCtx.uid,
    admin_email: adminCtx.email,
    acao: 'ALTERAR_PRIVILEGIO_ADMIN',
    entidade: 'users',
    entidade_id: targetUid,
    decisao: 'atualizado',
    data: new Date().toISOString(),
    timestamp: admin.firestore.FieldValue.serverTimestamp(),
    dados_novos: { targetUid, role, claims },
  });

  return { success: true, message: `Privilégio de ${targetUid} atualizado para ${role}.` };
});
