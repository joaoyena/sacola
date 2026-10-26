import 'dotenv/config';
import path from 'path';
import express, { NextFunction, Request, RequestHandler, Response } from 'express';
import { applicationDefault, cert, getApps, initializeApp } from 'firebase-admin/app';
import { DecodedIdToken, getAuth } from 'firebase-admin/auth';
import { DocumentData, getFirestore } from 'firebase-admin/firestore';
import { createServer as createViteServer } from 'vite';
import {
  AuditLogRecord,
  PaymentBotRecord,
  ProdutoRecord,
  RetiradaRecord,
  TokenClaims,
  UserAccount,
  calculateRechargeApprovalMutation,
  calculateWithdrawalMutation,
  hasAdminAccess,
  hasSuperAdminAccess,
  isValidAdminPassword,
  isValidFirebaseUid,
  isQualifyingInvestorPurchase,
  normalizeRechargeStatus,
  normalizeWithdrawalStatus,
  parseFinancialValue,
  validateProductData,
  validateRechargeTransition,
  validateWithdrawalTransition,
} from './src/lib/adminLogic.ts';

interface AdminIdentity {
  uid: string;
  email: string;
  role: 'admin' | 'superadmin';
}

function isFirebaseAuthError(error: unknown): boolean {
  return typeof error === 'object'
    && error !== null
    && 'code' in error
    && typeof error.code === 'string'
    && error.code.startsWith('auth/');
}

declare global {
  namespace Express {
    interface Request {
      adminUser?: AdminIdentity;
    }
  }
}

class HttpError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
  }
}

const projectId = process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID;
if (!projectId) {
  throw new Error('Defina FIREBASE_PROJECT_ID ou VITE_FIREBASE_PROJECT_ID no ficheiro .env.');
}

function createFirebaseApp() {
  const existingApp = getApps()[0];
  if (existingApp) return existingApp;

  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (serviceAccountJson) {
    let serviceAccount: Record<string, unknown>;
    try {
      serviceAccount = JSON.parse(serviceAccountJson);
    } catch {
      throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON não contém JSON válido.');
    }
    return initializeApp({ credential: cert(serviceAccount), projectId });
  }

  return initializeApp({ credential: applicationDefault(), projectId });
}

const firebaseApp = createFirebaseApp();
const auth = getAuth(firebaseApp);
const db = getFirestore(firebaseApp);
const app = express();
app.use(express.json({ limit: '1mb' }));

function asyncRoute(
  handler: (req: Request, res: Response) => Promise<unknown>,
): RequestHandler {
  return (req, res, next) => {
    void handler(req, res).catch(next);
  };
}

function adminFor(req: Request): AdminIdentity {
  if (!req.adminUser) throw new HttpError(401, 'Sessão administrativa inválida.');
  return req.adminUser;
}

async function authUserForAdmin(uid: string, admin: AdminIdentity) {
  if (!isValidFirebaseUid(uid)) {
    throw new HttpError(400, 'UID de utilizador inválido.');
  }
  const userRef = db.collection('users').doc(uid);
  const profileSnapshot = await userRef.get();
  if (!profileSnapshot.exists) {
    throw new HttpError(404, `Perfil do utilizador ${uid} não encontrado.`);
  }
  const profile = profileSnapshot.data() || {};
  const profileUid = firstString(profile.uid, profile.user_id);
  if (profileUid && profileUid !== uid) {
    throw new HttpError(409, `O perfil ${uid} contém um UID inconsistente e não pode ser alterado.`);
  }

  const authUser = await auth.getUser(uid);
  if (
    hasAdminAccess(authUser.customClaims as TokenClaims)
    && (admin.role !== 'superadmin' || uid === admin.uid)
  ) {
    throw new HttpError(403, 'Apenas um superadministrador pode alterar outra conta administrativa.');
  }
  return authUser;
}

function authenticateAdmin(): RequestHandler {
  return (req, res, next) => {
    const authorization = req.headers.authorization;
    if (!authorization?.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Autenticação necessária.', code: 'unauthenticated' });
      return;
    }

    const token = authorization.slice('Bearer '.length).trim();
    void auth.verifyIdToken(token, true).then((claims) => {
      if (!hasAdminAccess(claims as TokenClaims)) {
        res.status(403).json({
          error: 'A conta não possui privilégios de administrador.',
          code: 'forbidden_not_admin',
        });
        return;
      }

      req.adminUser = {
        uid: claims.uid,
        email: claims.email || '',
        role: hasSuperAdminAccess(claims as TokenClaims) ? 'superadmin' : 'admin',
      };
      next();
    }).catch((error: unknown) => {
      if (isFirebaseAuthError(error)) {
        res.status(401).json({ error: 'Token Firebase inválido ou expirado.', code: 'invalid_token' });
        return;
      }
      next(error);
    });
  };
}

function recordFromSnapshot<T extends { id: string }>(snapshot: FirebaseFirestore.DocumentSnapshot<DocumentData>): T {
  return { ...snapshot.data(), id: snapshot.id } as T;
}

