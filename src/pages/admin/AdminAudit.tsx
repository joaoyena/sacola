import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Search,
  Filter,
  RefreshCw,
  Clock,
  UserCheck,
  FileCode,
  AlertCircle,
  Eye,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { AuditLog } from '../../types/admin';
import { adminApi } from '../../services/adminApi';

export const AdminAudit: React.FC = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [actionFilter, setActionFilter] = useState<string>('todas');
  const [entityFilter, setEntityFilter] = useState<string>('todas');
  const [adminQuery, setAdminQuery] = useState<string>('');

  // Expanded payload inspector
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  const fetchLogs = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await adminApi.getAuditLogs({
        acao: actionFilter,
        entidade: entityFilter,
        admin_uid: adminQuery || undefined,
      });
      setLogs(data.items);
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar trilha de auditoria.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, [actionFilter, entityFilter]);

  const toggleExpand = (id: string) => {
    setExpandedLogId(expandedLogId === id ? null : id);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-cyan-400" />
            <span>Trilha de Auditoria Administrativa (`admin_audit_logs`)</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Registo criptograficamente auditável e imutável de todas as decisões tomadas no painel
          </p>
        </div>
        <button
          onClick={fetchLogs}
          disabled={loading}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-800 hover:bg-slate-800 text-xs text-slate-300 transition-colors self-start sm:self-auto disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-cyan-400' : ''}`} />
          <span>Atualizar Auditoria</span>
        </button>
      </div>

      {error && (
        <div className="p-3.5 rounded-xl bg-rose-950/60 border border-rose-800/80 text-rose-200 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)} className="text-rose-400 hover:text-white">✕</button>
        </div>
      )}

      {/* Immutability statement */}
      <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl flex items-center justify-between text-xs text-slate-400">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
          <span>Registos estritamente de leitura (Append-only no Firestore, updates e deletes bloqueados por regras).</span>
        </div>
        <span className="font-mono text-slate-500 text-[11px] hidden md:inline">
          Coleção: admin_audit_logs
        </span>
      </div>

      {/* Filters bar */}
      <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl flex flex-wrap gap-4 items-center justify-between">
        <div className="flex items-center gap-3 flex-1 min-w-[240px]">
          <Search className="w-4 h-4 text-slate-500" />
          <input
            type="text"
            value={adminQuery}
            onChange={(e) => setAdminQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && fetchLogs()}
            placeholder="Filtrar por email de administrador ou UID..."
            className="w-full px-3 py-1.5 text-xs bg-slate-950 border border-slate-800 rounded-lg text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
          />
        </div>

        <div className="flex items-center gap-3 text-xs">
          <div className="flex items-center gap-1.5">
            <Filter className="w-3.5 h-3.5 text-slate-500" />
            <span className="text-slate-400">Entidade:</span>
            <select
              value={entityFilter}
              onChange={(e) => setEntityFilter(e.target.value)}
              className="px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-slate-200"
            >
              <option value="todas">Todas</option>
              <option value="paymentbot">Recargas (paymentbot)</option>
              <option value="retiradas">Saques (retiradas)</option>
              <option value="produtos">Produtos (produtos)</option>
              <option value="pasta">Coordenadas (pasta)</option>
              <option value="users">Utilizadores (users)</option>
            </select>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="text-slate-400">Ação:</span>
            <select
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              className="px-2.5 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-slate-200"
            >
              <option value="todas">Todas as Ações</option>
              <option value="APROVAR_RECARGA">Aprovação de Recarga</option>
              <option value="REJEITAR_RECARGA">Rejeição de Recarga</option>
              <option value="PAGAR_SAQUE">Pagamento de Saque</option>
              <option value="REJEITAR_SAQUE">Rejeição e Estorno de Saque</option>
              <option value="CRIAR_PRODUTO">Criação de Produto</option>
              <option value="ATUALIZAR_PRODUTO">Atualização de Produto</option>
              <option value="EDITAR_METODO_PAGAMENTO">Edição de Coordenada Bancária</option>
              <option value="CONGELAR_CONTA">Congelamento de Conta</option>
              <option value="DESCONGELAR_CONTA">Descongelamento de Conta</option>
              <option value="ALTERAR_SALDO_UTILIZADOR">Alteração de Saldo</option>
              <option value="REDEFINIR_SENHA_UTILIZADOR">Redefinição de Senha</option>
            </select>
          </div>
        </div>
      </div>

      {/* Audit Logs List */}
      <div className="space-y-3">
        {logs.length === 0 ? (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-12 text-center text-slate-500 text-xs">
            Nenhum registo de auditoria com os filtros selecionados.
          </div>
        ) : (
          logs.map((log) => {
            const isExpanded = expandedLogId === log.id;
            return (
              <div
                key={log.id}
                className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-2xl p-4 transition-all shadow-md text-xs text-slate-300"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2.5">
                    <span
                      className={`px-2 py-0.5 rounded font-mono font-bold text-[10px] tracking-wide uppercase ${
                        log.acao.includes('APROVAR') || log.acao.includes('PAGAR')
                          ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-800/80'
                          : log.acao.includes('REJEITAR') || log.acao.includes('CONGELAR')
                          ? 'bg-rose-950/80 text-rose-400 border border-rose-800/80'
                          : 'bg-cyan-950/80 text-cyan-400 border border-cyan-800/80'
                      }`}
                    >
                      {log.acao}
                    </span>

                    <span className="font-mono text-slate-400 text-[11px]">
                      Entidade: <strong className="text-slate-200">{log.entidade}</strong> (#{log.entidade_id})
                    </span>
                  </div>

                  <div className="flex items-center gap-3 text-slate-500 text-[11px]">
                    <span className="flex items-center gap-1 font-mono">
                      <Clock className="w-3 h-3 text-slate-500" />
                      {new Date(log.data).toLocaleString('pt-AO')}
                    </span>
                    <span className="text-slate-400 font-medium">{log.admin_email}</span>
                  </div>
                </div>

                {log.motivo && (
                  <p className="text-slate-300 bg-slate-950/50 border border-slate-800/80 rounded-lg p-2.5 my-2 italic">
                    Motivo declarado: "{log.motivo}"
                  </p>
                )}

                <div className="flex items-center justify-between pt-2 border-t border-slate-800/80 mt-2 text-[11px]">
                  <span className="text-slate-500 font-mono">Log ID: {log.id}</span>
                  <button
                    onClick={() => toggleExpand(log.id)}
                    className="flex items-center gap-1 text-cyan-400 hover:text-cyan-300 font-medium"
                  >
                    <FileCode className="w-3.5 h-3.5" />
                    <span>{isExpanded ? 'Ocultar Carga JSON' : 'Inspecionar Metadados'}</span>
                    {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  </button>
                </div>

                {/* Expanded JSON Inspector */}
                {isExpanded && (
                  <div className="mt-3 pt-3 border-t border-slate-800 text-[11px] font-mono bg-slate-950 rounded-xl p-3 border border-slate-800/80 overflow-x-auto text-slate-300 space-y-2">
                    {log.dados_anteriores && (
                      <div>
                        <span className="text-amber-400 font-bold block mb-1">
                          // Estado Anterior:
                        </span>
                        <pre className="text-slate-400">
                          {JSON.stringify(log.dados_anteriores, null, 2)}
                        </pre>
                      </div>
                    )}
                    {log.dados_novos && (
                      <div>
                        <span className="text-emerald-400 font-bold block mb-1">
                          // Novo Estado Gravado:
                        </span>
                        <pre className="text-slate-300">
                          {JSON.stringify(log.dados_novos, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
