export type AdminRole = 'superadmin' | 'admin' | 'user';

export interface AdminUser {
  uid: string;
  email: string;
  role: AdminRole;
  isSuperAdmin: boolean;
  token?: string;
}

export interface DashboardMetrics {
  counts: {
    pendingRecharges: number;
    pendingWithdrawals: number;
    totalUsers: number;
    delayedAlerts: number;
  };
  volumes: {
    pendingRechargeAmount: number;
    pendingWithdrawalAmount: number;
  };
  alerts: Array<{
    tipo: string;
    mensagem: string;
    id: string;
    rota: string;
  }>;
  recentAuditLogs: AuditLog[];
}

export interface AuditLog {
  id: string;
  admin_uid: string;
  admin_email: string;
  acao: string;
  entidade: 'paymentbot' | 'retiradas' | 'produtos' | 'pasta' | 'users';
  entidade_id: string;
  data: string;
  decisao: string;
  motivo?: string;
  dados_anteriores?: Record<string, unknown>;
  dados_novos?: Record<string, unknown>;
}

export interface RechargeItem {
  id: string;
  uid?: string;
  user_nome?: string;
  user_telefone?: string;
  banco_destino?: string;
  valor: number | string;
  metodo?: string;
  status: 'pendente' | 'concluido' | 'rejeitado' | string;
  criado_em: string;
  atualizado_em?: string;
  comprovativo_url?: string;
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

export interface WithdrawalItem {
  id: string;
  uid: string;
  user_nome?: string;
  user_telefone?: string;
  valor: number | string;
  valor_bruto?: number | string;
  valor_liquido?: number | string;
  taxa?: number | string;
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

export interface ProductItem {
  id: string;
  nome: string;
  preco: string | number;
  renda_diaria: string | number;
  duracao_dias: number;
  limite_compra: number;
  ativo: boolean;
  categoria?: string;
  descricao?: string;
  criado_em?: string;
  atualizado_em?: string;
}

export interface PaymentMethodItem {
  id: string;
  documentId?: string;
  itemKey?: string;
  activeField?: string;
  isNew?: boolean;
  tipo: 'multicaixa_express' | 'banco' | 'cripto';
  nome: string;
  banco?: string;
  iban?: string;
  conta?: string;
  telefone?: string;
  titular: string;
  rede?: string;
  endereco?: string;
  instrucoes?: string;
  ativo?: boolean;
  ordem?: number;
  taxa_deposito_percent?: number;
  limite_minimo?: number;
  limite_maximo?: number;
  atualizado_em?: string;
}

export interface UserItem {
  uid: string;
  nome?: string;
  email?: string;
  telefone?: string;
  auth_exists?: boolean;
  is_investidor?: boolean;
  saldo: number | null;
  total_retirado: number | null;
  total_investido: number | null;
  convite_code?: string;
  patrocinador?: string;
  status: 'ativo' | 'congelado' | 'bloqueado';
  criado_em?: string;
}

export type UserSearchField = 'uid' | 'telefone' | 'convite';