function firstString(...values: unknown[]): string | undefined {
  const value = values.find((candidate) =>
    (typeof candidate === 'string' && candidate.trim().length > 0)
    || (typeof candidate === 'number' && Number.isFinite(candidate)),
  );
  if (typeof value === 'number') return String(value);
  return typeof value === 'string' ? value : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function findBankEntries(
  value: Record<string, unknown>,
  path: string[] = [],
): Array<{ path: string[]; bank: Record<string, unknown> }> {
  const entries: Array<{ path: string[]; bank: Record<string, unknown> }> = [];
  if (firstString(value.iban, value.nome_banco, value.nome_proprietario, value.banco)) {
    entries.push({ path, bank: value });
  }
  for (const [key, child] of Object.entries(value)) {
    if (isRecord(child)) {
      entries.push(...findBankEntries(child, [...path, key]));
    } else if (Array.isArray(child)) {
      child.forEach((item, index) => {
        if (isRecord(item)) entries.push(...findBankEntries(item, [...path, key, String(index)]));
      });
    }
  }
  return entries;
}

function getNestedValue(source: unknown, path: string[]): unknown {
  if (path.length === 0) return source;
  const [key, ...remaining] = path;
  if (Array.isArray(source)) return getNestedValue(source[Number(key)], remaining);
  if (isRecord(source)) return getNestedValue(source[key], remaining);
  return undefined;
}

function setNestedValue(source: unknown, path: string[], value: unknown): unknown {
  if (path.length === 0) return value;
  const [key, ...remaining] = path;
  if (Array.isArray(source)) {
    const result = [...source];
    const index = Number(key);
    result[index] = setNestedValue(result[index], remaining, value);
    return result;
  }
  const record = isRecord(source) ? source : {};
  return { ...record, [key]: setNestedValue(record[key], remaining, value) };
}

function deleteNestedValue(source: unknown, path: string[]): unknown {
  if (path.length === 0) return source;
  const [key, ...remaining] = path;
  if (Array.isArray(source)) {
    const result = [...source];
    const index = Number(key);
    if (remaining.length === 0) result.splice(index, 1);
    else result[index] = deleteNestedValue(result[index], remaining);
    return result;
  }
  if (!isRecord(source)) throw new HttpError(404, 'A conta bancária não foi encontrada.');
  const result = { ...source };
  if (remaining.length === 0) delete result[key];
  else result[key] = deleteNestedValue(result[key], remaining);
  return result;
}

function normalizedDate(value: unknown): string | undefined {
  if (value instanceof Date) return Number.isFinite(value.getTime()) ? value.toISOString() : undefined;
  if (typeof value === 'string') {
    const parsed = new Date(value);
    return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : undefined;
  }
  if (typeof value === 'object' && value !== null && 'toDate' in value && typeof value.toDate === 'function') {
    const parsed = value.toDate();
    return parsed instanceof Date && Number.isFinite(parsed.getTime()) ? parsed.toISOString() : undefined;
  }
  return undefined;
}

function withdrawalRecordFromSnapshot(
  snapshot: FirebaseFirestore.DocumentSnapshot<DocumentData>,
): RetiradaRecord {
  const data = snapshot.data() || {};
  const uid = firstString(data.uid, data.user_id, data.usuario_id, data.uid_usuario);
  if (!uid) throw new HttpError(409, `O saque #${snapshot.id} não tem um identificador de utilizador válido.`);

  const status = normalizeWithdrawalStatus(data.status);
  if (status === 'estado_indisponivel') {
    throw new HttpError(409, `O saque #${snapshot.id} tem um estado inválido.`);
  }

  const bankData = typeof data.dados_bancarios_snapshot === 'object'
    && data.dados_bancarios_snapshot !== null
    ? data.dados_bancarios_snapshot as Record<string, unknown>
    : {};
  const bruto = data.valor ?? data.valor_bruto;
  const liquido = data.valor_liquido ?? data.valor_bruto ?? data.valor;

  return {
    ...data,
    id: snapshot.id,
    uid,
    user_nome: firstString(
      data.user_nome,
      data.nome_completo,
      bankData.nome_beneficiario,
    ),
    user_telefone: firstString(data.user_telefone, data.telefone, data.phone, bankData.nome_usuario),
    valor: bruto,
    valor_bruto: bruto,
    valor_liquido: liquido,
    taxa: data.taxa ?? parseFinancialValue(bruto) - parseFinancialValue(liquido),
    status,
    criado_em: normalizedDate(data.criado_em ?? data.created_at ?? data.data) || '',
    dados_bancarios_snapshot: {
      banco: firstString(bankData.banco) || '',
      iban: firstString(bankData.iban) || '',
      titular: firstString(
        bankData.titular,
        bankData.nome_beneficiario,
        bankData.nome_usuario,
      ) || '',
      conta: firstString(bankData.conta, bankData.numero_conta, bankData.account_number),
      telefone_express: firstString(bankData.telefone_express, bankData.telefone, bankData.nome_usuario),
    },
  } as RetiradaRecord;
}

function paymentRecordFromSnapshot(
  snapshot: FirebaseFirestore.DocumentSnapshot<DocumentData>,
): PaymentBotRecord {
  const data = snapshot.data() || {};
  const details = typeof data.detalhes_transacao === 'object' && data.detalhes_transacao !== null
    ? data.detalhes_transacao as Record<string, unknown>
    : {};

  return {
    ...data,
    id: snapshot.id,
    uid: firstString(data.uid, data.user_id, data.usuario_id, data.uid_usuario) || '',
    user_nome: firstString(data.user_nome, data.nome_usuario),
    user_telefone: firstString(data.user_telefone, data.telefone, data.phone),
    banco_destino: firstString(data.banco_destino),
    valor: data.valor ?? data.amount ?? '',
    metodo: firstString(data.metodo, data.metodo_pagamento, data.payment_method, data.method) || '',
    status: normalizeRechargeStatus(data.status),
    criado_em: normalizedDate(data.criado_em ?? data.created_at ?? data.data) || '',
    comprovativo_url: firstString(
      data.comprovativo_url,
      data.receipt_url,
      data.comprovativoUrl,
    ),
    detalhes_transacao: {
      ...details,
      comprovativo_url: firstString(
        details.comprovativo_url,
        details.receipt_url,
        data.comprovativo_url,
        data.receipt_url,
      ),
      multicaixaexpress: firstString(details.multicaixaexpress, data.multicaixaexpress),
      banco_origem: firstString(details.banco_origem, data.banco_origem),
      iban_origem: firstString(details.iban_origem, data.iban_origem),
      titular_origem: firstString(details.titular_origem, data.titular_origem),
      referencia: firstString(
        details.referencia,
        details.reference,
        data.referencia,
        data.chave_transacao,
      ),
    },
  } as PaymentBotRecord;
}

function optionalFinancialValue(value: unknown): number | null {
  if (typeof value !== 'number' && typeof value !== 'string') return null;
  if (typeof value === 'string' && !value.trim()) return null;
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? parseFinancialValue(numericValue) : null;
}

function userAccountFromSnapshot(snapshot: FirebaseFirestore.DocumentSnapshot<DocumentData>): UserAccount {
  const data = snapshot.data() || {};
  const balance = optionalFinancialValue(data.saldo ?? data.balance);
  if (balance === null) {
    throw new HttpError(409, `O saldo real do utilizador ${snapshot.id} não está disponível.`);
  }

  const status = data.status === 'congelado' || data.status === 'bloqueado' ? data.status : 'ativo';
  return {
    ...data,
    uid: firstString(data.uid, data.user_id, data.id) || snapshot.id,
    saldo: balance,
    balance,
    total_retirado: parseFinancialValue(data.total_retirado),
    ...(data.total_investido === undefined || data.total_investido === null
      ? {}
      : { total_investido: parseFinancialValue(data.total_investido) }),
    status,
  };
}

async function userAccountForTransaction(
  transaction: FirebaseFirestore.Transaction,
  snapshot: FirebaseFirestore.DocumentSnapshot<DocumentData>,
): Promise<UserAccount> {
  const user = userAccountFromSnapshot(snapshot);
  const profile = snapshot.data() || {};
  if (profile.total_retirado !== undefined && profile.total_retirado !== null) return user;

  const [legacyWithdrawals, currentWithdrawals] = await Promise.all([
    transaction.get(db.collection('retiradas').where('uid', '==', user.uid)),
    transaction.get(db.collection('retiradas').where('user_id', '==', user.uid)),
  ]);
  const docsById = new Map([
    ...legacyWithdrawals.docs,
    ...currentWithdrawals.docs,
  ].map((doc) => [doc.id, doc]));
  user.total_retirado = [...docsById.values()].reduce((total, doc) => {
    const record = doc.data();
    if (record.status !== 'pago' && record.status !== 'concluido') return total;
    return total + parseFinancialValue(record.valor ?? record.valor_bruto);
  }, 0);
  return user;
}
function dateValue(value: unknown): number {
  if (typeof value !== 'string' && !(value instanceof Date)) return 0;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : 0;
}

function pageNumber(value: unknown, fallback: number, max: number): number {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? Math.min(number, max) : fallback;
}

async function addAuditLog(
  transaction: FirebaseFirestore.Transaction,
  auditLog: AuditLogRecord,
): Promise<void> {
  transaction.set(db.collection('admin_audit_logs').doc(auditLog.id), auditLog);
}

app.post('/api/admin/auth/verify', asyncRoute(async (req, res) => {
  const token = req.body?.token;
  if (typeof token !== 'string' || !token.trim()) {
    res.status(400).json({ authorized: false, error: 'Token Firebase obrigatório.' });
    return;
  }

  try {
    const claims: DecodedIdToken = await auth.verifyIdToken(token, true);
    if (!hasAdminAccess(claims as TokenClaims)) {
      res.status(403).json({
        authorized: false,
        error: 'A conta não possui privilégios de administrador.',
      });
      return;
    }
    res.json({
      authorized: true,
      user: {
        uid: claims.uid,
        email: claims.email || '',
        role: hasSuperAdminAccess(claims as TokenClaims) ? 'superadmin' : 'admin',
        isSuperAdmin: hasSuperAdminAccess(claims as TokenClaims),
      },
    });
  } catch (error) {
    if (isFirebaseAuthError(error)) {
      res.status(401).json({ authorized: false, error: 'Token Firebase inválido ou expirado.' });
      return;
    }
    throw error;
  }
}));

app.post('/api/admin/auth/bootstrap', asyncRoute(async (req, res) => {
  const token = req.headers.authorization?.startsWith('Bearer ')
    ? req.headers.authorization.slice('Bearer '.length).trim()
    : '';
  if (!token) {
    res.status(401).json({ authorized: false, error: 'Autenticação necessária.' });
    return;
  }

  const bootstrapEmail = process.env.FIREBASE_ADMIN_EMAIL?.trim().toLowerCase();
  if (!bootstrapEmail) {
    res.status(503).json({ authorized: false, error: 'Cadastro inicial do administrador não está configurado.' });
    return;
  }

  try {
    const claims = await auth.verifyIdToken(token, true);
    if (hasAdminAccess(claims as TokenClaims)) {
      res.json({ authorized: true, claimsUpdated: false });
      return;
    }
    if (claims.email?.trim().toLowerCase() !== bootstrapEmail) {
      res.status(403).json({ authorized: false, error: 'Este email não está autorizado para criar o administrador.' });
      return;
    }
    if (!claims.email_verified) {
      res.status(403).json({ authorized: false, error: 'Verifique o email antes de ativar o acesso administrativo.' });
      return;
    }

    const user = await auth.getUser(claims.uid);
    await auth.setCustomUserClaims(claims.uid, {
      ...user.customClaims,
      admin: true,
      role: 'superadmin',
    });
    res.json({ authorized: true, claimsUpdated: true });
  } catch (error) {
    if (isFirebaseAuthError(error)) {
      res.status(401).json({ authorized: false, error: 'Token Firebase inválido ou expirado.' });
      return;
    }
    throw error;
  }
}));

const adminRouter = express.Router();
adminRouter.use(authenticateAdmin());

adminRouter.get('/dashboard', asyncRoute(async (_req, res) => {
  const [rechargeSnapshot, withdrawalSnapshot, usersSnapshot, auditSnapshot] = await Promise.all([
    db.collection('paymentbot').where('status', '==', 'pendente').get(),
    db.collection('retiradas').where('status', '==', 'pendente').get(),
    db.collection('users').get(),
    db.collection('admin_audit_logs').orderBy('data', 'desc').limit(5).get(),
  ]);

  const pendingRecharges = rechargeSnapshot.docs.map((doc) => paymentRecordFromSnapshot(doc));
  const pendingWithdrawals = withdrawalSnapshot.docs.map((doc) => withdrawalRecordFromSnapshot(doc));
  const olderThanDay = (createdAt: string) => Date.now() - dateValue(createdAt) > 24 * 60 * 60 * 1000;
  const delayedRecharges = pendingRecharges.filter((record) => olderThanDay(record.criado_em));
  const delayedWithdrawals = pendingWithdrawals.filter((record) => olderThanDay(record.criado_em));

  res.json({
    counts: {
      pendingRecharges: pendingRecharges.length,
      pendingWithdrawals: pendingWithdrawals.length,
      totalUsers: usersSnapshot.size,
      delayedAlerts: delayedRecharges.length + delayedWithdrawals.length,
    },
    volumes: {
      pendingRechargeAmount: pendingRecharges.reduce((sum, record) => sum + parseFinancialValue(record.valor), 0),
      pendingWithdrawalAmount: pendingWithdrawals.reduce((sum, record) => sum + parseFinancialValue(record.valor_liquido || record.valor), 0),
    },
    alerts: [
      ...delayedRecharges.map((record) => ({
        tipo: 'recarga_atrasada',
        mensagem: `Recarga #${record.id} (${parseFinancialValue(record.valor)} KZ) pendente há mais de 24 horas.`,
        id: record.id,
        rota: '/admin/recharges?filter=pendente',
      })),
      ...delayedWithdrawals.map((record) => ({
        tipo: 'saque_atrasado',
        mensagem: `Saque #${record.id} (${parseFinancialValue(record.valor_liquido || record.valor)} KZ) aguarda pagamento há mais de 24 horas.`,
        id: record.id,
        rota: '/admin/withdrawals?filter=pendente',
      })),
    ],
    recentAuditLogs: auditSnapshot.docs.map((doc) => recordFromSnapshot<AuditLogRecord>(doc)),
  });
}));

adminRouter.get('/recharges', asyncRoute(async (req, res) => {
  const requestedStatus = typeof req.query.status === 'string' ? req.query.status : '';
  const search = typeof req.query.search === 'string' ? req.query.search.trim().toLocaleLowerCase() : '';
  const searchDigits = search.replace(/\D/g, '');
  const snapshot = await db.collection('paymentbot').get();
  let list = snapshot.docs
    .map((doc) => paymentRecordFromSnapshot(doc))
    .sort((a, b) => dateValue(b.criado_em) - dateValue(a.criado_em));

  if (requestedStatus && requestedStatus !== 'todos') {
    const normalizedStatus = normalizeRechargeStatus(requestedStatus);
    list = list.filter((record) => record.status === normalizedStatus);
  }

  const profilesByUid = new Map<string, DocumentData>();
  if (search) {
    const usersSnapshot = await db.collection('users').get();
    for (const userDoc of usersSnapshot.docs) {
      const profile = userDoc.data();
      const uid = firstString(profile.uid, profile.user_id, profile.id) || userDoc.id;
      profilesByUid.set(uid, profile);
      profilesByUid.set(userDoc.id, profile);
    }

    list = list.filter((record) => {
      const profile = profilesByUid.get(record.uid) || {};
      const userPhone = firstString(
        record.user_telefone,
        profile.telefone,
        profile.phone,
        profile.phoneNumber,
        profile.phone_number,
      ) || '';
      const paymentPhone = record.detalhes_transacao?.multicaixaexpress || '';
      const fields = [
        record.id,
        record.uid,
        record.user_nome,
        firstString(profile.nome_exibicao, profile.nome_completo, profile.nome),
        userPhone,
        paymentPhone,
        record.metodo,
        record.detalhes_transacao?.referencia,
      ];
      const textMatch = fields.some((field) => field?.toLocaleLowerCase().includes(search));
      const phoneMatch = searchDigits.length >= 4 && [userPhone, paymentPhone].some((phone) =>
        phone.replace(/\D/g, '').includes(searchDigits),
      );
      return textMatch || phoneMatch;
    });
  }

  const page = pageNumber(req.query.page, 1, Number.MAX_SAFE_INTEGER);
  const limit = pageNumber(req.query.limit, 50, 100);
  const total = list.length;
  const pageItems = list.slice((page - 1) * limit, page * limit);
  const items = await Promise.all(pageItems.map(async (record) => {
    const profile = profilesByUid.get(record.uid)
      || (record.uid ? (await db.collection('users').doc(record.uid).get()).data() : undefined)
      || {};
    return {
      ...record,
      user_nome: record.user_nome || firstString(profile.nome_exibicao, profile.nome_completo, profile.nome),
      user_telefone: record.user_telefone || firstString(
        profile.telefone,
        profile.phone,
        profile.phoneNumber,
        profile.phone_number,
      ),
    };
  }));
  res.json({ items, total, page, totalPages: Math.ceil(total / limit) });
}));

adminRouter.post('/recharges/:id/approve', asyncRoute(async (req, res) => {
  const id = req.params.id;
  const admin = adminFor(req);
  const paymentRef = db.collection('paymentbot').doc(id);
  const auditRef = db.collection('admin_audit_logs').doc();
  const result = await db.runTransaction(async (transaction) => {
    const paymentSnapshot = await transaction.get(paymentRef);
    if (!paymentSnapshot.exists) throw new HttpError(404, `Recarga #${id} não encontrada.`);
    const record = paymentRecordFromSnapshot(paymentSnapshot);
    if (!record.uid) throw new HttpError(409, `A recarga #${id} não tem um identificador de utilizador válido.`);
    const validation = validateRechargeTransition(record, 'approve');
    if (!validation.valid) throw new HttpError(400, validation.error || 'Transição inválida.');

    const userRef = db.collection('users').doc(record.uid);
    const userSnapshot = await transaction.get(userRef);
    if (!userSnapshot.exists) throw new HttpError(404, `Utilizador ${record.uid} não encontrado.`);
    const user = await userAccountForTransaction(transaction, userSnapshot);
    const mutation = calculateRechargeApprovalMutation(user, record, admin.uid, admin.email);

    transaction.update(paymentRef, {
      status: mutation.updatedRecord.status,
      atualizado_em: mutation.updatedRecord.atualizado_em,
      decisao: mutation.updatedRecord.decisao,
    });
    transaction.set(userRef, {
      ...mutation.updatedUser,
      balance: mutation.updatedUser.saldo,
    }, { merge: true });
    transaction.set(db.collection('extrato_mcpn').doc(mutation.extratoEntry.id), mutation.extratoEntry);
    transaction.set(auditRef, { ...mutation.auditLog, id: auditRef.id });
    return mutation;
  });
  res.json({
    success: true,
    message: `Recarga #${id} aprovada e creditada com sucesso.`,
    updatedRecord: result.updatedRecord,
    novoSaldoUsuario: result.updatedUser.saldo,
  });
}));

adminRouter.post('/recharges/:id/reject', asyncRoute(async (req, res) => {
  const id = req.params.id;
  const motivo = typeof req.body?.motivo === 'string' ? req.body.motivo : '';
  const admin = adminFor(req);
  const paymentRef = db.collection('paymentbot').doc(id);
  const auditRef = db.collection('admin_audit_logs').doc();
  const updatedRecord = await db.runTransaction(async (transaction) => {
    const paymentSnapshot = await transaction.get(paymentRef);
    if (!paymentSnapshot.exists) throw new HttpError(404, `Recarga #${id} não encontrada.`);
    const record = paymentRecordFromSnapshot(paymentSnapshot);
    const validation = validateRechargeTransition(record, 'reject', motivo);
    if (!validation.valid) throw new HttpError(400, validation.error || 'Transição inválida.');
    const now = new Date().toISOString();
    const updated: PaymentBotRecord = {
      ...record,
      status: 'rejeitado',
      atualizado_em: now,
      decisao: { admin_uid: admin.uid, admin_email: admin.email, data: now, motivo: motivo.trim() },
    };
    const auditLog: AuditLogRecord = {
      id: auditRef.id,
      admin_uid: admin.uid,
      admin_email: admin.email,
      acao: 'REJEITAR_RECARGA',
      entidade: 'paymentbot',
      entidade_id: id,
      data: now,
      decisao: 'rejeitado',
      motivo: motivo.trim(),
      dados_anteriores: { status: record.status },
      dados_novos: { status: 'rejeitado', motivo: motivo.trim() },
    };
    transaction.update(paymentRef, {
      status: updated.status,
      atualizado_em: updated.atualizado_em,
      decisao: updated.decisao,
    });
    transaction.set(auditRef, auditLog);
    return updated;
  });
  res.json({ success: true, message: `Recarga #${id} rejeitada com o motivo especificado.`, updatedRecord });
}));

adminRouter.get('/withdrawals', asyncRoute(async (req, res) => {
  const requestedStatus = typeof req.query.status === 'string' ? req.query.status : '';
  const snapshot = await db.collection('retiradas').get();
  let list = snapshot.docs
    .map((doc) => withdrawalRecordFromSnapshot(doc))
    .sort((a, b) => dateValue(b.criado_em) - dateValue(a.criado_em));
  if (requestedStatus && requestedStatus !== 'todos') {
    const normalizedStatus = normalizeWithdrawalStatus(requestedStatus);
    list = list.filter((record) => record.status === normalizedStatus);
  }
  const page = pageNumber(req.query.page, 1, Number.MAX_SAFE_INTEGER);
  const limit = pageNumber(req.query.limit, 50, 100);
  const total = list.length;
  const pageItems = list.slice((page - 1) * limit, page * limit);
  const items = await Promise.all(pageItems.map(async (record) => {
    const userSnapshot = await db.collection('users').doc(record.uid).get();
    const profile = userSnapshot.data() || {};
    let authUser;
    try {
      authUser = await auth.getUser(record.uid);
    } catch (error) {
      const isUserNotFound = typeof error === 'object'
        && error !== null
        && 'code' in error
        && error.code === 'auth/user-not-found';
      if (!isUserNotFound) throw error;
    }
    return {
      ...record,
      user_nome: record.user_nome
        || profile.nome_completo
        || profile.nome_exibicao
        || profile.nome
        || profile.name
        || authUser?.displayName,
      user_telefone: record.user_telefone
        || profile.telefone
        || profile.phone
        || profile.phoneNumber
        || authUser?.phoneNumber,
    };
  }));
  res.json({ items, total, page, totalPages: Math.ceil(total / limit) });
}));

adminRouter.post('/withdrawals/:id/pay', asyncRoute(async (req, res) => {
  const id = req.params.id;
  const paidAmount = typeof req.body?.valorPago === 'number' ? req.body.valorPago : Number.NaN;
  const admin = adminFor(req);
  const withdrawalRef = db.collection('retiradas').doc(id);
  const auditRef = db.collection('admin_audit_logs').doc();
  const result = await db.runTransaction(async (transaction) => {
    const withdrawalSnapshot = await transaction.get(withdrawalRef);
    if (!withdrawalSnapshot.exists) throw new HttpError(404, `Saque #${id} não encontrado.`);
    const record = withdrawalRecordFromSnapshot(withdrawalSnapshot);
    const validation = validateWithdrawalTransition(record, 'approve_paid', undefined, paidAmount);
    if (!validation.valid) throw new HttpError(400, validation.error || 'Transição inválida.');

    const userRef = db.collection('users').doc(record.uid);
    const userSnapshot = await transaction.get(userRef);
    if (!userSnapshot.exists) throw new HttpError(404, `Utilizador ${record.uid} não encontrado.`);
    const mutation = calculateWithdrawalMutation(
      await userAccountForTransaction(transaction, userSnapshot),
      record,
      'approve_paid',
      admin.uid,
      admin.email,
    );
    transaction.update(withdrawalRef, {
      status: mutation.updatedRecord.status,
      atualizado_em: mutation.updatedRecord.atualizado_em,
      decisao: mutation.updatedRecord.decisao,
    });
    transaction.set(userRef, {
      ...mutation.updatedUser,
      balance: mutation.updatedUser.saldo,
    }, { merge: true });
    transaction.set(auditRef, { ...mutation.auditLog, id: auditRef.id });
    return mutation;
  });
  res.json({ success: true, message: `Saque #${id} liquidado com sucesso.`, updatedRecord: result.updatedRecord });
}));

adminRouter.post('/withdrawals/:id/reject', asyncRoute(async (req, res) => {
  const id = req.params.id;
  const motivo = typeof req.body?.motivo === 'string' ? req.body.motivo : '';
  const admin = adminFor(req);
  const withdrawalRef = db.collection('retiradas').doc(id);
  const auditRef = db.collection('admin_audit_logs').doc();
  const result = await db.runTransaction(async (transaction) => {
    const withdrawalSnapshot = await transaction.get(withdrawalRef);
    if (!withdrawalSnapshot.exists) throw new HttpError(404, `Saque #${id} não encontrado.`);
    const record = withdrawalRecordFromSnapshot(withdrawalSnapshot);
    const validation = validateWithdrawalTransition(record, 'reject', motivo);
    if (!validation.valid) throw new HttpError(400, validation.error || 'Transição inválida.');

    const userRef = db.collection('users').doc(record.uid);
    const userSnapshot = await transaction.get(userRef);
    if (!userSnapshot.exists) throw new HttpError(404, `Utilizador ${record.uid} não encontrado.`);
    const mutation = calculateWithdrawalMutation(
      await userAccountForTransaction(transaction, userSnapshot),
      record,
      'reject',
      admin.uid,
      admin.email,
      { reason: motivo.trim() },
    );
    transaction.update(withdrawalRef, {
      status: mutation.updatedRecord.status,
      atualizado_em: mutation.updatedRecord.atualizado_em,
      decisao: mutation.updatedRecord.decisao,
    });
    transaction.set(userRef, {
      ...mutation.updatedUser,
      balance: mutation.updatedUser.saldo,
    }, { merge: true });
    if (mutation.extratoEntry) {
      transaction.set(db.collection('extrato_mcpn').doc(mutation.extratoEntry.id), mutation.extratoEntry);
    }
    transaction.set(auditRef, { ...mutation.auditLog, id: auditRef.id });
    return mutation;
  });
  res.json({
    success: true,
    message: `Saque #${id} rejeitado e saldo de ${result.extratoEntry?.valor ?? 0} KZ estornado.`,
    updatedRecord: result.updatedRecord,
    novoSaldoUsuario: result.updatedUser.saldo,
  });
}));

adminRouter.get('/products', asyncRoute(async (_req, res) => {
  const snapshot = await db.collection('produtos').get();
  res.json({ items: snapshot.docs.map((doc) => recordFromSnapshot<ProdutoRecord>(doc)) });
}));

adminRouter.post('/products', asyncRoute(async (req, res) => {
  const validation = validateProductData(req.body || {});
  if (!validation.valid || !validation.normalized) {
    res.status(400).json({ error: validation.error || 'Dados do produto inválidos.' });
    return;
  }

  const admin = adminFor(req);
  const product = validation.normalized;
  const isNew = req.body?.isNew === true;
  const productRef = db.collection('produtos').doc(product.id);
  const auditRef = db.collection('admin_audit_logs').doc();
  const result = await db.runTransaction(async (transaction) => {
    const previous = await transaction.get(productRef);
    const isUpdate = previous.exists;
    if (isNew && isUpdate) {
      throw new HttpError(409, `Já existe um produto com o ID '${product.id}'.`);
    }
    if (!isNew && !isUpdate) {
      throw new HttpError(404, `O produto '${product.id}' não foi encontrado.`);
    }
    const now = new Date().toISOString();
    const saved: ProdutoRecord & { criado_em: string; atualizado_em: string } = {
      ...product,
      criado_em: previous.data()?.criado_em || now,
      atualizado_em: now,
    };
    const audit: AuditLogRecord = {
      id: auditRef.id,
      admin_uid: admin.uid,
      admin_email: admin.email,
      acao: isUpdate ? 'ATUALIZAR_PRODUTO' : 'CRIAR_PRODUTO',
      entidade: 'produtos',
      entidade_id: product.id,
      decisao: isUpdate ? 'atualizado' : 'criado',
      data: now,
      dados_novos: { ...saved },
    };
    transaction.set(productRef, saved, { merge: true });
    transaction.set(auditRef, audit);
    return { saved, isUpdate };
  });
  res.json({
    success: true,
    message: `Produto '${product.nome}' ${result.isUpdate ? 'atualizado' : 'criado'} com sucesso.`,
    product: result.saved,
  });
}));

adminRouter.patch('/products/:id/status', asyncRoute(async (req, res) => {
  const id = req.params.id;
  if (!id || id.includes('/')) {
    res.status(400).json({ error: 'Identificador de produto inválido.' });
    return;
  }
  if (typeof req.body?.ativo !== 'boolean') {
    res.status(400).json({ error: 'O estado ativo deve ser true ou false.' });
    return;
  }
  const admin = adminFor(req);
  const productRef = db.collection('produtos').doc(id);
  const auditRef = db.collection('admin_audit_logs').doc();
  const now = new Date().toISOString();
  await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(productRef);
    if (!snapshot.exists) throw new HttpError(404, `O produto '${id}' não foi encontrado.`);
    const previous = snapshot.data() || {};
    transaction.update(productRef, { ativo: req.body.ativo, atualizado_em: now });
    transaction.set(auditRef, {
      id: auditRef.id,
      admin_uid: admin.uid,
      admin_email: admin.email,
      acao: req.body.ativo ? 'ATIVAR_PRODUTO' : 'DESATIVAR_PRODUTO',
      entidade: 'produtos',
      entidade_id: id,
      decisao: req.body.ativo ? 'ativado' : 'desativado',
      data: now,
      dados_anteriores: { ativo: previous.ativo },
      dados_novos: { ativo: req.body.ativo },
    } satisfies AuditLogRecord);
  });
  res.json({
    success: true,
    message: `Produto '${id}' ${req.body.ativo ? 'ativado' : 'desativado'} com sucesso.`,
  });
}));

