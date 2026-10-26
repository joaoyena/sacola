/**
 * Core business and financial logic for Teggram-X Admin Portal
 * All calculations, permission checks, formatting and invariant enforcements are pure functions.
 */

export interface TokenClaims {
  admin?: boolean;
  role?: 'superadmin' | 'admin' | 'moderator' | 'user';
  email?: string;
  email_verified?: boolean;
}

export function isValidFirebaseUid(value: unknown): value is string {
  return typeof value === 'string'
    && value.length > 0
    && value.length <= 128
    && value.trim() === value
    && !value.includes('/');
}

export function isValidAdminPassword(value: unknown): value is string {
  return typeof value === 'string' && value.length >= 6 && value.length <= 4096;
}

export const INVESTOR_MINIMUM_PURCHASE = 12000;

export function isQualifyingInvestorPurchase(price: unknown): boolean {
  if (typeof price !== 'number' && typeof price !== 'string') return false;
  if (typeof price === 'string' && !price.trim()) return false;
  const amount = typeof price === 'number' ? price : Number(price.trim());
  return Number.isFinite(amount) && amount >= INVESTOR_MINIMUM_PURCHASE;
}

export interface UserAccount {
  uid: string;
  telefone?: string;
  email?: string;
  saldo: number | string;
  balance?: number | string;
  total_retirado: number | string;
  total_investido?: number | string;
  convite_code?: string;
  patrocinador?: string;
  status: 'ativo' | 'congelado' | 'bloqueado';
  criado_em?: string;
}

export interface PaymentBotRecord {
  id: string;
  uid: string;
  user_nome?: string;
  user_telefone?: string;
  banco_destino?: string;
  valor: number | string;
  metodo: string; // 'multicaixa_express' | 'banco_bai' | 'banco_bfa' | 'usdt'
  status: string;
  criado_em: string;
  atualizado_em?: string;
  comprovativo_url?: string; // Legado
  detalhes_transacao?: {
    comprovativo_url?: string;
    multicaixaexpress?: string;
    banco_origem?: string;
    iban_origem?: string;
    titular_origem?: string;
    referencia?: string;
  };
  decisao?: {
    admin_uid: string;
    admin_email?: string;
    data: string;
    motivo?: string;
    idempotency_key?: string;
  };
}

export function normalizeRechargeStatus(status: unknown): string {
  if (typeof status !== 'string') return 'estado_indisponivel';
  const normalized = status.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  if (['pendente', 'pending'].includes(normalized)) return 'pendente';
  if (['aprovado', 'aprovada', 'approved', 'concluido', 'concluida', 'completado', 'completada', 'completed', 'pago', 'paid'].includes(normalized)) {
    return 'concluido';
  }
  if (['rejeitado', 'rejeitada', 'rejected', 'recusado', 'recusada'].includes(normalized)) return 'rejeitado';
  return normalized || 'estado_indisponivel';
}

export interface RetiradaRecord {
  id: string;
  uid: string;
  user_nome?: string;
  user_telefone?: string;
  valor: number;
  valor_bruto: number;
  valor_liquido: number;
  taxa: number;
  status: string;
  criado_em: string;
  atualizado_em?: string;
  dados_bancarios_snapshot?: {
    banco: string;
    iban: string;
    titular: string;
    conta?: string;
    telefone_express?: string;
  };
  comprovativo_pagamento_url?: string;
  decisao?: {
    admin_uid: string;
    admin_email?: string;
    data: string;
    motivo?: string;
    idempotency_key?: string;
  };
}

export function normalizeWithdrawalStatus(status: unknown): 'pendente' | 'concluido' | 'rejeitado' | 'estado_indisponivel' {
  if (typeof status !== 'string') return 'estado_indisponivel';
  const normalized = status.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (['pendente', 'pending'].includes(normalized)) return 'pendente';
  if (['pago', 'paid', 'concluido', 'concluida', 'sucesso', 'success'].includes(normalized)) return 'concluido';
  if (['rejeitado', 'rejeitada', 'rejected', 'cancelado', 'cancelada'].includes(normalized)) return 'rejeitado';
  return 'estado_indisponivel';
}

