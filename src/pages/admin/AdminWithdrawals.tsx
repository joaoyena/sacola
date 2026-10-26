import React, { useState, useEffect } from 'react';
import {
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  RefreshCw,
  AlertCircle,
  Building2,
  Check,
  Copy,
  ExternalLink,
} from 'lucide-react';
import { WithdrawalItem } from '../../types/admin';
import { adminApi } from '../../services/adminApi';
import { formatCurrency, parseFinancialValue } from '../../lib/adminLogic';
import { ConfirmDialog } from '../../components/admin/ConfirmDialog';

interface AdminWithdrawalsProps {
  initialFilter?: string;
}

export const AdminWithdrawals: React.FC<AdminWithdrawalsProps> = ({ initialFilter = 'todos' }) => {
  const [withdrawals, setWithdrawals] = useState<WithdrawalItem[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>(initialFilter);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Modals state
  const [confirmAction, setConfirmAction] = useState<{
    type: 'pay' | 'reject';
    record: WithdrawalItem;
  } | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [copiedField, setCopiedField] = useState<'iban' | 'amount' | null>(null);

  const fetchWithdrawals = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await adminApi.getWithdrawals({
        status: statusFilter === 'todos' ? undefined : statusFilter,
      });
      setWithdrawals(data.items);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar lista de saques.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWithdrawals();
  }, [statusFilter]);

  useEffect(() => {
    setStatusFilter(initialFilter);
  }, [initialFilter]);

  useEffect(() => {
    setCopiedField(null);
  }, [confirmAction?.record.id, confirmAction?.type]);

  const handlePay = async (extraData?: { valorPago?: number }) => {
    if (!confirmAction || confirmAction.type !== 'pay') return;
    if (extraData?.valorPago === undefined) {
      setError('Informe o valor exato que foi pago antes de confirmar.');
      return;
    }
    setIsProcessing(true);
    try {
      const result = await adminApi.payWithdrawal(confirmAction.record.id, extraData.valorPago);
      setSuccessMessage(result.message);
      setConfirmAction(null);
      await fetchWithdrawals();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Falha ao processar pagamento de saque.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReject = async (extraData?: { motivo?: string }) => {
    if (!confirmAction || confirmAction.type !== 'reject') return;
    if (!extraData?.motivo || extraData.motivo.length < 3) {
      setError('O motivo da rejeição é obrigatório para estornar os fundos.');
      return;
    }
    setIsProcessing(true);
    try {
      const result = await adminApi.rejectWithdrawal(confirmAction.record.id, extraData.motivo);
      setSuccessMessage(result.message);
      setConfirmAction(null);
      await fetchWithdrawals();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Falha ao rejeitar saque.');
    } finally {
      setIsProcessing(false);
    }
  };

  const filteredItems = withdrawals.filter((w) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      String(w.id || '').toLowerCase().includes(term) ||
      String(w.uid || '').toLowerCase().includes(term) ||
      (w.user_telefone && w.user_telefone.includes(term)) ||
      (w.user_nome && w.user_nome.toLowerCase().includes(term)) ||
      (w.dados_bancarios_snapshot?.banco && w.dados_bancarios_snapshot.banco.toLowerCase().includes(term)) ||
      (w.dados_bancarios_snapshot?.titular && w.dados_bancarios_snapshot.titular.toLowerCase().includes(term))
    );
  });
  const payoutIban = confirmAction?.type === 'pay'
    ? confirmAction.record.dados_bancarios_snapshot?.iban?.trim() || ''
    : '';
  const payoutAmount = confirmAction?.type === 'pay'
    ? parseFinancialValue(confirmAction.record.valor_liquido ?? confirmAction.record.valor)
    : undefined;

  const copyPayoutValue = async (value: string, field: 'iban' | 'amount', label: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedField(field);
      setError(null);
      setSuccessMessage(`${label} copiado.`);
    } catch {
      setError(`Não foi possível copiar ${label.toLowerCase()}. Verifique as permissões do navegador.`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight">
            Gestão de Saques (Retiradas)
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Consulte os dados bancários, registe transferências realizadas e devolva o saldo em caso de recusa.
          </p>
        </div>
        <button
          onClick={fetchWithdrawals}
          disabled={loading}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-800 hover:bg-slate-800 text-xs text-slate-300 transition-colors self-start sm:self-auto disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-cyan-400' : ''}`} />
          <span>Atualizar</span>
        </button>
      </div>

      {/* Notifications */}
      {successMessage && (
        <div className="p-3.5 rounded-xl bg-emerald-950/60 border border-emerald-800/80 text-emerald-200 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>{successMessage}</span>
          </div>
          <button onClick={() => setSuccessMessage(null)} className="text-emerald-400 hover:text-white">
            ✕
          </button>
        </div>
      )}

      {error && (
        <div className="p-3.5 rounded-xl bg-rose-950/60 border border-rose-800/80 text-rose-200 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)} className="text-rose-400 hover:text-white">
            ✕
          </button>
        </div>
      )}

      {/* Search and Filters */}
      <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl flex flex-col sm:flex-row gap-4 items-center justify-between">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 transform -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Pesquisar por ID, Titular, Banco..."
            className="w-full pl-9 pr-4 py-2 text-xs bg-slate-950 border border-slate-800 rounded-xl text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
          <Filter className="w-3.5 h-3.5 text-slate-500 shrink-0" />
          <span className="text-xs text-slate-400 shrink-0">Status:</span>
          {['todos', 'pendente', 'sucesso', 'rejeitado'].map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors shrink-0 ${
                statusFilter === s
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Withdrawals Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-lg">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950/80 border-b border-slate-800 text-[11px] uppercase tracking-wider text-slate-400 font-semibold">
              <tr>
                <th className="px-5 py-3.5">ID / Data</th>
                <th className="px-4 py-3.5">Utilizador</th>
                <th className="px-4 py-3.5">Valores (Bruto / Líquido)</th>
                <th className="px-4 py-3.5">Dados Bancários (Snapshot)</th>
                <th className="px-4 py-3.5">Status</th>
                <th className="px-4 py-3.5">Comprovativo</th>
                <th className="px-5 py-3.5 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-500 text-xs">
                    {loading ? 'A carregar pedidos de saque...' : 'Nenhum pedido de saque encontrado com os filtros atuais.'}
                  </td>
                </tr>
              ) : (
                filteredItems.map((w) => {
                  const rawIban = w.dados_bancarios_snapshot?.iban;
                  const expressPhone = w.dados_bancarios_snapshot?.telefone_express;
                  const grossAmount = parseFinancialValue(w.valor ?? w.valor_bruto);
                  const netAmount = parseFinancialValue(w.valor_liquido ?? w.valor);
                  const feeAmount = parseFinancialValue(w.taxa) || Math.max(grossAmount - netAmount, 0);

                  return (
                    <tr key={w.id} className="hover:bg-slate-850/50 transition-colors">
                      <td className="px-5 py-4">
                        <div className="font-mono font-bold text-white">#{w.id}</div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          {w.criado_em && Number.isFinite(new Date(w.criado_em).getTime())
                            ? new Date(w.criado_em).toLocaleString('pt-AO')
                            : 'Data não disponível'}
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="font-mono text-cyan-400 text-xs">{w.uid}</div>
                        {w.user_nome && (
                          <div className="text-[11px] text-slate-300">{w.user_nome}</div>
                        )}
                        <div className="text-[11px] text-slate-400">
                          {w.user_telefone || 'Telefone não disponível'}
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="font-mono text-slate-100">
                          Bruto solicitado: <strong>{formatCurrency(grossAmount)}</strong>
                        </div>
                        <div className="text-[11px] text-slate-400 font-mono mt-1">
                          Taxa: {formatCurrency(feeAmount)}
                        </div>
                        <div className="font-mono font-bold text-emerald-400 text-sm mt-1">
                          A pagar: {formatCurrency(netAmount)}
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-1.5 font-medium text-slate-200">
                          <Building2 className="w-3.5 h-3.5 text-slate-400" />
                          <span>{w.dados_bancarios_snapshot?.banco || 'Banco não informado'}</span>
                        </div>
                        <div className="text-[11px] text-slate-400 truncate max-w-[200px]">
                          Titular da conta: {w.dados_bancarios_snapshot?.titular || 'Não informado'}
                        </div>
                        <div className="mt-1 break-all font-mono text-[11px] text-slate-300">
                          IBAN: {rawIban || 'Não informado'}
                        </div>
                        <div className="break-all font-mono text-[11px] text-slate-300">
                          Conta: {w.dados_bancarios_snapshot?.conta || 'Não informada'}
                        </div>
                        {expressPhone && expressPhone !== w.user_telefone && (
                          <div className="text-[11px] text-slate-400 font-mono">
                            Express: {expressPhone}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-4">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold uppercase tracking-wider ${
                            w.status === 'concluido'
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                              : w.status === 'rejeitado'
                              ? 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                              : 'bg-amber-500/10 text-amber-400 border border-amber-500/30 animate-pulse'
                          }`}
                        >
                          {w.status === 'concluido'
                            ? 'Sucesso'
                            : w.status === 'pendente'
                            ? 'Pendente'
                            : w.status === 'rejeitado'
                            ? 'Rejeitado'
                            : w.status}
                        </span>
                        {w.decisao?.motivo && (
                          <span
                            className="block text-[10px] text-rose-400 mt-1 max-w-[140px] truncate"
                            title={w.decisao.motivo}
                          >
                            {w.decisao.motivo}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-4">
                        {w.comprovativo_pagamento_url ? (
                          <a
                            href={w.comprovativo_pagamento_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[11px] text-cyan-400 hover:text-cyan-300 font-medium"
                          >
                            <ExternalLink className="w-3 h-3" />
                            <span>Ver Recibo</span>
                          </a>
                        ) : (
                          <span className="text-[11px] text-slate-500">Sem recibo</span>
                        )}
                      </td>
                      <td className="px-5 py-4 text-right">
                        {w.status === 'pendente' ? (
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => setConfirmAction({ type: 'pay', record: w })}
                              className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-[11px] flex items-center gap-1 transition-colors"
                              title="Registar a transferência bancária já realizada"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Confirmar transferência</span>
                            </button>
                            <button
                              onClick={() => setConfirmAction({ type: 'reject', record: w })}
                              className="px-2.5 py-1.5 rounded-lg bg-rose-950/60 hover:bg-rose-900/80 text-rose-300 border border-rose-800/80 font-medium text-[11px] flex items-center gap-1 transition-colors"
                              title="Rejeitar saque e estornar valor à conta do cliente"
                            >
                              <XCircle className="w-3.5 h-3.5" />
                              <span>Rejeitar</span>
                            </button>
                          </div>
                        ) : (
                          <span className="text-[11px] text-slate-500 font-mono">
                            Decidido por {w.decisao?.admin_email?.split('@')[0] || 'admin'}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Confirmation Dialog */}
      {confirmAction && (
        <ConfirmDialog
          isOpen={!!confirmAction}
          onClose={() => setConfirmAction(null)}
          onConfirm={confirmAction.type === 'pay' ? handlePay : handleReject}
          title={
            confirmAction.type === 'pay'
              ? `Confirmar pagamento: saque #${confirmAction.record.id}`
              : `Rejeitar Saque #${confirmAction.record.id}`
          }
          description={
            confirmAction.type === 'pay'
              ? (
                <div className="space-y-2">
                  <p>Confirme os dados da transferência que já efetuou:</p>
                  <p>Valor bruto solicitado: <strong>{formatCurrency(confirmAction.record.valor ?? confirmAction.record.valor_bruto)}</strong></p>
                  <p className="flex items-center justify-between gap-2">
                    <span>Valor líquido a pagar: <strong className="text-emerald-300">{formatCurrency(payoutAmount ?? 0)}</strong></span>
                    <button
                      type="button"
                      onClick={() => copyPayoutValue((payoutAmount ?? 0).toFixed(2), 'amount', 'Valor líquido')}
                      className="shrink-0 rounded-md p-1 text-slate-400 hover:bg-slate-800 hover:text-white"
                      aria-label="Copiar valor líquido"
                      title="Copiar valor líquido"
                    >
                      {copiedField === 'amount' ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
                    </button>
                  </p>
                  <p>Destinatário: <strong>{confirmAction.record.dados_bancarios_snapshot?.titular || 'Não informado'}</strong></p>
                  <p>Banco: <strong>{confirmAction.record.dados_bancarios_snapshot?.banco || 'Não informado'}</strong></p>
                  <p className="flex items-center justify-between gap-2">
                    <span className="min-w-0">IBAN: <strong className="break-all">{payoutIban || 'Não informado'}</strong></span>
                    {payoutIban && (
                      <button
                        type="button"
                        onClick={() => copyPayoutValue(payoutIban, 'iban', 'IBAN')}
                        className="shrink-0 rounded-md p-1 text-slate-400 hover:bg-slate-800 hover:text-white"
                        aria-label="Copiar IBAN"
                        title="Copiar IBAN"
                      >
                        {copiedField === 'iban' ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
                      </button>
                    )}
                  </p>
                  {confirmAction.record.dados_bancarios_snapshot?.conta?.trim() && (
                    <p>Conta: <strong>{confirmAction.record.dados_bancarios_snapshot.conta}</strong></p>
                  )}
                  <p>Telefone: <strong>{confirmAction.record.user_telefone || confirmAction.record.dados_bancarios_snapshot?.telefone_express || 'Não informado'}</strong></p>
                  <p className="text-slate-400">Esta opção apenas regista o pagamento no sistema; não envia dinheiro pelo banco.</p>
                </div>
              )
              : (
                <div className="space-y-2">
                  <p>O pedido será marcado como rejeitado e o valor debitado de <strong>{formatCurrency(confirmAction.record.valor)}</strong> será devolvido ao saldo do utilizador.</p>
                  <p>Informe o motivo para explicar por que o pedido foi rejeitado ou anulado.</p>
                  <p>Utilizador: <strong>{confirmAction.record.user_nome || confirmAction.record.uid}</strong></p>
                </div>
              )
          }
          confirmLabel={confirmAction.type === 'pay' ? 'Confirmar pagamento' : 'Rejeitar / Anular e Devolver Saldo'}
          variant={confirmAction.type === 'pay' ? 'success' : 'danger'}
          requireReason={confirmAction.type === 'reject'}
          reasonPlaceholder="Motivo do cancelamento (ex: titular divergente, IBAN com dígito de controlo inválido...)"
          expectedPaymentAmount={
            confirmAction.type === 'pay'
              ? parseFinancialValue(confirmAction.record.valor_liquido ?? confirmAction.record.valor)
              : undefined
          }
          isProcessing={isProcessing}
        />
      )}
    </div>
  );
};