adminRouter.delete('/products/:id', asyncRoute(async (req, res) => {
  const id = req.params.id;
  if (!id || id.includes('/')) {
    res.status(400).json({ error: 'Identificador de produto inválido.' });
    return;
  }
  const admin = adminFor(req);
  const productRef = db.collection('produtos').doc(id);
  const auditRef = db.collection('admin_audit_logs').doc();
  await db.runTransaction(async (transaction) => {
    const productSnapshot = await transaction.get(productRef);
    if (!productSnapshot.exists) throw new HttpError(404, `O produto '${id}' não foi encontrado.`);
    const previous = productSnapshot.data() || {};
    const now = new Date().toISOString();
    const audit: AuditLogRecord = {
      id: auditRef.id,
      admin_uid: admin.uid,
      admin_email: admin.email,
      acao: 'EXCLUIR_PRODUTO',
      entidade: 'produtos',
      entidade_id: id,
      decisao: 'excluido',
      data: now,
      dados_anteriores: previous,
    };
    transaction.delete(productRef);
    transaction.set(auditRef, audit);
  });
  res.json({ success: true, message: `Produto '${id}' excluído do catálogo.` });
}));

adminRouter.get('/payment-methods', asyncRoute(async (_req, res) => {
  const snapshot = await db.collection('pasta').get();
  const items: Array<Record<string, unknown> & { id: string }> = [];
  for (const doc of snapshot.docs) {
    const data = doc.data();
    const bankEntries = findBankEntries(data);

    if (bankEntries.length > 0) {
      for (const { path, bank } of bankEntries) {
        const itemKey = path.length > 0 ? path.join('.') : '$root';
        const statusField = ['estado', 'ativo', 'disponivel', 'status', 'active', 'is_active'].find((field) => typeof bank[field] === 'boolean');
        items.push({
          id: `${doc.id}::${itemKey}`,
          documentId: doc.id,
          itemKey,
          activeField: statusField || 'estado',
          tipo: 'banco',
          nome: firstString(bank.nome_banco, bank.banco) || doc.id,
          banco: firstString(bank.nome_banco, bank.banco),
          iban: firstString(bank.iban) || '',
          titular: firstString(bank.nome_proprietario, bank.titular) || '',
          ativo: statusField ? bank[statusField] : undefined,
          atualizado_em: normalizedDate(data.updated_at) || normalizedDate(data.atualizado_em),
        });
      }
      continue;
    }

    const statusField = ['estado', 'ativo', 'disponivel', 'status', 'active', 'is_active'].find((field) => typeof data[field] === 'boolean');
    if ('nome_express' in data || 'numreo_express' in data || 'numero_express' in data) {
      items.push({
        id: doc.id,
        documentId: doc.id,
        activeField: statusField || 'estado',
        tipo: 'multicaixa_express',
        nome: firstString(data.nome_express) || 'Multicaixa Express',
        telefone: firstString(data.numreo_express, data.numero_express) || '',
        titular: firstString(data.nome_proprietario, data.titular) || '',
        ativo: statusField ? data[statusField] : undefined,
        atualizado_em: normalizedDate(data.updated_at) || normalizedDate(data.atualizado_em),
      });
      continue;
    }

    if ('endereco' in data || 'rede' in data) {
      items.push({
        id: doc.id,
        documentId: doc.id,
        activeField: statusField || 'estado',
        tipo: 'cripto',
        nome: firstString(data.nome, data.nome_carteira) || 'Depósito em cripto',
        endereco: firstString(data.endereco) || '',
        rede: firstString(data.rede) || '',
        titular: firstString(data.titular, data.nome_proprietario) || '',
        ativo: statusField ? data[statusField] : undefined,
        atualizado_em: normalizedDate(data.updated_at) || normalizedDate(data.atualizado_em),
      });
      continue;
    }

    items.push({
      ...data,
      id: doc.id,
      documentId: doc.id,
      tipo: data.tipo || 'banco',
      nome: firstString(data.nome, data.nome_banco) || doc.id,
      titular: firstString(data.titular, data.nome_proprietario) || '',
      ativo: statusField ? data[statusField] : data.ativo,
      activeField: statusField || 'ativo',
    });
  }
  items.sort((a, b) => Number(a.ordem || 99) - Number(b.ordem || 99));
  res.json({ items });
}));

