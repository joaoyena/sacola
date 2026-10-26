import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  Eye,
  FileText,
  Clock,
  ShieldCheck,
  RefreshCw,
  AlertCircle,
} from 'lucide-react';
import { RechargeItem } from '../../types/admin';
import { adminApi } from '../../services/adminApi';
import {
  formatCurrency,
  extractReceiptUrl,
  parseFinancialValue,
} from '../../lib/adminLogic';
import { ProofViewerModal } from '../../components/admin/ProofViewerModal';
import { ConfirmDialog } from '../../components/admin/ConfirmDialog';

interface AdminRechargesProps {
  initialFilter?: string;
}

export const AdminRecharges: React.FC<AdminRechargesProps> = ({ initialFilter = 'todos' }) => {
  const [recharges, setRecharges] = useState<RechargeItem[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [page, setPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(0);
  const [statusFilter, setStatusFilter] = useState<string>(initialFilter);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Modals state
  const [viewingProof, setViewingProof] = useState<{
    url: string | null;
    record: RechargeItem;
  } | null>(null);

  const [confirmAction, setConfirmAction] = useState<{
    type: 'approve' | 'reject';
    record: RechargeItem;
  } | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const requestSequence = useRef(0);

  const fetchRecharges = useCallback(async () => {
    const requestId = ++requestSequence.current;
    setLoading(true);
    setError(null);
    try {
      const data = await adminApi.getRecharges({
        status: statusFilter === 'todos' ? undefined : statusFilter,
        search: searchTerm.trim() || undefined,
        page,
        limit: 50,
      });
      if (requestId !== requestSequence.current) return;
      if (page > Math.max(data.totalPages, 1)) {
        setPage(Math.max(data.totalPages, 1));
        return;
      }
      setRecharges(data.items);
      setTotal(data.total);
      setTotalPages(data.totalPages);
    } catch (err: unknown) {
      if (requestId !== requestSequence.current) return;
      setError(err instanceof Error ? err.message : 'Erro ao carregar lista de recargas.');
    } finally {
      if (requestId === requestSequence.current) setLoading(false);
    }
  }, [statusFilter, searchTerm, page]);

  useEffect(() => {
    setStatusFilter(initialFilter);
    setPage(1);
  }, [initialFilter]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void fetchRecharges();
    }, searchTerm.trim() ? 300 : 0);
    return () => window.clearTimeout(timeout);
  }, [fetchRecharges, searchTerm]);

  const handleApprove = async () => {
    if (!confirmAction || confirmAction.type !== 'approve') return;
    setIsProcessing(true);
    try {
      const result = await adminApi.approveRecharge(confirmAction.record.id);
      setSuccessMessage(result.message);
      setConfirmAction(null);
      await fetchRecharges();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Falha ao aprovar recarga.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReject = async (extraData?: { motivo?: string }) => {
    if (!confirmAction || confirmAction.type !== 'reject') return;
    if (!extraData?.motivo || extraData.motivo.length < 3) {
      setError('O motivo da rejeição é obrigatório.');
      return;
    }
    setIsProcessing(true);
    try {
      const result = await adminApi.rejectRecharge(confirmAction.record.id, extraData.motivo);
      setSuccessMessage(result.message);
      setConfirmAction(null);
      await fetchRecharges();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Falha ao rejeitar recarga.');
    } finally {
      setIsProcessing(false);
    }
  };

  const filteredItems = recharges;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight">
            Gestão de Recargas (PaymentBot)
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Revisão de comprovativos bancários, aprovação idempotente e crédito direto em conta
          </p>
        </div>
        <button
          onClick={fetchRecharges}
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
          <button
            onClick={() => setSuccessMessage(null)}
            className="text-emerald-400 hover:text-white"
          >
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

      {/* Filter and Search Bar */}
      <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl flex flex-col sm:flex-row gap-4 items-center justify-between">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 transform -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setPage(1);
            }}
            placeholder="Pesquisar por ID, telefone, utilizador ou referência..."
            className="w-full pl-9 pr-4 py-2 text-xs bg-slate-950 border border-slate-800 rounded-xl text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
          <Filter className="w-3.5 h-3.5 text-slate-500 shrink-0" />
          <span className="text-xs text-slate-400 shrink-0">Status:</span>
          {['todos', 'pendente', 'aprovado', 'rejeitado'].map((s) => (
            <button
              key={s}
              onClick={() => {
                setStatusFilter(s);
                setPage(1);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors shrink-0 ${
                statusFilter === s
                  ? 'bg-cyan-600 text-white shadow-xs'
                  : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Recharges Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-lg">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950/80 border-b border-slate-800 text-[11px] uppercase tracking-wider text-slate-400 font-semibold">
              <tr>
                <th className="px-5 py-3.5">ID / Data</th>
                <th className="px-4 py-3.5">Utilizador</th>
                <th className="px-4 py-3.5">Valor</th>
                <th className="px-4 py-3.5">Canal / Método</th>
                <th className="px-4 py-3.5">Comprovativo</th>
                <th className="px-4 py-3.5">Status</th>
                <th className="px-5 py-3.5 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-500 text-xs">
                      {loading ? 'A carregar recargas...' : 'Nenhum pedido de recarga encontrado com os filtros atuais.'}
                  </td>
                </tr>
              ) : (
                filteredItems.map((r) => {
                  const receiptUrl = extractReceiptUrl(r);
                  return (
                    <tr
                      key={r.id}
                      className="hover:bg-slate-850/50 transition-colors"
                    >
                      <td className="px-5 py-4">
                        <div className="font-mono font-bold text-white">#{r.id}</div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          {r.criado_em && Number.isFinite(new Date(r.criado_em).getTime())
                            ? new Date(r.criado_em).toLocaleString('pt-AO')
                            : 'Data não disponível'}
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        {r.user_nome && (
                          <div className="text-[11px] text-slate-300">{r.user_nome}</div>
                        )}
                        <div className="font-mono text-cyan-400 text-xs">{r.uid || 'UID não disponível'}</div>
                        <div className="text-[11px] text-slate-300">
                          {r.user_telefone || 'Telefone não disponível'}
                        </div>
                        {r.detalhes_transacao?.multicaixaexpress && (
                          <div className="text-[10px] text-slate-500">
                            Multicaixa Express: {r.detalhes_transacao.multicaixaexpress}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-4 font-mono font-bold text-slate-100">
                        {formatCurrency(r.valor)}
                      </td>
                      <td className="px-4 py-4">
                        <span className="capitalize text-slate-300 font-medium block">
                          {String(r.metodo || 'Não especificado').replaceAll('_', ' ')}
                        </span>
                        {r.banco_destino && (
                          <span className="text-[10px] text-slate-500 block">
                            Destino: {r.banco_destino}
                          </span>
                        )}
                        {r.detalhes_transacao?.referencia && (
                          <span className="text-[10px] text-slate-500 font-mono block">
                            Ref: {r.detalhes_transacao.referencia}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-4">
                        {receiptUrl ? (
                          <button
                            onClick={() =>
                              setViewingProof({
                                url: receiptUrl,
                                record: r,
                              })
                            }
                            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-cyan-950/40 border border-cyan-800/60 hover:bg-cyan-900/50 text-cyan-300 text-[11px] font-medium transition-colors"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>Ver Prova</span>
                          </button>
                        ) : (
                          <span className="text-[11px] text-slate-500 italic">Sem anexo</span>
                        )}
                      </td>
                      <td className="px-4 py-4">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold uppercase tracking-wider ${
                            r.status === 'concluido'
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                              : r.status === 'rejeitado'
                              ? 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                              : r.status === 'pendente'
                              ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30 animate-pulse'
                              : 'bg-slate-700/50 text-slate-300 border border-slate-600'
                          }`}
                        >
                          {r.status === 'concluido'
                            ? 'Concluído'
                            : r.status === 'pendente'
                            ? 'Pendente'
                            : r.status === 'rejeitado'
                            ? 'Rejeitado'
                            : r.status}
                        </span>
                        {r.decisao?.motivo && (
                          <span
                            className="block text-[10px] text-rose-400 mt-1 max-w-[140px] truncate"
                            title={r.decisao.motivo}
                          >
                            {r.decisao.motivo}
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-4 text-right">
                        {r.status === 'pendente' ? (
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => setConfirmAction({ type: 'approve', record: r })}
                              className="px-2.5 py-1.5 rounded-lg bg-emerald-600/90 hover:bg-emerald-500 text-white font-medium text-[11px] flex items-center gap-1 transition-colors"
                              title="Aprovar e creditar saldo"
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Aprovar</span>
                            </button>
                            <button
                              onClick={() => setConfirmAction({ type: 'reject', record: r })}
                              className="px-2.5 py-1.5 rounded-lg bg-rose-950/60 hover:bg-rose-900/80 text-rose-300 border border-rose-800/80 font-medium text-[11px] flex items-center gap-1 transition-colors"
                              title="Rejeitar pedido com motivo"
                            >
                              <XCircle className="w-3.5 h-3.5" />
                              <span>Rejeitar</span>
                            </button>
                          </div>
                        ) : (
                          <span className="text-[11px] text-slate-500 font-mono">
                            Decidido por {r.decisao?.admin_email?.split('@')[0] || 'admin'}
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
      {totalPages > 1 && (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-800 bg-slate-900 px-5 py-3">
          <span className="text-[11px] text-slate-400">
            {total} recarga(s) · página {page} de {totalPages}
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPage((current) => Math.max(1, current - 1))}
              disabled={page <= 1 || loading}
              className="rounded-lg border border-slate-700 px-3 py-1.5 text-[11px] text-slate-300 disabled:opacity-40"
            >
              Anterior
            </button>
            <button
              type="button"
              onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
              disabled={page >= totalPages || loading}
              className="rounded-lg border border-slate-700 px-3 py-1.5 text-[11px] text-slate-300 disabled:opacity-40"
            >
              Seguinte
            </button>
          </div>
        </div>
      )}

      {/* Proof Viewer Modal */}
      {viewingProof && (
        <ProofViewerModal
          isOpen={!!viewingProof}
          onClose={() => setViewingProof(null)}
          imageUrl={viewingProof.url}
          title={`Comprovativo de Recarga #${viewingProof.record.id}`}
          transactionMeta={{
            referencia: viewingProof.record.detalhes_transacao?.referencia,
            banco_origem: viewingProof.record.detalhes_transacao?.banco_origem,
            titular_origem: viewingProof.record.detalhes_transacao?.titular_origem,
            telefone_pagamento: viewingProof.record.detalhes_transacao?.multicaixaexpress,
            metodo: viewingProof.record.metodo,
            usuario: viewingProof.record.uid,
            valor: viewingProof.record.valor,
          }}
        />
      )}

      {/* Confirmation Dialog */}
      {confirmAction && (
        <ConfirmDialog
          isOpen={!!confirmAction}
          onClose={() => setConfirmAction(null)}
          onConfirm={confirmAction.type === 'approve' ? handleApprove : handleReject}
          title={
            confirmAction.type === 'approve'
              ? `Aprovar Recarga #${confirmAction.record.id}`
              : `Rejeitar Recarga #${confirmAction.record.id}`
          }
          description={
            confirmAction.type === 'approve'
              ? `Confirma a creditação atómica de ${formatCurrency(
                  confirmAction.record.valor
                )} na conta do utilizador ${confirmAction.record.uid}? Esta operação é irreversível e criará um registo em extrato.`
              : `Deseja rejeitar este pedido de ${formatCurrency(
                  confirmAction.record.valor
                )}? Nenhum saldo será adicionado e o histórico será preservado.`
          }
          confirmLabel={confirmAction.type === 'approve' ? 'Aprovar e Creditar' : 'Confirmar Rejeição'}
          variant={confirmAction.type === 'approve' ? 'success' : 'danger'}
          requireReason={confirmAction.type === 'reject'}
          reasonPlaceholder="Indique o motivo (ex: comprovativo ilegível, valor divergente no extrato...)"
          isProcessing={isProcessing}
        />
      )}
    </div>
  );
};
