import React, { useEffect, useState } from 'react';
import { Edit2, Plus, RefreshCw, Ticket, Trash2 } from 'lucide-react';
import { ConfirmDialog } from '../../components/admin/ConfirmDialog';
import { GoogleToast } from '../../components/common/GoogleToast';
import { adminApi } from '../../services/adminApi';
import { CouponItem } from '../../types/admin';
import { formatCurrency, validateCouponData } from '../../lib/adminLogic';

interface CouponForm {
  codigo_cupom: string;
  valor: string;
  ativo: boolean;
}

function generateCouponCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(4));
  const suffix = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('').toUpperCase();
  return `TGX-${suffix}`;
}

export const AdminCoupons: React.FC = () => {
  const [coupons, setCoupons] = useState<CouponItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'todos' | 'ativos' | 'inativos'>('todos');
  const [loading, setLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState<CouponItem | null>(null);
  const [form, setForm] = useState<CouponForm>({
    codigo_cupom: '',
    valor: '1000',
    ativo: true,
  });
  const [deleteTarget, setDeleteTarget] = useState<CouponItem | null>(null);

  const fetchCoupons = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await adminApi.getCoupons();
      setCoupons(data.items);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar cupons.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchCoupons();
  }, []);

  const openCreate = () => {
    setEditingCoupon(null);
    setForm({ codigo_cupom: generateCouponCode(), valor: '1000', ativo: true });
    setIsEditing(true);
    setError(null);
  };

  const openEdit = (coupon: CouponItem) => {
    setEditingCoupon(coupon);
    setForm({
      codigo_cupom: coupon.codigo_cupom,
      valor: String(coupon.valor),
      ativo: coupon.ativo,
    });
    setIsEditing(true);
    setError(null);
  };

  const handleSave = async () => {
    const validation = validateCouponData({
      codigo_cupom: form.codigo_cupom,
      valor: form.valor,
      ativo: form.ativo,
    });
    if (!validation.valid || !validation.normalized) {
      setError(validation.error || 'Dados do cupom inválidos.');
      return;
    }

    setIsProcessing(true);
    setError(null);
    try {
      const result = await adminApi.saveCoupon(validation.normalized, editingCoupon?.id);
      setSuccessMessage(result.message);
      setIsEditing(false);
      await fetchCoupons();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar cupom.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setIsProcessing(true);
    setError(null);
    try {
      const result = await adminApi.deleteCoupon(deleteTarget.id);
      setSuccessMessage(result.message);
      setDeleteTarget(null);
      await fetchCoupons();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao excluir cupom.');
    } finally {
      setIsProcessing(false);
    }
  };

  const filteredCoupons = coupons.filter((coupon) => {
    if (statusFilter === 'ativos' && !coupon.ativo) return false;
    if (statusFilter === 'inativos' && coupon.ativo) return false;
    return !searchTerm || coupon.codigo_cupom.toLowerCase().includes(searchTerm.trim().toLowerCase());
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight text-white">
            <Ticket className="h-5 w-5 text-cyan-400" />
            Gestão de Cupons
          </h1>
          <p className="mt-1 text-xs text-slate-400">
            Gere códigos de resgate, defina o valor em KZ e acompanhe a utilização.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center gap-1.5 rounded-xl bg-cyan-600 px-3.5 py-2 text-xs font-semibold text-white shadow-md shadow-cyan-900/30 transition-colors hover:bg-cyan-500"
          >
            <Plus className="h-4 w-4" />
            Criar cupom
          </button>
          <button
            type="button"
            onClick={() => void fetchCoupons()}
            disabled={loading}
            aria-label="Atualizar cupons"
            className="rounded-xl border border-slate-800 bg-slate-900 p-2 text-slate-300 hover:bg-slate-800 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin text-cyan-400' : ''}`} />
          </button>
        </div>
      </div>

      {successMessage && (
        <GoogleToast type="success" message={successMessage} onClose={() => setSuccessMessage(null)} />
      )}
      {error && (
        <GoogleToast type="error" message={error} onClose={() => setError(null)} />
      )}

      <div className="flex flex-col gap-3 rounded-2xl border border-slate-800 bg-slate-900 p-4 sm:flex-row sm:items-center sm:justify-between">
        <input
          type="search"
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
          placeholder="Pesquisar código..."
          aria-label="Pesquisar cupom por código"
          className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-200 placeholder:text-slate-500 focus:border-cyan-500 focus:outline-none sm:max-w-xs"
        />
        <div className="flex items-center gap-3 text-xs">
          <label className="flex items-center gap-2 text-slate-400">
            Estado
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}
              className="rounded-lg border border-slate-800 bg-slate-950 px-2.5 py-2 text-slate-200"
            >
              <option value="todos">Todos</option>
              <option value="ativos">Ativos</option>
              <option value="inativos">Inativos</option>
            </select>
          </label>
          <span className="whitespace-nowrap text-slate-400">{filteredCoupons.length} cupons</span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {loading && (
          <div className="rounded-xl border border-slate-800 bg-slate-900 p-6 text-center text-sm text-slate-400 md:col-span-2 xl:col-span-3">
            A carregar cupons...
          </div>
        )}
        {!loading && filteredCoupons.length === 0 && (
          <div className="rounded-xl border border-slate-800 bg-slate-900 p-8 text-center text-sm text-slate-400 md:col-span-2 xl:col-span-3">
            Não há cupons para apresentar. Crie um cupom para partilhar um código de resgate.
          </div>
        )}
        {filteredCoupons.map((coupon) => (
          <article key={coupon.id} className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Código de resgate</span>
                <p className="mt-1 break-all font-mono text-lg font-bold tracking-wider text-white">
                  {coupon.codigo_cupom}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => openEdit(coupon)}
                  title="Editar cupom"
                  aria-label={`Editar cupom ${coupon.codigo_cupom}`}
                  className="rounded-lg bg-slate-800 p-2 text-slate-300 hover:text-white"
                >
                  <Edit2 className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setDeleteTarget(coupon)}
                  title="Excluir cupom"
                  aria-label={`Excluir cupom ${coupon.codigo_cupom}`}
                  className="rounded-lg bg-slate-800 p-2 text-slate-300 hover:text-rose-300"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="mt-4 space-y-2 rounded-xl border border-slate-800 bg-slate-950/70 p-3 text-xs">
              <div className="flex items-center justify-between gap-2">
                <span className="text-slate-400">Valor creditado</span>
                <strong className="font-mono text-sm text-emerald-300">{formatCurrency(coupon.valor)}</strong>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-slate-400">Resgates realizados</span>
                <span className="font-medium text-slate-200">{coupon.total_resgates}</span>
              </div>
              {coupon.usos_restantes !== undefined && (
                <div className="flex items-center justify-between gap-2">
                  <span className="text-slate-400">Usos restantes</span>
                  <span className="font-medium text-slate-200">{coupon.usos_restantes}</span>
                </div>
              )}
            </div>
            <div className="mt-3 flex items-center justify-between border-t border-slate-800 pt-3">
              <span className={`inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase ${coupon.ativo ? 'text-emerald-400' : 'text-slate-500'}`}>
                <span className={`h-2 w-2 rounded-full ${coupon.ativo ? 'bg-emerald-500' : 'bg-slate-600'}`} />
                {coupon.ativo ? 'Ativo para resgate' : 'Inativo'}
              </span>
              <span className="text-[10px] text-slate-500">ID: {coupon.id}</span>
            </div>
          </article>
        ))}
      </div>

      {isEditing && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="coupon-modal-title"
        >
          <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-slate-700 bg-slate-900 p-6 text-slate-100 shadow-2xl">
            <h2 id="coupon-modal-title" className="text-base font-bold text-white">
              {editingCoupon ? 'Editar cupom' : 'Criar cupom'}
            </h2>
            <p className="mb-5 mt-1 text-xs text-slate-400">
              Quem tiver o código poderá resgatá-lo na aplicação. Cada utilizador pode resgatar o mesmo cupom uma vez.
            </p>

            <div className="space-y-4 text-xs">
              <div>
                <label htmlFor="coupon-code" className="mb-1 block font-medium text-slate-300">Código do cupom</label>
                <div className="flex gap-2">
                  <input
                    id="coupon-code"
                    type="text"
                    maxLength={32}
                    autoComplete="off"
                    value={form.codigo_cupom}
                    onChange={(event) => setForm({ ...form, codigo_cupom: event.target.value.toUpperCase() })}
                    className="min-w-0 flex-1 rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 font-mono uppercase text-slate-100 focus:border-cyan-500 focus:outline-none"
                  />
                  {!editingCoupon && (
                    <button
                      type="button"
                      onClick={() => setForm({ ...form, codigo_cupom: generateCouponCode() })}
                      className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 font-medium text-slate-200 hover:bg-slate-700"
                    >
                      Gerar
                    </button>
                  )}
                </div>
                <p className="mt-1 text-[10px] text-slate-500">4 a 32 caracteres: letras, números, hífen ou sublinhado.</p>
              </div>

              <div>
                <label htmlFor="coupon-value" className="mb-1 block font-medium text-slate-300">Valor do cupom (KZ)</label>
                <input
                  id="coupon-value"
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={form.valor}
                  onChange={(event) => setForm({ ...form, valor: event.target.value })}
                  className="w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 font-mono text-slate-100 focus:border-cyan-500 focus:outline-none"
                />
              </div>

              <label className="flex cursor-pointer items-center gap-2 text-slate-300">
                <input
                  type="checkbox"
                  checked={form.ativo}
                  onChange={(event) => setForm({ ...form, ativo: event.target.checked })}
                  className="rounded border-slate-700 bg-slate-950 text-cyan-500 focus:ring-cyan-500"
                />
                Permitir novos resgates
              </label>
            </div>

            <div className="mt-6 flex items-center justify-end gap-3 border-t border-slate-800 pt-4">
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                disabled={isProcessing}
                className="rounded-xl bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-700 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void handleSave()}
                disabled={isProcessing}
                className="rounded-xl bg-cyan-600 px-4 py-2 text-xs font-semibold text-white hover:bg-cyan-500 disabled:opacity-50"
              >
                {isProcessing ? 'A guardar...' : 'Guardar cupom'}
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title={`Excluir cupom: ${deleteTarget?.codigo_cupom || ''}`}
        description={(
          <div className="space-y-2">
            <p>O cupom será removido da coleção <strong>cupons</strong> e deixará de poder ser resgatado.</p>
            <p>Os registos de saldo já gravados nos utilizadores não serão apagados.</p>
            <p className="text-rose-300">Esta ação não pode ser desfeita.</p>
          </div>
        )}
        confirmLabel="Excluir cupom"
        variant="danger"
        isProcessing={isProcessing}
      />
    </div>
  );
};