adminRouter.post('/payment-methods/:id', asyncRoute(async (req, res) => {
  const id = req.params.id;
  const data = req.body;
  if (!id || id.includes('/')) {
    res.status(400).json({ error: 'Identificador da coordenada inválido.' });
    return;
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    res.status(400).json({ error: 'Dados do método de pagamento inválidos.' });
    return;
  }

  const admin = adminFor(req);
  const collection = db.collection('pasta');
  const isNew = data.isNew === true;
  const itemKey = typeof data.itemKey === 'string' ? data.itemKey : undefined;
  const type = data.tipo;
  if (!['banco', 'multicaixa_express', 'cripto'].includes(type)) {
    res.status(400).json({ error: 'Tipo de coordenada inválido.' });
    return;
  }
  if (typeof data.nome !== 'string' || !data.nome.trim()) {
    res.status(400).json({ error: 'O nome da coordenada é obrigatório.' });
    return;
  }
  if (type === 'banco' && (typeof data.titular !== 'string' || !data.titular.trim())) {
    res.status(400).json({ error: 'O titular da conta bancária é obrigatório.' });
    return;
  }
  if (type === 'multicaixa_express' && (typeof data.telefone !== 'string' || !data.telefone.trim())) {
    res.status(400).json({ error: 'O número do Multicaixa Express é obrigatório.' });
    return;
  }
  if (type === 'cripto' && (
    typeof data.titular !== 'string' || !data.titular.trim()
    || typeof data.rede !== 'string' || !data.rede.trim()
    || typeof data.endereco !== 'string' || !data.endereco.trim()
  )) {
    res.status(400).json({ error: 'Titular, rede e endereço da carteira são obrigatórios.' });
    return;
  }
  const methodSnapshot = isNew && type === 'banco' ? await collection.get() : undefined;
  const bankMapDoc = methodSnapshot?.docs.find((doc) =>
    findBankEntries(doc.data()).some((entry) => entry.path.length > 0),
  );
  const methodRef = bankMapDoc?.ref || collection.doc(id);
  const auditRef = db.collection('admin_audit_logs').doc();
  const result = await db.runTransaction(async (transaction) => {
    const existing = await transaction.get(methodRef);
    if (isNew && !bankMapDoc && existing.exists) {
      throw new HttpError(409, 'Já existe uma coordenada com este identificador.');
    }
    if (!isNew && !existing.exists) {
      throw new HttpError(404, 'A coordenada de depósito não foi encontrada.');
    }
    const now = new Date().toISOString();
    const existingData = existing.data() || {};
    let updated: Record<string, unknown>;
    let resultId = id;
    if (type === 'banco' && (itemKey || isNew)) {
      const pathParts = itemKey && itemKey !== '$root' ? itemKey.split('.') : [];
      const oldBankValue = itemKey === '$root'
        ? existingData
        : isNew
          ? {}
          : getNestedValue(existingData, pathParts);
      if (!isRecord(oldBankValue)) throw new HttpError(404, 'A conta bancária não foi encontrada no mapa.');
      const activeField = typeof data.activeField === 'string' ? data.activeField : 'estado';
      const bank = {
        ...oldBankValue,
        iban: typeof data.iban === 'string' ? data.iban : '',
        nome_banco: typeof data.nome === 'string' ? data.nome : '',
        nome_proprietario: typeof data.titular === 'string' ? data.titular : '',
        ...(typeof data.ativo === 'boolean' ? { [activeField]: data.ativo } : {}),
      };
      if (isNew) {
        if (bankMapDoc) {
          const firstEntry = findBankEntries(existingData).find((entry) => entry.path.length > 0);
          if (!firstEntry) throw new HttpError(409, 'Não foi possível localizar o mapa de contas bancárias.');
          const containerPath = firstEntry.path.slice(0, -1);
          const container = getNestedValue(existingData, containerPath);
          let newKey: string;
          if (Array.isArray(container)) {
            newKey = String(container.length);
          } else if (isRecord(container)) {
            newKey = String(Math.max(
              -1,
              ...Object.keys(container).filter((key) => /^\d+$/.test(key)).map(Number),
            ) + 1);
          } else {
            throw new HttpError(409, 'O formato do mapa de contas bancárias não é compatível.');
          }
          const withNewBank = setNestedValue(existingData, [...containerPath, newKey], bank);
          if (!isRecord(withNewBank)) throw new Error('Não foi possível atualizar o mapa de bancos.');
          updated = withNewBank;
          updated.updated_at = now;
          resultId = `${methodRef.id}::${[...containerPath, newKey].join('.')}`;
        } else {
          updated = { ...bank, updated_at: now };
        }
      } else if (itemKey === '$root') {
        updated = { ...existingData, ...bank, updated_at: now };
      } else {
        const withUpdatedBank = setNestedValue(existingData, pathParts, bank);
        if (!isRecord(withUpdatedBank)) throw new Error('Não foi possível atualizar a conta bancária.');
        updated = withUpdatedBank;
        updated.updated_at = now;
      }
      transaction.set(methodRef, updated);
      if (!isNew && itemKey !== '$root') resultId = `${methodRef.id}::${itemKey}`;
    } else if (type === 'multicaixa_express' && ('nome_express' in existingData || isNew)) {
      const express = {
        ...existingData,
        nome_express: typeof data.nome === 'string' ? data.nome : '',
        numreo_express: typeof data.telefone === 'string' ? data.telefone : '',
        ...(typeof data.ativo === 'boolean'
          ? { [typeof data.activeField === 'string' ? data.activeField : 'estado']: data.ativo }
          : {}),
        updated_at: now,
      };
      updated = express;
      transaction.set(methodRef, express, { merge: true });
    } else if (type === 'cripto' && ('endereco' in existingData || 'rede' in existingData || isNew)) {
      const wallet = {
        ...existingData,
        endereco: typeof data.endereco === 'string' ? data.endereco : '',
        rede: typeof data.rede === 'string' ? data.rede : '',
        titular: typeof data.titular === 'string' ? data.titular : '',
        nome_carteira: typeof data.nome === 'string' ? data.nome : '',
        ...(typeof data.ativo === 'boolean'
          ? { [typeof data.activeField === 'string' ? data.activeField : 'estado']: data.ativo }
          : {}),
        updated_at: now,
      };
      updated = wallet;
      transaction.set(methodRef, wallet, { merge: true });
    } else {
      const {
        isNew: _isNew,
        documentId: _documentId,
        itemKey: _itemKey,
        activeField: _activeField,
        ...fields
      } = data;
      updated = { ...existingData, ...fields, id, atualizado_em: now };
      transaction.set(methodRef, updated, { merge: true });
    }
    const audit: AuditLogRecord = {
      id: auditRef.id,
      admin_uid: admin.uid,
      admin_email: admin.email,
      acao: isNew ? 'CRIAR_COORDENADA_DEPOSITO' : 'EDITAR_METODO_PAGAMENTO',
      entidade: 'pasta',
      entidade_id: resultId,
      decisao: isNew ? 'criado' : 'atualizado',
      data: now,
      dados_novos: { id: resultId, tipo: type, nome: data.nome, ativo: data.ativo },
    };
    transaction.set(auditRef, audit);
    return { updated, resultId };
  });
  res.json({
    success: true,
    message: `Coordenada '${String(data.nome || id)}' ${isNew ? 'adicionada' : 'atualizada'} com sucesso.`,
    method: { ...result.updated, id: result.resultId },
  });
}));

