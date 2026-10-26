import React, { useEffect, useState } from 'react';
import {
  ArrowDownLeft,
  ArrowUpRight,
  Clock,
  Users,
  AlertTriangle,
  ArrowRight,
  TrendingUp,
  ShieldCheck,
  CheckCircle2,
  RefreshCw,
} from 'lucide-react';
import { DashboardMetrics } from '../../types/admin';
import { adminApi } from '../../services/adminApi';
import { formatCurrency } from '../../lib/adminLogic';

interface AdminDashboardProps {
  onNavigate: (tab: string, filter?: string) => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ onNavigate }) => {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await adminApi.getDashboard();
      setMetrics(data);
    } catch (err: any) {
      setError(err.message || 'Falha ao carregar métricas.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  return (
    <div className="space-y-6">
      {/* Top Banner & Refresh */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight">Painel de Controlo</h1>
          <p className="text-xs text-slate-400 mt-1">
            Resumo atual de recargas, saques, utilizadores e auditoria.
          </p>
        </div>
        <button
          onClick={loadData}
          disabled={loading}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-800 hover:bg-slate-800 text-xs text-slate-300 transition-colors self-start sm:self-auto disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-cyan-400' : ''}`} />
          <span>Atualizar Dados</span>
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-800 text-xs text-rose-300">
          {error}
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Pending Recharges Card */}
        <div
          onClick={() => onNavigate('recharges', 'pendente')}
          className="bg-slate-900/90 border border-slate-800 hover:border-cyan-500/50 p-5 rounded-2xl cursor-pointer transition-all hover:shadow-lg hover:shadow-cyan-950/30 group"
          role="button"
          tabIndex={0}
          aria-label="Ver recargas pendentes"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-slate-400">Recargas Pendentes</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 group-hover:bg-emerald-500/20 transition-colors">
              <ArrowDownLeft className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-bold text-white font-mono">
              {metrics ? metrics.counts.pendingRecharges : '--'}
            </span>
            <span className="text-xs text-emerald-400 font-medium">Aguardam revisão</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-2">
            Volume pendente: <span className="font-semibold text-slate-200">{metrics ? formatCurrency(metrics.volumes.pendingRechargeAmount) : '0 KZ'}</span>
          </p>
          <div className="mt-3 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-cyan-400 font-medium">
            <span>Rever comprovativos</span>
            <ArrowRight className="w-3.5 h-3.5 transform group-hover:translate-x-1 transition-transform" />
          </div>
        </div>

        {/* Pending Withdrawals Card */}
        <div
          onClick={() => onNavigate('withdrawals', 'pendente')}
          className="bg-slate-900/90 border border-slate-800 hover:border-amber-500/50 p-5 rounded-2xl cursor-pointer transition-all hover:shadow-lg hover:shadow-amber-950/30 group"
          role="button"
          tabIndex={0}
          aria-label="Ver saques pendentes"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-slate-400">Saques a Liquidar</span>
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 group-hover:bg-amber-500/20 transition-colors">
              <ArrowUpRight className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-bold text-white font-mono">
              {metrics ? metrics.counts.pendingWithdrawals : '--'}
            </span>
            <span className="text-xs text-amber-400 font-medium">Aguardam envio</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-2">
            Volume pendente: <span className="font-semibold text-slate-200">{metrics ? formatCurrency(metrics.volumes.pendingWithdrawalAmount) : '0 KZ'}</span>
          </p>
          <div className="mt-3 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-amber-400 font-medium">
            <span>Processar pagamentos</span>
            <ArrowRight className="w-3.5 h-3.5 transform group-hover:translate-x-1 transition-transform" />
          </div>
        </div>

        {/* Attention / Alerts Card */}
        <div
          onClick={() => onNavigate('recharges', 'pendente')}
          className="bg-slate-900/90 border border-slate-800 hover:border-rose-500/50 p-5 rounded-2xl cursor-pointer transition-all hover:shadow-lg hover:shadow-rose-950/30 group"
          role="button"
          tabIndex={0}
          aria-label="Ver alertas de atraso"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-slate-400">Alertas de SLA &gt; 24h</span>
            <div className="w-8 h-8 rounded-lg bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 group-hover:bg-rose-500/20 transition-colors">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-bold text-white font-mono">
              {metrics ? metrics.counts.delayedAlerts : '--'}
            </span>
            <span className="text-xs text-rose-400 font-medium">Atrasados</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-2">
            Pedidos que excederam o prazo de revisão recomendado.
          </p>
          <div className="mt-3 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-rose-400 font-medium">
            <span>Priorizar atendimento</span>
            <ArrowRight className="w-3.5 h-3.5 transform group-hover:translate-x-1 transition-transform" />
          </div>
        </div>

        {/* Total Users Directory Card */}
        <div
          onClick={() => onNavigate('users')}
          className="bg-slate-900/90 border border-slate-800 hover:border-cyan-500/50 p-5 rounded-2xl cursor-pointer transition-all hover:shadow-lg hover:shadow-cyan-950/30 group"
          role="button"
          tabIndex={0}
          aria-label="Ver utilizadores"
        >
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-slate-400">Utilizadores na Base</span>
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 group-hover:bg-blue-500/20 transition-colors">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-bold text-white font-mono">
              {metrics ? metrics.counts.totalUsers : '--'}
            </span>
            <span className="text-xs text-cyan-400 font-medium">Ativos e Registados</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-2">
            Contas monitorizadas e verificadas no sistema.
          </p>
          <div className="mt-3 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-cyan-400 font-medium">
            <span>Pesquisar utilizador</span>
            <ArrowRight className="w-3.5 h-3.5 transform group-hover:translate-x-1 transition-transform" />
          </div>
        </div>
      </div>

      {/* Critical SLA Alerts Feed */}
      {metrics && metrics.alerts.length > 0 && (
        <div className="bg-slate-900 border border-amber-500/30 rounded-2xl p-5 shadow-lg">
          <div className="flex items-center gap-2.5 mb-3 text-amber-400">
            <Clock className="w-4 h-4" />
            <h3 className="text-xs font-bold uppercase tracking-wider">
              Avisos de Pendência Prolongada (&gt;24 Horas)
            </h3>
          </div>
          <div className="space-y-2">
            {metrics.alerts.map((alert, idx) => (
              <div
                key={idx}
                className="bg-slate-950 border border-slate-800 p-3 rounded-xl flex items-center justify-between text-xs"
              >
                <div className="flex items-center gap-2.5">
                  <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                  <span className="text-slate-200">{alert.mensagem}</span>
                </div>
                <button
                  onClick={() => {
                    if (alert.tipo === 'recarga_atrasada') {
                      onNavigate('recharges', 'pendente');
                    } else {
                      onNavigate('withdrawals', 'pendente');
                    }
                  }}
                  className="px-2.5 py-1 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 font-medium text-[11px] transition-colors"
                >
                  Resolver Agora
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick Action Hub & Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Quick Operations panel */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
          <h3 className="text-sm font-semibold text-white mb-3">Atalhos Operacionais</h3>
          <div className="space-y-2 text-xs">
            <button
              onClick={() => onNavigate('recharges', 'pendente')}
              className="w-full p-3 rounded-xl bg-slate-950 border border-slate-800 hover:border-cyan-500/40 text-left flex items-center justify-between transition-colors group"
            >
              <div>
                <p className="font-medium text-slate-200 group-hover:text-cyan-300">
                  Validar Comprovativos de Recarga
                </p>
                <p className="text-[11px] text-slate-500">Multicaixa Express & Bancos</p>
              </div>
              <ArrowDownLeft className="w-4 h-4 text-slate-500 group-hover:text-cyan-400" />
            </button>

            <button
              onClick={() => onNavigate('withdrawals', 'pendente')}
              className="w-full p-3 rounded-xl bg-slate-950 border border-slate-800 hover:border-amber-500/40 text-left flex items-center justify-between transition-colors group"
            >
              <div>
                <p className="font-medium text-slate-200 group-hover:text-amber-300">
                  Emitir Pagamentos de Saque
                </p>
                <p className="text-[11px] text-slate-500">Anexar comprovativo e dar baixa</p>
              </div>
              <ArrowUpRight className="w-4 h-4 text-slate-500 group-hover:text-amber-400" />
            </button>

            <button
              onClick={() => onNavigate('payment-methods')}
              className="w-full p-3 rounded-xl bg-slate-950 border border-slate-800 hover:border-blue-500/40 text-left flex items-center justify-between transition-colors group"
            >
              <div>
                <p className="font-medium text-slate-200 group-hover:text-blue-300">
                  Gerir Contas de Depósito (Pasta)
                </p>
                <p className="text-[11px] text-slate-500">IBANs, Terminais e Cripto</p>
              </div>
              <TrendingUp className="w-4 h-4 text-slate-500 group-hover:text-blue-400" />
            </button>

            <button
              onClick={() => onNavigate('products')}
              className="w-full p-3 rounded-xl bg-slate-950 border border-slate-800 hover:border-purple-500/40 text-left flex items-center justify-between transition-colors group"
            >
              <div>
                <p className="font-medium text-slate-200 group-hover:text-purple-300">
                  Catálogo de Bots Teggram-X
                </p>
                <p className="text-[11px] text-slate-500">Configurar preços e rendas diárias</p>
              </div>
              <CheckCircle2 className="w-4 h-4 text-slate-500 group-hover:text-purple-400" />
            </button>
          </div>
        </div>

        {/* Recent Audit Trail feed */}
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-5 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-cyan-400" />
              <h3 className="text-sm font-semibold text-white">Últimas Ações Administrativas</h3>
            </div>
            <button
              onClick={() => onNavigate('audit')}
              className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1 font-medium"
            >
              <span>Ver registo completo</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex-1 space-y-2.5 overflow-y-auto">
            {metrics && metrics.recentAuditLogs.length > 0 ? (
              metrics.recentAuditLogs.map((log) => (
                <div
                  key={log.id}
                  className="bg-slate-950 border border-slate-800/80 p-3 rounded-xl flex items-start justify-between text-xs"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-200 font-mono">
                        {log.acao}
                      </span>
                      <span className="px-1.5 py-0.5 rounded text-[10px] bg-slate-800 text-slate-400 uppercase">
                        {log.entidade}
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1">
                      Alvo: <span className="font-mono text-cyan-300">#{log.entidade_id}</span>
                      {log.motivo && ` • Motivo: ${log.motivo}`}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-[10px] text-slate-500 block">
                      {new Date(log.data).toLocaleTimeString('pt-AO', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    <span className="text-[10px] text-slate-400 truncate max-w-[120px] block">
                      {log.admin_email}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-xs text-slate-500 text-center py-6">
                Nenhum registo de auditoria recente.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