export interface ExtratoRecord {
  id: string;
  uid: string;
  tipo: 'recarga' | 'retirada' | 'reembolso_retirada' | 'rendimento_bot' | 'comissao';
  valor: number;
  saldo_anterior: number;
  saldo_posterior: number;
  descricao: string;
  referencia_id: string;
  status: 'concluido' | 'estornado' | 'falha';
  criado_em: string;
}

export interface ProdutoRecord {
  id: string;
  nome: string;
  preco: number | string; // Can be string "10000.00" or number
  renda_diaria: number | string;
  duracao_dias: number;
  limite_compra: number;
  ativo: boolean;
  categoria?: string;
  descricao?: string;
}

export interface CouponRecord {
  id: string;
  codigo_cupom: string;
  valor: number;
  ativo: boolean;
  resgates?: unknown[];
  resgatados_user_ids?: string[];
  usos_restantes?: number;
  created_at?: string;
  updated_at?: string;
}

export function validateCouponData(data: {
  codigo_cupom?: unknown;
  valor?: unknown;
  ativo?: unknown;
}): {
  valid: boolean;
  error?: string;
  normalized?: Pick<CouponRecord, 'codigo_cupom' | 'valor' | 'ativo'>;
} {
  const codigo = typeof data.codigo_cupom === 'string'
    ? data.codigo_cupom.trim().toUpperCase()
    : '';
  if (!/^[A-Z0-9_-]{4,32}$/.test(codigo)) {
    return {
      valid: false,
      error: 'O código deve ter entre 4 e 32 caracteres (letras, números, hífen ou sublinhado).',
    };
  }

  const valor = typeof data.valor === 'number' || typeof data.valor === 'string'
    ? Number(data.valor)
    : Number.NaN;
  if (!Number.isFinite(valor) || valor <= 0) {
    return { valid: false, error: 'O valor do cupom deve ser um número superior a zero.' };
  }
  if (typeof data.ativo !== 'boolean') {
    return { valid: false, error: 'O estado do cupom deve ser ativo ou inativo.' };
  }

  return { valid: true, normalized: { codigo_cupom: codigo, valor, ativo: data.ativo } };
}

export interface AuditLogRecord {
  id: string;
  admin_uid: string;
  admin_email: string;
  acao: string;
  entidade: 'paymentbot' | 'retiradas' | 'produtos' | 'pasta' | 'users' | 'cupons';
  entidade_id: string;
  data: string;
  decisao: 'aprovado' | 'rejeitado' | 'criado' | 'atualizado' | 'desativado' | 'ativado' | 'excluido' | 'em_andamento';
  motivo?: string;
  dados_anteriores?: Record<string, unknown>;
  dados_novos?: Record<string, unknown>;
  ip_address?: string;
}

/**
 * Validates if the user claims contain a genuine admin authorization.
 * Strict check: does not trust email addresses or client flags.
 */
export function hasAdminAccess(claims: TokenClaims | null | undefined): boolean {
  if (!claims) return false;
  return claims.admin === true || claims.role === 'admin' || claims.role === 'superadmin';
}

/**
 * Validates if user has superadmin rights for sensitive operations (e.g. assigning roles).
 */
export function hasSuperAdminAccess(claims: TokenClaims | null | undefined): boolean {
  if (!claims) return false;
  return claims.role === 'superadmin';
}

/**
 * Safely parses financial values that might arrive as decimal strings or numbers.
 * Enforces two decimal places precision to prevent floating-point inaccuracy.
 */
export function parseFinancialValue(val: number | string | undefined | null): number {
  if (val === undefined || val === null) return 0;
  if (typeof val === 'number') {
    if (isNaN(val) || !isFinite(val)) return 0;
    return Math.round(val * 100) / 100;
  }
  const cleaned = String(val).replace(/[^0-9.-]/g, '').trim();
  const parsed = parseFloat(cleaned);
  if (isNaN(parsed) || !isFinite(parsed)) return 0;
  return Math.round(parsed * 100) / 100;
}