adminRouter.delete('/payment-methods/:id', asyncRoute(async (req, res) => {
  const id = req.params.id;
  const itemKey = typeof req.query.itemKey === 'string' ? req.query.itemKey : undefined;
  const admin = adminFor(req);
  const methodRef = db.collection('pasta').doc(id);
  const auditRef = db.collection('admin_audit_logs').doc();
  const deletedId = await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(methodRef);
    if (!snapshot.exists) throw new HttpError(404, 'A coordenada de depósito não foi encontrada.');
    const now = new Date().toISOString();
    if (itemKey) {
      const existingData = snapshot.data() || {};
      if (itemKey === '$root') {
        if (!findBankEntries(existingData).some((entry) => entry.path.length === 0)) {
          throw new HttpError(404, 'A conta bancária não foi encontrada.');
        }
        const remaining = { ...existingData };
        for (const field of [
          'iban', 'nome_banco', 'nome_proprietario', 'banco', 'titular',
          'estado', 'ativo', 'disponivel', 'status', 'active', 'is_active',
        ]) {
          delete remaining[field];
        }
        transaction.set(methodRef, { ...remaining, updated_at: now });
      } else {
        const pathParts = itemKey.split('.');
        if (!isRecord(getNestedValue(existingData, pathParts))) {
          throw new HttpError(404, 'A conta bancária não foi encontrada.');
        }
        const remaining = deleteNestedValue(existingData, pathParts);
        if (!isRecord(remaining)) throw new Error('A estrutura da coleção pasta ficou inválida ao excluir a conta.');
        transaction.set(methodRef, { ...remaining, updated_at: now });
      }
    } else {
      transaction.delete(methodRef);
    }
    transaction.set(auditRef, {
      id: auditRef.id,
      admin_uid: admin.uid,
      admin_email: admin.email,
      acao: 'EXCLUIR_COORDENADA_DEPOSITO',
      entidade: 'pasta',
      entidade_id: itemKey ? `${id}::${itemKey}` : id,
      decisao: 'excluido',
      data: now,
    } satisfies AuditLogRecord);
    return itemKey ? `${id}::${itemKey}` : id;
  });
  res.json({ success: true, message: `Coordenada '${deletedId}' excluída com sucesso.` });
}));

