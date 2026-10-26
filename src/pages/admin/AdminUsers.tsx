import React, { useState, useEffect } from 'react';
import {
  Users,
  Search,
  CheckCircle2,
  Lock,
  Unlock,
  AlertCircle,
  RefreshCw,
  KeyRound,
  X,
  Fingerprint,
  Smartphone,
  Ticket,
} from 'lucide-react';
import { UserItem, UserSearchField } from '../../types/admin';
import { adminApi } from '../../services/adminApi';
import { formatCurrency } from '../../lib/adminLogic';
import { ConfirmDialog } from '../../components/admin/ConfirmDialog';
import { GoogleToast } from '../../components/common/GoogleToast';

export const AdminUsers: React.FC = () => {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [investorStats, setInvestorStats] = useState({ investors: 0, normalUsers: 0 });
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchField, setSearchField] = useState<UserSearchField>('uid');
  const [searchModalOpen, setSearchModalOpen] = useState(false);
  const [draftSearchQuery, setDraftSearchQuery] = useState('');
  const [draftSearchField, setDraftSearchField] = useState<UserSearchField>('uid');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [balanceEdit, setBalanceEdit] = useState<UserItem | null>(null);
  const [balanceValue, setBalanceValue] = useState('');
  const [balanceReason, setBalanceReason] = useState('');
  const [passwordEdit, setPasswordEdit] = useState<UserItem | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');

  // Status toggle confirm modal
  const [statusConfirm, setStatusConfirm] = useState<{
    user: UserItem;
    targetStatus: 'ativo' | 'congelado';
  } | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  const fetchUsers = async (
    query = searchQuery,
    field = searchField,
  ) => {
    setLoading(true);
    setError(null);
    try {
      const data = await adminApi.getUsers(query, query ? field : undefined);
      setUsers(data.items);
      setInvestorStats(data.stats);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao buscar utilizadores.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setDraftSearchQuery(searchQuery);
    setDraftSearchField(searchField);
    setSearchModalOpen(true);
  };

  const handleApplySearch = async (event: React.FormEvent) => {
    event.preventDefault();
    const query = draftSearchQuery.trim();
    setSearchQuery(query);
    setSearchField(draftSearchField);
    setSearchModalOpen(false);
    await fetchUsers(query, draftSearchField);
  };

  const openSearchModal = () => {
    setDraftSearchQuery(searchQuery);
    setDraftSearchField(searchField);
    setSearchModalOpen(true);
  };

  const handleToggleStatus = async (extraData?: { motivo?: string }) => {
    if (!statusConfirm) return;
    setIsProcessing(true);
    try {
      const res = await adminApi.toggleUserStatus(
        statusConfirm.user.uid,
        statusConfirm.targetStatus,
        extraData?.motivo
      );
      setSuccessMessage(res.message);
      setStatusConfirm(null);
      await fetchUsers();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao alterar estado do utilizador.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleBalanceSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!balanceEdit) return;
    setIsProcessing(true);
    setError(null);
    try {
      const result = await adminApi.updateUserBalance(
        balanceEdit.uid,
        Number(balanceValue),
        balanceReason.trim() || undefined,
      );
      setSuccessMessage(result.message);
      setBalanceEdit(null);
      await fetchUsers();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao atualizar o saldo do utilizador.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePasswordSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!passwordEdit || newPassword.length < 6 || newPassword !== confirmNewPassword) return;
    setIsProcessing(true);
    setError(null);
    try {
      const result = await adminApi.resetUserPassword(passwordEdit.uid, newPassword);
      setSuccessMessage(result.message);
      setPasswordEdit(null);
      setNewPassword('');
      setConfirmNewPassword('');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao redefinir a palavra-passe do utilizador.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-xl font-bold text-white tracking-tight">Utilizadores</h1>
            <span className="rounded-full border border-cyan-800/70 bg-cyan-950/40 px-2.5 py-1 text-[11px] font-semibold text-cyan-300">
              Investidores {investorStats.investors}
            </span>
            <span className="rounded-full border border-slate-700 bg-slate-900 px-2.5 py-1 text-[11px] font-semibold text-slate-300">
              Utilizadores normais {investorStats.normalUsers}
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Dados atuais dos perfis e do Firebase Authentication.
          </p>
        </div>
        <button
          onClick={() => fetchUsers()}
          disabled={loading}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-800 hover:bg-slate-800 text-xs text-slate-300 transition-colors self-start sm:self-auto disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-cyan-400' : ''}`} />
          <span>Atualizar</span>
        </button>
      </div>

      {/* Google-style Floating Toast Notifications */}
      {successMessage && (
        <GoogleToast
          type="success"
          message={successMessage}
          onClose={() => setSuccessMessage(null)}
        />
      )}

      {error && (
        <GoogleToast
          type="error"
          message={error}
          onClose={() => setError(null)}
        />
      )}

      {/* Search Bar */}
      <form onSubmit={handleSearchSubmit} className="bg-slate-900 border border-slate-800 p-4 rounded-2xl flex gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 transform -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onClick={openSearchModal}
            onFocus={openSearchModal}
            readOnly
            placeholder={`Clique para filtrar por ${searchField === 'uid' ? 'identificador' : searchField === 'telefone' ? 'telefone' : 'código de convite'}...`}
            aria-label="Abrir filtros de pesquisa de utilizadores"
            className="w-full cursor-pointer pl-9 pr-4 py-2 text-xs bg-slate-950 border border-slate-800 rounded-xl text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
          />
        </div>
        <button
          type="submit"
          className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-xs font-semibold shadow-xs"
        >
          Filtrar
        </button>
      </form>

      {searchModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="user-search-title"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setSearchModalOpen(false);
          }}
        >
          <form
            onSubmit={handleApplySearch}
            className="w-full max-w-md space-y-4 rounded-2xl border border-cyan-800/50 bg-slate-900 p-6 text-slate-100 shadow-2xl"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 id="user-search-title" className="text-base font-semibold text-white">Filtrar utilizadores</h2>
                <p className="mt-1 text-xs text-slate-400">Escolha o campo pelo qual pretende pesquisar.</p>
              </div>
              <button
                type="button"
                onClick={() => setSearchModalOpen(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white"
                aria-label="Fechar filtros"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <fieldset className="space-y-2">
              <legend className="mb-2 text-xs font-medium text-slate-300">Filtrar por</legend>
              {([
                { value: 'telefone', label: 'Telefone', Icon: Smartphone },
                { value: 'convite', label: 'Código de convite', Icon: Ticket },
                { value: 'uid', label: 'Identificador do utilizador (UID)', Icon: Fingerprint },
              ] as const).map(({ value, label, Icon }) => (
                <label
                  key={value}
                  className={`flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5 text-xs transition-colors ${
                    draftSearchField === value
                      ? 'border-cyan-600/70 bg-cyan-950/40 text-cyan-200'
                      : 'border-slate-800 bg-slate-950 text-slate-300 hover:border-slate-700'
                  }`}
                >
                  <input
                    type="radio"
                    name="user-search-field"
                    value={value}
                    checked={draftSearchField === value}
                    onChange={() => setDraftSearchField(value)}
                    className="accent-cyan-500"
                  />
                  <Icon className="h-4 w-4" />
                  <span>{label}</span>
                </label>
              ))}
            </fieldset>

            <div>
              <label htmlFor="user-filter-query" className="mb-1 block text-xs font-medium text-slate-300">
                {draftSearchField === 'telefone'
                  ? 'Número de telefone'
                  : draftSearchField === 'convite'
                    ? 'Código de convite'
                    : 'UID do utilizador'}
              </label>
              <input
                id="user-filter-query"
                type="text"
                autoFocus
                value={draftSearchQuery}
                onChange={(event) => setDraftSearchQuery(event.target.value)}
                placeholder={
                  draftSearchField === 'telefone'
                    ? 'Ex.: +244 923 456 789'
                    : draftSearchField === 'convite'
                      ? 'Introduza o código de convite'
                      : 'Cole o identificador completo ou parcial'
                }
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-cyan-500 focus:outline-none"
              />
            </div>

            <div className="flex justify-between gap-2 border-t border-slate-800 pt-4">
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setDraftSearchQuery('');
                  setSearchModalOpen(false);
                  void fetchUsers('', searchField);
                }}
                className="rounded-lg px-3 py-2 text-xs font-medium text-slate-400 hover:bg-slate-800 hover:text-white"
              >
                Limpar filtro
              </button>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setSearchModalOpen(false)}
                  className="rounded-lg bg-slate-800 px-4 py-2 text-xs font-medium text-slate-300 hover:bg-slate-700"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={!draftSearchQuery.trim()}
                  className="rounded-lg bg-cyan-600 px-4 py-2 text-xs font-semibold text-white hover:bg-cyan-500 disabled:opacity-50"
                >
                  Pesquisar
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* Users Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-lg">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-950/80 border-b border-slate-800 text-[11px] uppercase tracking-wider text-slate-400 font-semibold">
              <tr>
                <th className="px-5 py-3.5">Utilizador / UID</th>
                <th className="px-4 py-3.5">Telefone</th>
                <th className="px-4 py-3.5">Saldo Disponível</th>
                <th className="px-4 py-3.5">Total Investido</th>
                <th className="px-4 py-3.5">Total Retirado</th>
                <th className="px-4 py-3.5">Convite / Patrocinador</th>
                <th className="px-4 py-3.5">Status</th>
                <th className="px-4 py-3.5">Senha</th>
                <th className="px-5 py-3.5 text-right">Ação de Suporte</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {users.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-6 py-12 text-center text-slate-500 text-xs">
                    {loading ? 'A carregar utilizadores...' : 'Nenhum utilizador encontrado para os critérios de busca.'}
                  </td>
                </tr>
              ) : (
                users.map((u) => (
                  <tr key={u.uid} className="hover:bg-slate-850/50 transition-colors">
                    <td className="px-5 py-4">
                      <div className="flex flex-wrap items-center gap-2">
                        {u.nome && <span className="font-medium text-slate-200">{u.nome}</span>}
                        <span
                          className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
                            u.is_investidor
                              ? 'border-cyan-800/70 bg-cyan-950/40 text-cyan-300'
                              : 'border-slate-700 bg-slate-950 text-slate-400'
                          }`}
                        >
                          {u.is_investidor ? 'Investidor' : 'Normal'}
                        </span>
                      </div>
                      <div className="font-mono font-bold text-cyan-400">{u.uid}</div>
                      {u.email && <div className="text-[11px] text-slate-500">{u.email}</div>}
                    </td>
                    <td className="px-4 py-4 font-mono text-slate-300">
                      {u.telefone || 'Não disponível'}
                    </td>
                    <td className="px-4 py-4">
                      {u.saldo === null ? (
                        <span className="font-mono text-slate-500">Não disponível</span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setBalanceEdit(u);
                            setBalanceValue(String(u.saldo));
                            setBalanceReason('');
                          }}
                          className="font-mono font-bold text-white text-sm hover:text-cyan-300 underline decoration-dotted underline-offset-4"
                          title="Clique para editar o saldo"
                        >
                          {formatCurrency(u.saldo)}
                        </button>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      <div className="font-mono font-medium text-slate-300">
                        {u.total_investido === null ? 'Não disponível' : formatCurrency(u.total_investido)}
                      </div>
                    </td>
                    <td className="px-4 py-4 font-mono font-medium text-slate-300">
                      {u.total_retirado === null ? 'Não disponível' : formatCurrency(u.total_retirado)}
                    </td>
                    <td className="px-4 py-4">
                      <span className="font-mono px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-slate-300 text-[11px]">
                        {u.convite_code || '---'}
                      </span>
                      {u.patrocinador && (
                        <div className="mt-1 text-[10px] text-slate-500">Patrocinador: {u.patrocinador}</div>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold uppercase ${
                          u.status === 'ativo'
                            ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                            : 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            u.status === 'ativo' ? 'bg-emerald-400' : 'bg-rose-400'
                          }`}
                        ></span>
                        {u.status === 'congelado' ? 'desativado' : u.status}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      {u.auth_exists === false ? (
                        <span className="text-[11px] text-slate-500">Sem conta</span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setPasswordEdit(u);
                            setNewPassword('');
                            setConfirmNewPassword('');
                          }}
                          className="inline-flex items-center gap-1 rounded-lg border border-cyan-800/70 bg-cyan-950/40 px-2.5 py-1.5 text-[11px] font-medium text-cyan-300 transition-colors hover:bg-cyan-900/60"
                          title="Definir uma nova senha para este utilizador"
                        >
                          <KeyRound className="h-3.5 w-3.5" />
                          Alterar
                        </button>
                      )}
                    </td>
                    <td className="px-5 py-4 text-right">
                      {u.status === 'ativo' ? (
                        <button
                          type="button"
                          onClick={() =>
                            setStatusConfirm({ user: u, targetStatus: 'congelado' })
                          }
                          className="px-2.5 py-1.5 rounded-lg bg-amber-950/40 hover:bg-amber-900/60 text-amber-300 border border-amber-900/50 text-[11px] font-medium inline-flex items-center gap-1.5 transition-colors"
                          title="Congelar temporariamente por segurança"
                        >
                          <Lock className="w-3.5 h-3.5" />
                          <span>Congelar</span>
                        </button>
                      ) : u.status === 'congelado' ? (
                        <button
                          type="button"
                          onClick={() =>
                            setStatusConfirm({ user: u, targetStatus: 'ativo' })
                          }
                          className="px-2.5 py-1.5 rounded-lg bg-emerald-950/40 hover:bg-emerald-900/60 text-emerald-300 border border-emerald-900/50 text-[11px] font-medium inline-flex items-center gap-1.5 transition-colors"
                          title="Descongelar conta do utilizador"
                        >
                          <Unlock className="w-3.5 h-3.5" />
                          <span>Descongelar</span>
                        </button>
                      ) : (
                        <span className="text-[11px] text-slate-500">Ação não disponível</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Confirmation modal for freezing/unfreezing */}
      {statusConfirm && (
        <ConfirmDialog
          isOpen={!!statusConfirm}
          onClose={() => setStatusConfirm(null)}
          onConfirm={handleToggleStatus}
          title={
            statusConfirm.targetStatus === 'congelado'
              ? `Congelar Conta: ${statusConfirm.user.uid}`
              : `Descongelar Conta: ${statusConfirm.user.uid}`
          }
          description={
            statusConfirm.targetStatus === 'congelado'
              ? `A conta do utilizador será congelada imediatamente, impedindo novas compras e solicitações de retirada. Esta ação será auditada.`
              : `A conta do utilizador será restabelecida para o status normal ('ativo').`
          }
          confirmLabel={
            statusConfirm.targetStatus === 'congelado' ? 'Confirmar Congelamento' : 'Restabelecer Conta'
          }
          variant={statusConfirm.targetStatus === 'congelado' ? 'warning' : 'success'}
          requireReason={true}
          reasonPlaceholder="Informe o motivo da ação de suporte/segurança..."
          isProcessing={isProcessing}
        />
      )}

      {balanceEdit && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-balance-title"
        >
          <form
            onSubmit={handleBalanceSubmit}
            className="w-full max-w-md space-y-4 rounded-2xl border border-cyan-800/50 bg-slate-900 p-6 text-slate-100 shadow-2xl"
          >
            <div className="flex items-start justify-between">
              <div>
                <h2 id="edit-balance-title" className="text-base font-semibold text-white">Editar saldo</h2>
                <p className="mt-1 text-xs text-slate-400">Utilizador: {balanceEdit.uid}</p>
              </div>
              <button
                type="button"
                onClick={() => setBalanceEdit(null)}
                disabled={isProcessing}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white disabled:opacity-50"
                aria-label="Fechar"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div>
              <label htmlFor="user-balance" className="mb-1 block text-xs font-medium text-slate-300">Novo saldo (KZ)</label>
              <input
                id="user-balance"
                type="number"
                min="0"
                step="0.01"
                required
                value={balanceValue}
                onChange={(event) => setBalanceValue(event.target.value)}
                disabled={isProcessing}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white focus:border-cyan-500 focus:outline-none"
              />
            </div>
            <div>
              <label htmlFor="balance-reason" className="mb-1 block text-xs font-medium text-slate-300">Motivo (opcional)</label>
              <textarea
                id="balance-reason"
                rows={2}
                maxLength={500}
                value={balanceReason}
                onChange={(event) => setBalanceReason(event.target.value)}
                disabled={isProcessing}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white focus:border-cyan-500 focus:outline-none"
              />
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-800 pt-4">
              <button
                type="button"
                onClick={() => setBalanceEdit(null)}
                disabled={isProcessing}
                className="rounded-lg bg-slate-800 px-4 py-2 text-xs font-medium text-slate-300 hover:bg-slate-700 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isProcessing || !balanceValue.trim() || !Number.isFinite(Number(balanceValue)) || Number(balanceValue) < 0}
                className="rounded-lg bg-cyan-600 px-4 py-2 text-xs font-semibold text-white hover:bg-cyan-500 disabled:opacity-50"
              >
                {isProcessing ? 'A guardar...' : 'Guardar saldo'}
              </button>
            </div>
          </form>
        </div>
      )}

      {passwordEdit && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="reset-password-title"
        >
          <form
            onSubmit={handlePasswordSubmit}
            className="w-full max-w-md space-y-4 rounded-2xl border border-cyan-800/50 bg-slate-900 p-6 text-slate-100 shadow-2xl"
          >
            <div className="flex items-start justify-between">
              <div>
                <h2 id="reset-password-title" className="text-base font-semibold text-white">Alterar senha</h2>
                <p className="mt-1 text-xs text-slate-400">Utilizador: {passwordEdit.uid}</p>
              </div>
              <button
                type="button"
                onClick={() => setPasswordEdit(null)}
                disabled={isProcessing}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white disabled:opacity-50"
                aria-label="Fechar"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="rounded-lg border border-amber-800/50 bg-amber-950/30 p-3 text-xs leading-relaxed text-amber-200">
              Defina uma nova senha sem precisar da senha atual. As sessões anteriores do utilizador serão terminadas.
            </p>
            <div>
              <label htmlFor="new-user-password" className="mb-1 block text-xs font-medium text-slate-300">Nova senha</label>
              <input
                id="new-user-password"
                type="password"
                autoComplete="new-password"
                minLength={6}
                maxLength={4096}
                required
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                disabled={isProcessing}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white focus:border-cyan-500 focus:outline-none"
              />
            </div>
            <div>
              <label htmlFor="confirm-user-password" className="mb-1 block text-xs font-medium text-slate-300">Confirmar nova senha</label>
              <input
                id="confirm-user-password"
                type="password"
                autoComplete="new-password"
                minLength={6}
                maxLength={4096}
                required
                value={confirmNewPassword}
                onChange={(event) => setConfirmNewPassword(event.target.value)}
                disabled={isProcessing}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white focus:border-cyan-500 focus:outline-none"
              />
              {confirmNewPassword && newPassword !== confirmNewPassword && (
                <p className="mt-1 text-xs text-rose-300">As senhas não coincidem.</p>
              )}
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-800 pt-4">
              <button
                type="button"
                onClick={() => setPasswordEdit(null)}
                disabled={isProcessing}
                className="rounded-lg bg-slate-800 px-4 py-2 text-xs font-medium text-slate-300 hover:bg-slate-700 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isProcessing || newPassword.length < 6 || newPassword !== confirmNewPassword}
                className="rounded-lg bg-cyan-600 px-4 py-2 text-xs font-semibold text-white hover:bg-cyan-500 disabled:opacity-50"
              >
                {isProcessing ? 'A atualizar...' : 'Redefinir senha'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