/**
 * Formats currency in Angolan Kwanza (AOA) or generic format.
 */
export function formatCurrency(amount: number | string | undefined | null, currency = 'KZ'): string {
  const num = parseFinancialValue(amount);
  return `${new Intl.NumberFormat('pt-AO', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num)} ${currency}`;
}

/**
 * Safely extracts proof receipt URL from either current schema or legacy schema.
 */
export function extractReceiptUrl(record: Partial<PaymentBotRecord> | null | undefined): string | null {
  if (!record) return null;
  if (record.detalhes_transacao?.comprovativo_url) {
    const url = record.detalhes_transacao.comprovativo_url.trim();
    if (isValidProofUrl(url)) return url;
  }
  if (record.comprovativo_url) {
    const url = record.comprovativo_url.trim();
    if (isValidProofUrl(url)) return url;
  }
  return null;
}

/**
 * Basic security check for proof URL to prevent javascript: or malformed URLs
 */
export function isValidProofUrl(url: string | undefined | null): boolean {
  if (!url) return false;
  const trimmed = url.trim();
  if (trimmed.startsWith('javascript:') || trimmed.startsWith('data:text/html')) {
    return false;
  }
  return trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('data:image/');
}

/**
 * Masks IBAN for secure display on summary lists, showing only country and last 4 digits.
 */
export function maskIban(iban: string | undefined | null): string {
  if (!iban) return '---';
  const clean = iban.replace(/\s+/g, '');
  if (clean.length < 8) return '****';
  const prefix = clean.substring(0, 4);
  const suffix = clean.substring(clean.length - 4);
  return `${prefix} •••• •••• •••• ${suffix}`;
}

/**
 * Masks phone number for privacy on list screens.
 */
export function maskPhone(phone: string | undefined | null): string {
  if (!phone) return '---';
  const clean = phone.replace(/\s+/g, '');
  if (clean.length <= 4) return '****';
  const suffix = clean.slice(-4);
  return `+••• ••• ${suffix}`;
}

/**
 * Validates transition for a recharge request.
 * Enforces idempotency and prevents re-processing settled items.
 */
export function validateRechargeTransition(
  currentRecord: PaymentBotRecord,
  action: 'approve' | 'reject',
  reason?: string
): { valid: boolean; error?: string } {
  if (currentRecord.status !== 'pendente') {
    return {
      valid: false,
      error: `Pedido #${currentRecord.id} já se encontra com o estado '${currentRecord.status}' e não pode ser reprocessado.`,
    };
  }
  if (action === 'reject' && (!reason || reason.trim().length < 3)) {
    return {
      valid: false,
      error: 'Rejeição exige a especificação de um motivo válido (mínimo 3 caracteres).',
    };
  }
  const valor = parseFinancialValue(currentRecord.valor);
  if (valor <= 0) {
    return {
      valid: false,
      error: 'O valor da recarga deve ser estritamente superior a zero.',
    };
  }
  return { valid: true };
}

/**
 * Calculates the atomic balance mutation and new extrato entry for recharge approval.
 */