adminRouter.get('/users', asyncRoute(async (req, res) => {
  const query = typeof req.query.query === 'string' ? req.query.query.toLowerCase().trim() : '';
  const requestedSearchField = typeof req.query.searchBy === 'string' ? req.query.searchBy : '';
  const searchField = ['uid', 'telefone', 'convite'].includes(requestedSearchField)
    ? requestedSearchField
    : 'all';
  const [usersSnapshot, withdrawalsSnapshot, purchasesSnapshot] = await Promise.all([
    db.collection('users').get(),
    db.collection('retiradas').where('status', 'in', ['pago', 'concluido']).get(),
    db.collection('sys_600').get(),
  ]);

  const authUsers = new Map<string, Awaited<ReturnType<typeof auth.getUser>>>();
  let pageToken: string | undefined;
  do {
    const authPage = await auth.listUsers(1000, pageToken);
    for (const authUser of authPage.users) authUsers.set(authUser.uid, authUser);
    pageToken = authPage.pageToken;
  } while (pageToken);

  const withdrawnByUid = new Map<string, number>();
  for (const doc of withdrawalsSnapshot.docs) {
    const record = doc.data();
    const uid = firstString(record.uid, record.user_id, record.usuario_id);
    if (!uid) continue;
    const amount = parseFinancialValue(record.valor ?? record.valor_bruto);
    withdrawnByUid.set(uid, (withdrawnByUid.get(uid) || 0) + amount);
  }

  const investedByUid = new Map<string, number>();
  const investorUids = new Set<string>();
  for (const doc of purchasesSnapshot.docs) {
    const purchase = doc.data();
    const uid = firstString(purchase.user_id, purchase.uid);
    if (!uid) continue;
    const amount = parseFinancialValue(purchase.preco_pago ?? purchase.valor);
    investedByUid.set(uid, (investedByUid.get(uid) || 0) + amount);
    if (isQualifyingInvestorPurchase(purchase.preco_pago)) {
      investorUids.add(uid);
    }
  }

  const users = usersSnapshot.docs.map((doc) => {
    const profile = doc.data();
    const uid = doc.id;
    const authUser = authUsers.get(uid);
    const profileStatus = profile.status === 'bloqueado' || profile.status === 'congelado'
      ? profile.status
      : 'ativo';
    const saldoValue = profile.saldo ?? profile.balance;
    const withdrawnValue = profile.total_retirado ?? profile.totalWithdrawn;
    const investedValue = profile.total_investido ?? profile.totalInvested;

    return {
      uid,
      nome: profile.nome_completo || profile.nome_exibicao || profile.nome || profile.name || authUser?.displayName,
      email: profile.email || authUser?.email,
      telefone: profile.telefone || profile.phone || profile.phoneNumber || authUser?.phoneNumber,
      auth_exists: !!authUser,
      is_investidor: investorUids.has(uid),
      saldo: saldoValue === undefined || saldoValue === null ? null : parseFinancialValue(saldoValue),
      total_retirado: withdrawnValue === undefined || withdrawnValue === null
        ? (withdrawnByUid.get(uid) || 0)
        : parseFinancialValue(withdrawnValue),
      total_investido: investedValue === undefined || investedValue === null
        ? (investedByUid.get(uid) || 0)
        : parseFinancialValue(investedValue),
      convite_code: profile.convite_code || profile.codigo_meu_refferal || profile.codigo_convite,
      patrocinador: profile.patrocinador || profile.patrocinador_id || profile.referred_by,
      status: authUser?.disabled ? 'congelado' : profileStatus,
      criado_em: profile.criado_em || profile.created_at,
    };
  });
  const list = query
    ? users.filter((user) => {
      if (searchField === 'uid') return user.uid.toLowerCase().includes(query);
      if (searchField === 'telefone') return user.telefone?.toLowerCase().includes(query) || false;
      if (searchField === 'convite') return user.convite_code?.toLowerCase().includes(query) || false;
      return user.uid.toLowerCase().includes(query)
        || user.telefone?.toLowerCase().includes(query)
        || user.email?.toLowerCase().includes(query)
        || user.convite_code?.toLowerCase().includes(query);
    })
    : users;
  const investors = users.filter((user) => user.is_investidor).length;
  res.json({
    items: list,
    total: list.length,
    stats: { investors, normalUsers: users.length - investors },
  });
}));

