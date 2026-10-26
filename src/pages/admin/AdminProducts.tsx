import React, { useState, useEffect } from 'react';
import {
  Bot,
  Plus,
  Edit2,
  Trash2,
  RefreshCw,
  Search,
} from 'lucide-react';
import { ProductItem } from '../../types/admin';
import { adminApi } from '../../services/adminApi';
import { formatCurrency, parseFinancialValue, validateProductData } from '../../lib/adminLogic';
import { ConfirmDialog } from '../../components/admin/ConfirmDialog';
import { GoogleToast } from '../../components/common/GoogleToast';

export const AdminProducts: React.FC = () => {
  const [products, setProducts] = useState<ProductItem[]>([]);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'todos' | 'ativos' | 'inativos'>('todos');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Edit / Create modal state
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [isCreating, setIsCreating] = useState<boolean>(false);
  const [form, setForm] = useState<Partial<ProductItem>>({});
  const [deleteTarget, setDeleteTarget] = useState<ProductItem | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  const fetchProducts = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await adminApi.getProducts();
      setProducts(data.items);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar catálogo de produtos.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  const handleOpenEdit = (prod?: ProductItem) => {
    if (prod) {
      setForm({ ...prod });
      setIsCreating(false);
    } else {
      setIsCreating(true);
      setForm({
        id: '',
        nome: '',
        preco: '15000.00',
        renda_diaria: '750.00',
        duracao_dias: 30,
        limite_compra: 2,
        ativo: true,
        categoria: 'Bots IA',
        descricao: '',
      });
    }
    setIsEditing(true);
  };

  const handleSaveProduct = async () => {
    const val = validateProductData(form);
    if (!val.valid || !val.normalized) {
      setError(val.error || 'Dados inválidos.');
      return;
    }

    setIsProcessing(true);
    try {
      const res = await adminApi.saveProduct(val.normalized, isCreating);
      setSuccessMessage(res.message);
      setIsEditing(false);
      await fetchProducts();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar produto.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleToggleActive = async (prod: ProductItem) => {
    setIsProcessing(true);
    try {
      const result = await adminApi.setProductActive(prod.id, !prod.ativo);
      setSuccessMessage(result.message);
      await fetchProducts();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao alterar estado do produto.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeleteProduct = async () => {
    if (!deleteTarget) return;
    setIsProcessing(true);
    try {
      const result = await adminApi.deleteProduct(deleteTarget.id);
      setSuccessMessage(result.message);
      setDeleteTarget(null);
      await fetchProducts();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao excluir produto.');
    } finally {
      setIsProcessing(false);
    }
  };

  const filteredProducts = products.filter((p) => {
    if (statusFilter === 'ativos' && p.ativo !== true) return false;
    if (statusFilter === 'inativos' && p.ativo !== false) return false;
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return p.nome.toLowerCase().includes(term) || p.id.toLowerCase().includes(term);
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight">
            Gestão de Produtos & Bots (Coleção `produtos`)
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Configuração de parâmetros de rentabilidade, preços decimais e limites de ativação
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleOpenEdit()}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold shadow-md shadow-purple-900/30 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Criar Novo Bot</span>
          </button>
          <button
            onClick={fetchProducts}
            disabled={loading}
            className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:bg-slate-800"
            aria-label="Atualizar dados"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-cyan-400' : ''}`} />
          </button>
        </div>
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

      {/* Search */}
      <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 transform -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Pesquisar por nome ou ID..."
            className="w-full pl-9 pr-4 py-2 text-xs bg-slate-950 border border-slate-800 rounded-xl text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
          />
        </div>
        <div className="flex items-center gap-3">
          <label className="text-xs text-slate-400 flex items-center gap-2">
            Estado
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as typeof statusFilter)}
              className="rounded-lg border border-slate-800 bg-slate-950 px-2.5 py-2 text-xs text-slate-200"
            >
              <option value="todos">Todos</option>
              <option value="ativos">Ativos (true)</option>
              <option value="inativos">Desativados (false)</option>
            </select>
          </label>
          <span className="text-xs text-slate-400 font-medium">
            {filteredProducts.length} produtos
          </span>
        </div>
      </div>

      {/* Products Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading && (
          <div className="lg:col-span-3 md:col-span-2 rounded-xl border border-slate-800 bg-slate-900 p-6 text-center text-sm text-slate-400">
            A carregar produtos...
          </div>
        )}
        {!loading && filteredProducts.length === 0 && (
          <div className="lg:col-span-3 md:col-span-2 rounded-xl border border-slate-800 bg-slate-900 p-6 text-center text-sm text-slate-400">
            Nenhum produto encontrado para este filtro.
          </div>
        )}
        {filteredProducts.map((p) => {
          const preco = parseFinancialValue(p.preco);
          const renda = parseFinancialValue(p.renda_diaria);
          const retornoTotal = renda * p.duracao_dias;
          const roiPercent = preco > 0 ? Math.round(((retornoTotal - preco) / preco) * 100) : 0;

          return (
            <div
              key={p.id}
              className={`bg-slate-900 border ${
                p.ativo === true ? 'border-slate-800' : 'border-slate-800/50 opacity-70'
              } rounded-2xl p-5 shadow-lg flex flex-col justify-between hover:border-purple-500/40 transition-all`}
            >
              <div>
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-purple-950/60 border border-purple-800/50 flex items-center justify-center text-purple-400">
                      <Bot className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-white">{p.nome}</h3>
                      <span className="text-[10px] text-slate-500 font-mono block">
                        #{p.id}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => handleOpenEdit(p)}
                    className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white transition-colors"
                    title="Editar especificações"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setDeleteTarget(p)}
                    className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-rose-300 transition-colors"
                    title="Excluir produto"
                    aria-label={`Excluir produto ${p.nome}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                {/* Price and yields block */}
                <div className="bg-slate-950/80 border border-slate-800/80 rounded-xl p-3 space-y-2 mb-3 text-xs">
                  <div className="flex items-baseline justify-between">
                    <span className="text-slate-400">Preço de Ativação:</span>
                    <span className="font-mono font-bold text-white text-sm">
                      {formatCurrency(p.preco)}
                    </span>
                  </div>
                  <div className="flex items-baseline justify-between text-emerald-400">
                    <span className="text-slate-400">Rendimento Diário:</span>
                    <span className="font-mono font-bold">
                      +{formatCurrency(p.renda_diaria)}/dia
                    </span>
                  </div>
                  <div className="flex items-baseline justify-between text-slate-300">
                    <span className="text-slate-400">Duração do Ciclo:</span>
                    <span className="font-medium">{p.duracao_dias} dias</span>
                  </div>
                  <div className="pt-2 border-t border-slate-800/80 flex items-baseline justify-between text-[11px]">
                    <span className="text-purple-400 font-medium">Retorno Total Estimado:</span>
                    <span className="font-mono font-bold text-purple-300">
                      {formatCurrency(retornoTotal)} ({roiPercent > 0 ? `+${roiPercent}%` : '0%'})
                    </span>
                  </div>
                </div>

                <div className="text-[11px] text-slate-400 flex items-center justify-between mb-3">
                  <span>Limite por utilizador: <strong className="text-slate-200">{p.limite_compra} un</strong></span>
                  <span className="text-slate-500 font-mono text-[10px]">
                    Preço guardado: "{String(p.preco)}"
                  </span>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-800 flex items-center justify-between text-xs">
                <span
                  className={`inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase ${
                    p.ativo === true ? 'text-emerald-400' : 'text-slate-500'
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full ${p.ativo === true ? 'bg-emerald-500' : 'bg-slate-600'}`}></span>
                  {p.ativo === true ? 'Ativo (true)' : 'Desativado (false)'}
                </span>

                <button
                  type="button"
                  onClick={() => handleToggleActive(p)}
                  disabled={isProcessing}
                  className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                    p.ativo === true
                      ? 'bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border border-rose-900/50'
                      : 'bg-emerald-950/40 hover:bg-emerald-900/60 text-emerald-300 border border-emerald-900/50'
                  }`}
                >
                  {p.ativo === true ? 'Desativar' : 'Ativar'}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Edit / Create Modal */}
      {isEditing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="relative w-full max-w-md bg-slate-900 border border-slate-700 rounded-2xl p-6 shadow-2xl text-slate-100 max-h-[90vh] overflow-y-auto">
            <h3 className="text-base font-bold text-white mb-1">
              {isCreating ? 'Criar Novo Modelo de Bot' : `Editar Produto: ${form.nome}`}
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              Defina os parâmetros financeiros do produto. Os preços são salvos como strings decimais compatíveis.
            </p>

            <div className="space-y-3.5 text-xs">
              <div>
                <label className="text-slate-300 font-medium block mb-1">
                  Nome do Bot <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  value={form.nome || ''}
                  onChange={(e) => setForm({ ...form, nome: e.target.value })}
                  placeholder="ex: Teggram Bot Alfa v2"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="text-slate-300 font-medium block mb-1">
                  ID Canónico (Deixe vazio para gerar automaticamente)
                </label>
                <input
                  type="text"
                  value={form.id || ''}
                  onChange={(e) => setForm({ ...form, id: e.target.value })}
                  disabled={!isCreating}
                  placeholder="ex: bot_alfa_30d"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 font-mono disabled:opacity-60"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-300 font-medium block mb-1">
                    Preço (KZ) <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={String(form.preco ?? '')}
                    onChange={(e) => setForm({ ...form, preco: e.target.value })}
                    placeholder="10000.00"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 font-mono"
                  />
                </div>
                <div>
                  <label className="text-slate-300 font-medium block mb-1">
                    Rendimento Diário (KZ) <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={String(form.renda_diaria ?? '')}
                    onChange={(e) => setForm({ ...form, renda_diaria: e.target.value })}
                    placeholder="500.00"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-300 font-medium block mb-1">
                    Duração (Dias) <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={form.duracao_dias || 30}
                    onChange={(e) => setForm({ ...form, duracao_dias: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 font-mono"
                  />
                </div>
                <div>
                  <label className="text-slate-300 font-medium block mb-1">
                    Limite por Utilizador
                  </label>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={form.limite_compra || 1}
                    onChange={(e) => setForm({ ...form, limite_compra: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="text-slate-300 font-medium block mb-1">Descrição</label>
                <textarea
                  rows={2}
                  value={form.descricao || ''}
                  onChange={(e) => setForm({ ...form, descricao: e.target.value })}
                  placeholder="Detalhes sobre a estratégia do bot..."
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="bot-ativo-checkbox"
                  checked={Boolean(form.ativo)}
                  onChange={(e) => setForm({ ...form, ativo: e.target.checked })}
                  className="rounded bg-slate-950 border-slate-700 text-purple-600 focus:ring-0"
                />
                <label htmlFor="bot-ativo-checkbox" className="text-slate-300 font-medium cursor-pointer">
                  Disponível para aquisição pelos utilizadores
                </label>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-5 border-t border-slate-800 mt-5">
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                disabled={isProcessing}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveProduct}
                disabled={isProcessing}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-semibold shadow-md shadow-purple-900/30"
              >
                {isProcessing ? 'Salvando...' : 'Salvar no Catálogo'}
              </button>
            </div>
          </div>
        </div>
      )}
      <ConfirmDialog
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteProduct}
        title={`Excluir produto: ${deleteTarget?.nome || ''}`}
        description={(
          <div className="space-y-2">
            <p>O documento do produto será removido da coleção <strong>produtos</strong>.</p>
            <p>Produto: <strong>{deleteTarget?.nome}</strong> · ID: <strong>{deleteTarget?.id}</strong></p>
            <p className="text-rose-300">Esta ação não pode ser desfeita. Registos de compras existentes não serão apagados.</p>
          </div>
        )}
        confirmLabel="Excluir produto"
        variant="danger"
        isProcessing={isProcessing}
      />
    </div>
  );
};