export function calculateRechargeApprovalMutation(
  user: UserAccount,
  record: PaymentBotRecord,
  adminUid: string,
  adminEmail: string
): {
  updatedUser: UserAccount;
  updatedRecord: PaymentBotRecord;
  extratoEntry: ExtratoRecord;
  auditLog: AuditLogRecord;
} {
  const valor = parseFinancialValue(record.valor);
  const now = new Date().toISOString();
  const saldoAnterior = parseFinancialValue(user.saldo);
  const saldoPosterior = parseFinancialValue(saldoAnterior + valor);

  const updatedUser: UserAccount = {
    ...user,
    saldo: saldoPosterior,
  };

  const updatedRecord: PaymentBotRecord = {
    ...record,
    status: 'concluido',
    atualizado_em: now,
    decisao: {
      admin_uid: adminUid,
      admin_email: adminEmail,
      data: now,
      idempotency_key: `recharge-${record.id}-${now}`,
    },
  };

  const extratoEntry: ExtratoRecord = {
    id: `ext_rec_${record.id}`,
    uid: user.uid,
    tipo: 'recarga',
    valor: valor,
    saldo_anterior: saldoAnterior,
    saldo_posterior: saldoPosterior,
    descricao: `Recarga aprovada via ${record.metodo.toUpperCase()} (Ref: #${record.id})`,
    referencia_id: record.id,
    status: 'concluido',
    criado_em: now,
  };

  const auditLog: AuditLogRecord = {
    id: `audit_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    admin_uid: adminUid,
    admin_email: adminEmail,
    acao: 'APROVAR_RECARGA',
    entidade: 'paymentbot',
    entidade_id: record.id,
    data: now,
    decisao: 'aprovado',
    dados_anteriores: { status: record.status, valor: record.valor },
    dados_novos: { status: 'concluido', valor: valor, creditado_ao_usuario: user.uid },
  };

  return { updatedUser, updatedRecord, extratoEntry, auditLog };
}

/**
 * Validates transition for a withdrawal request.
 */
export function validateWithdrawalTransition(
  currentRecord: RetiradaRecord,
  action: 'approve_paid' | 'reject',
  reason?: string,
  paidAmount?: number,
): { valid: boolean; error?: string } {
  if (currentRecord.status !== 'pendente') {
    return {
      valid: false,
      error: `Pedido de saque #${currentRecord.id} já está '${currentRecord.status}' e não pode ser alterado.`,
    };
  }
  if (action === 'reject' && (!reason || reason.trim().length < 3)) {
    return {
      valid: false,
      error: 'Rejeição de saque exige especificar o motivo para devolução do saldo ao cliente.',
    };
  }
  const amountToValidate = action === 'approve_paid'
    ? parseFinancialValue(currentRecord.valor_liquido || currentRecord.valor)
    : parseFinancialValue(currentRecord.valor || currentRecord.valor_bruto);
  if (amountToValidate <= 0) {
    return {
      valid: false,
      error: action === 'approve_paid' ? 'Valor líquido de saque inválido.' : 'Valor a estornar inválido.',
    };
  }
  if (action === 'approve_paid') {
    if (paidAmount === undefined || !Number.isFinite(paidAmount)) {
      return { valid: false, error: 'Informe o valor efetivamente pago.' };
    }
    if (Math.round(paidAmount * 100) !== Math.round(amountToValidate * 100)) {
      return {
        valid: false,
        error: `O valor pago deve corresponder exatamente ao valor líquido de ${amountToValidate.toFixed(2)} KZ.`,
      };
    }
  }
  return { valid: true };
}

/**
 * Calculates atomic mutations for withdrawal approval (paid out) or rejection (refunded).
 */