adminRouter.post('/users/:uid/status', asyncRoute(async (req, res) => {
  const uid = req.params.uid;
  const { status, motivo } = req.body || {};
  if (status !== 'ativo' && status !== 'congelado') {
    res.status(400).json({ error: 'Status inválido. Use "ativo" ou "congelado".' });
    return;
  }

  const admin = adminFor(req);
  const userRef = db.collection('users').doc(uid);
  const auditRef = db.collection('admin_audit_logs').doc();
  if (uid === admin.uid && status === 'congelado') {
    throw new HttpError(400, 'Não pode desativar a sua própria conta administrativa.');
  }
  const authUser = await authUserForAdmin(uid, admin);

  const wasDisabled = authUser.disabled;
  try {
    await auth.updateUser(uid, { disabled: status === 'congelado' });
    if (status === 'congelado') {
      await auth.revokeRefreshTokens(uid);
    }
    const user = await db.runTransaction(async (transaction) => {
      const userSnapshot = await transaction.get(userRef);
      if (!userSnapshot.exists) throw new HttpError(404, `Utilizador ${uid} não encontrado.`);
      const previous: DocumentData = userSnapshot.data() || {};
      const updated: DocumentData = { ...previous, uid, status };
      const now = new Date().toISOString();
      const audit: AuditLogRecord = {
        id: auditRef.id,
        admin_uid: admin.uid,
        admin_email: admin.email,
        acao: status === 'congelado' ? 'CONGELAR_CONTA' : 'DESCONGELAR_CONTA',
        entidade: 'users',
        entidade_id: uid,
        decisao: status === 'congelado' ? 'desativado' : 'ativado',
        motivo: typeof motivo === 'string' && motivo.trim() ? motivo.trim() : 'Ação administrativa de suporte',
        data: now,
        dados_anteriores: { status: previous.status || 'ativo', auth_disabled: wasDisabled },
        dados_novos: { status, auth_disabled: status === 'congelado' },
      };
      transaction.set(userRef, updated, { merge: true });
      transaction.set(auditRef, audit);
      return updated;
    });
    res.json({
      success: true,
      message: status === 'congelado'
        ? `A conta ${uid} foi desativada no Firebase Authentication.`
        : `A conta ${uid} foi reativada no Firebase Authentication.`,
      user: {
        ...user,
        email: user.email || authUser.email,
        telefone: user.telefone || authUser.phoneNumber,
      },
    });
  } catch (error) {
    try {
      await auth.updateUser(uid, { disabled: wasDisabled });
    } catch (rollbackError) {
      console.error(`Falha ao reverter estado de autenticação do utilizador ${uid}:`, rollbackError);
      throw new Error(`A atualização do Firestore falhou e o estado de autenticação da conta ${uid} precisa ser verificado no Firebase Console.`);
    }
    throw error;
  }
}));

adminRouter.post('/users/:uid/balance', asyncRoute(async (req, res) => {
  const uid = req.params.uid;
  const admin = adminFor(req);
  const value = req.body?.balance;
  const parsedBalance = typeof value === 'number' || typeof value === 'string'
    ? Number(value)
    : Number.NaN;
  const roundedBalance = Math.round(parsedBalance * 100) / 100;
  if (
    !Number.isFinite(parsedBalance)
    || parsedBalance < 0
    || !Number.isSafeInteger(Math.round(parsedBalance * 100))
    || Math.abs(parsedBalance * 100 - Math.round(parsedBalance * 100)) > 1e-8
    || !Number.isFinite(roundedBalance)
  ) {
    throw new HttpError(400, 'Informe um saldo válido, igual ou superior a zero, com no máximo duas casas decimais.');
  }

  await authUserForAdmin(uid, admin);
  const userRef = db.collection('users').doc(uid);
  const auditRef = db.collection('admin_audit_logs').doc();
  const motivo = typeof req.body?.motivo === 'string' && req.body.motivo.trim()
    ? req.body.motivo.trim().slice(0, 500)
    : 'Ajuste administrativo de saldo.';
  await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(userRef);
    if (!snapshot.exists) throw new HttpError(404, `Utilizador ${uid} não encontrado.`);
    const profile = snapshot.data() || {};
    const previousBalance = optionalFinancialValue(profile.saldo ?? profile.balance);
    if (previousBalance === null) {
      throw new HttpError(409, `O saldo atual do utilizador ${uid} não está disponível.`);
    }
    const now = new Date().toISOString();
    const audit: AuditLogRecord = {
      id: auditRef.id,
      admin_uid: admin.uid,
      admin_email: admin.email,
      acao: 'ALTERAR_SALDO_UTILIZADOR',
      entidade: 'users',
      entidade_id: uid,
      decisao: 'atualizado',
      motivo,
      data: now,
      dados_anteriores: { saldo: previousBalance },
      dados_novos: { saldo: roundedBalance },
    };
    transaction.set(userRef, {
      saldo: roundedBalance,
      balance: roundedBalance,
      atualizado_em: now,
    }, { merge: true });
    transaction.set(auditRef, audit);
  });

  res.json({ success: true, message: `Saldo de ${uid} atualizado para ${roundedBalance.toFixed(2)} KZ.` });
}));

adminRouter.post('/users/:uid/password', asyncRoute(async (req, res) => {
  const uid = req.params.uid;
  const password = req.body?.password;
  if (!isValidAdminPassword(password)) {
    throw new HttpError(400, 'A nova palavra-passe deve ter entre 6 e 4096 caracteres.');
  }

  const admin = adminFor(req);
  await authUserForAdmin(uid, admin);
  const now = new Date().toISOString();
  const auditRef = db.collection('admin_audit_logs').doc();
  const audit: AuditLogRecord = {
    id: auditRef.id,
    admin_uid: admin.uid,
    admin_email: admin.email,
    acao: 'REDEFINIR_SENHA_UTILIZADOR',
    entidade: 'users',
    entidade_id: uid,
    decisao: 'em_andamento',
    motivo: 'Redefinição administrativa de palavra-passe.',
    data: now,
    dados_novos: { palavra_passe_redefinida: false, sessoes_revogadas: false },
  };
  await auditRef.set(audit);
  let passwordUpdated = false;
  let sessionsRevoked = false;
  let auditUpdated = false;
  try {
    await auth.updateUser(uid, { password });
    passwordUpdated = true;
    await auth.revokeRefreshTokens(uid);
    sessionsRevoked = true;
    await auditRef.set({
      ...audit,
      decisao: 'atualizado',
      dados_novos: { palavra_passe_redefinida: true, sessoes_revogadas: true },
    });
  } catch (error) {
    try {
      await auditRef.set({
        ...audit,
        decisao: passwordUpdated ? 'atualizado' : 'rejeitado',
        motivo: passwordUpdated && !sessionsRevoked
          ? 'A senha foi alterada, mas não foi possível terminar as sessões anteriores.'
          : audit.motivo,
        dados_novos: {
          palavra_passe_redefinida: passwordUpdated,
          sessoes_revogadas: sessionsRevoked,
        },
      });
      auditUpdated = true;
    } catch (auditError) {
      console.error(`Falha ao atualizar a auditoria da redefinição de senha do utilizador ${uid}:`, auditError);
    }

    if (sessionsRevoked && auditUpdated) {
      res.json({
        success: true,
        message: `Palavra-passe de ${uid} redefinida. As sessões anteriores foram terminadas.`,
      });
      return;
    }
    if (passwordUpdated && !sessionsRevoked) {
      throw new HttpError(503, 'A senha foi alterada, mas não foi possível terminar as sessões anteriores. Verifique o estado da conta antes de repetir.');
    }
    if (sessionsRevoked) {
      throw new HttpError(503, 'A senha foi alterada e as sessões foram terminadas, mas não foi possível concluir a auditoria. Verifique os registos antes de repetir.');
    }
    throw error;
  }

  res.json({
    success: true,
    message: `Palavra-passe de ${uid} redefinida. As sessões anteriores foram terminadas.`,
  });
}));

adminRouter.get('/audit-logs', asyncRoute(async (req, res) => {
  const { admin_uid, acao, entidade } = req.query;
  const limit = pageNumber(req.query.limit, 100, 500);
  const snapshot = await db.collection('admin_audit_logs').orderBy('data', 'desc').limit(5000).get();
  let logs = snapshot.docs.map((doc) => recordFromSnapshot<AuditLogRecord>(doc));
  if (typeof admin_uid === 'string' && admin_uid) {
    logs = logs.filter((log) => log.admin_uid === admin_uid || log.admin_email.includes(admin_uid));
  }
  if (typeof acao === 'string' && acao && acao !== 'todas') {
    logs = logs.filter((log) => log.acao === acao);
  }
  if (typeof entidade === 'string' && entidade && entidade !== 'todas') {
    logs = logs.filter((log) => log.entidade === entidade);
  }
  res.json({ items: logs.slice(0, limit), total: logs.length });
}));

app.use('/api/admin', adminRouter);

const isProduction = process.env.NODE_ENV === 'production';
if (!isProduction) {
  const vite = await createViteServer({ server: { middlewareMode: true }, appType: 'spa' });
  app.use(vite.middlewares);
} else {
  const distDir = path.resolve(process.cwd(), 'dist');
  app.use(express.static(distDir));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/') || !req.accepts('html')) {
      next();
      return;
    }
    res.sendFile(path.join(distDir, 'index.html'), (error) => {
      if (error) next(error);
    });
  });
}

app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (error instanceof HttpError) {
    res.status(error.status).json({ error: error.message });
    return;
  }
  console.error('Erro não tratado na API administrativa:', error);
  if (
    typeof error === 'object'
    && error !== null
    && 'code' in error
    && error.code === 'app/invalid-credential'
  ) {
    res.status(503).json({
      error: 'O servidor ainda não tem credenciais do Firebase Admin. Configure GOOGLE_APPLICATION_CREDENTIALS com o caminho do JSON da conta de serviço e reinicie npm run dev.',
    });
    return;
  }
  res.status(500).json({ error: 'Ocorreu um erro interno ao processar o pedido.' });
});

const port = Number(process.env.PORT) || 3000;
app.listen(port, '0.0.0.0', () => {
  console.log(`Teggram-X Admin a escutar na porta ${port}.`);
});