export function calculateWithdrawalMutation(
  user: UserAccount,
  record: RetiradaRecord,
  action: 'approve_paid' | 'reject',
  adminUid: string,
  adminEmail: string,
  options?: { reason?: string }
): {
  updatedUser: UserAccount;
  updatedRecord: RetiradaRecord;
  extratoEntry?: ExtratoRecord;
  auditLog: AuditLogRecord;
} {
  const now = new Date().toISOString();
  const valorBruto = parseFinancialValue(record.valor || record.valor_bruto);

  if (action === 'approve_paid') {
    // When approved/paid: User balance was already debited when request was placed.
    // We increment user.total_retirado to keep financial statistics accurate.
    const updatedUser: UserAccount = {
      ...user,
      total_retirado: parseFinancialValue(parseFinancialValue(user.total_retirado) + valorBruto),
    };

    const updatedRecord: RetiradaRecord = {
      ...record,
      status: 'concluido',
      atualizado_em: now,
      decisao: {
        admin_uid: adminUid,
        admin_email: adminEmail,
        data: now,
        idempotency_key: `withdraw-${record.id}-${now}`,
      },
    };

    const auditLog: AuditLogRecord = {
      id: `audit_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      admin_uid: adminUid,
      admin_email: adminEmail,
      acao: 'PAGAR_SAQUE',
      entidade: 'retiradas',
      entidade_id: record.id,
      data: now,
      decisao: 'aprovado',
      dados_anteriores: { status: record.status },
      dados_novos: { status: 'concluido', valor_liquido: record.valor_liquido },
    };

    return { updatedUser, updatedRecord, auditLog };
  } else {
    // When rejected: Funds must be restored to user's balance!
    const saldoAnterior = parseFinancialValue(user.saldo);
    const saldoPosterior = parseFinancialValue(saldoAnterior + parseFinancialValue(record.valor));

    const updatedUser: UserAccount = {
      ...user,
      saldo: saldoPosterior,
    };

    const updatedRecord: RetiradaRecord = {
      ...record,
      status: 'rejeitado',
      atualizado_em: now,
      decisao: {
        admin_uid: adminUid,
        admin_email: adminEmail,
        data: now,
        motivo: options?.reason,
        idempotency_key: `withdraw-reject-${record.id}-${now}`,
      },
    };

    const extratoEntry: ExtratoRecord = {
      id: `ext_reemb_${record.id}`,
      uid: user.uid,
      tipo: 'reembolso_retirada',
      valor: parseFinancialValue(record.valor),
      saldo_anterior: saldoAnterior,
      saldo_posterior: saldoPosterior,
      descricao: `Reembolso de saque #${record.id} cancelado: ${options?.reason || 'Rejeitado por admin'}`,
      referencia_id: record.id,
      status: 'concluido',
      criado_em: now,
    };

    const auditLog: AuditLogRecord = {
      id: `audit_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      admin_uid: adminUid,
      admin_email: adminEmail,
      acao: 'REJEITAR_SAQUE',
      entidade: 'retiradas',
      entidade_id: record.id,
      data: now,
      decisao: 'rejeitado',
      motivo: options?.reason,
      dados_anteriores: { status: record.status },
      dados_novos: { status: 'rejeitado', estorno_creditado: parseFinancialValue(record.valor) },
    };

    return { updatedUser, updatedRecord, extratoEntry, auditLog };
  }
}

/**
 * Validates product parameters according to Teggram-X system rules.
 * Handles both string decimals and numeric values.
 */
export function validateProductData(data: Partial<ProdutoRecord>): { valid: boolean; error?: string; normalized?: ProdutoRecord } {
  if (!data.nome || data.nome.trim().length < 2) {
    return { valid: false, error: 'O nome do bot/produto é obrigatório (mínimo 2 caracteres).' };
  }
  const preco = parseFinancialValue(data.preco);
  if (preco <= 0) {
    return { valid: false, error: 'O preço deve ser superior a zero.' };
  }
  const renda = parseFinancialValue(data.renda_diaria);
  if (renda <= 0) {
    return { valid: false, error: 'A renda diária deve ser superior a zero.' };
  }
  const duracao = Number(data.duracao_dias);
  if (!duracao || duracao < 1 || !Number.isInteger(duracao)) {
    return { valid: false, error: 'A duração deve ser de pelo menos 1 dia (número inteiro).' };
  }
  const limite = Number(data.limite_compra);
  if (!Number.isFinite(limite) || limite < 1 || !Number.isInteger(limite)) {
    return { valid: false, error: 'O limite de compra por utilizador deve ser um número inteiro de pelo menos 1.' };
  }

  const id = data.id && data.id.trim().length > 0
    ? data.id.trim()
    : `bot_${data.nome.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${duracao}d`;
  if (id.includes('/')) {
    return { valid: false, error: 'O ID do produto não pode conter barras (/).' };
  }

  return {
    valid: true,
    normalized: {
      id,
      nome: data.nome.trim(),
      preco: preco.toFixed(2), // Keep standard decimal string format used in Teggram-X
      renda_diaria: renda.toFixed(2),
      duracao_dias: duracao,
      limite_compra: limite,
      ativo: Boolean(data.ativo),
      categoria: data.categoria || 'Bots IA',
      descricao: data.descricao?.trim() || `Bot automatizado de rendimento ${renda.toFixed(2)} KZ/dia por ${duracao} dias`,
    },
  };
}
