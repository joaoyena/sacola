import React, { useState, useEffect } from 'react';
import {
  CreditCard,
  Building2,
  Smartphone,
  Coins,
  XCircle,
  Edit2,
  Plus,
  RefreshCw,
  Eye,
  Trash2,
} from 'lucide-react';
import { PaymentMethodItem } from '../../types/admin';
import { adminApi } from '../../services/adminApi';
import { ConfirmDialog } from '../../components/admin/ConfirmDialog';
import { GoogleToast } from '../../components/common/GoogleToast';

export const AdminPaymentMethods: React.FC = () => {
  const [methods, setMethods] = useState<PaymentMethodItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Form modal state
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [currentEdit, setCurrentEdit] = useState<Partial<PaymentMethodItem>>({});
  const [showPreview, setShowPreview] = useState<PaymentMethodItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PaymentMethodItem | null>(null);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  const fetchMethods = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await adminApi.getPaymentMethods();
      setMethods(data.items);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar coordenadas de depósito.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMethods();
  }, []);

  const handleOpenEdit = (method?: PaymentMethodItem) => {
    if (method) {
      setCurrentEdit({ ...method });
    } else {
      setCurrentEdit({
        id: `metodo_${Date.now()}`,
        tipo: 'banco',
        nome: '',
        banco: '',
        iban: '',
        conta: '',
        titular: '',
        instrucoes: '',
        ativo: true,
        ordem: methods.length + 1,
        limite_minimo: 5000,
        limite_maximo: 5000000,
      });
    }
    setIsEditing(true);
  };

  const handleSaveMethod = async () => {
    const missingBankOwner = currentEdit.tipo === 'banco' && !currentEdit.titular?.trim();
    const missingExpressPhone = currentEdit.tipo === 'multicaixa_express' && !currentEdit.telefone?.trim();
    const missingWalletDetails = currentEdit.tipo === 'cripto'
      && (!currentEdit.rede?.trim() || !currentEdit.endereco?.trim() || !currentEdit.titular?.trim());
    if (!currentEdit.id?.trim() || !currentEdit.nome?.trim() || missingBankOwner || missingExpressPhone || missingWalletDetails) {
      setError('Preencha o identificador, nome e os dados obrigatórios desta coordenada.');
      return;
    }
    setIsProcessing(true);
    try {
      const documentId = currentEdit.documentId || currentEdit.id;
      const res = await adminApi.savePaymentMethod(documentId, {
        ...currentEdit,
        isNew: !currentEdit.documentId,
      });
      setSuccessMessage(res.message);
      setIsEditing(false);
      await fetchMethods();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar coordenada.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleToggleActive = async (method: PaymentMethodItem) => {
    try {
      await adminApi.savePaymentMethod(method.documentId || method.id, {
        tipo: method.tipo,
        itemKey: method.itemKey,
        activeField: method.activeField,
        nome: method.nome,
        iban: method.iban,
        titular: method.titular,
        telefone: method.telefone,
        endereco: method.endereco,
        rede: method.rede,
        ativo: method.ativo !== true,
      });
      setSuccessMessage(`Coordenada ${method.nome} ${method.ativo === true ? 'desativada' : 'ativada'}.`);
      await fetchMethods();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao alterar o estado da coordenada.');
    }
  };

  const handleDeleteMethod = async () => {
    if (!deleteTarget) return;
    setIsProcessing(true);
    try {
      const result = await adminApi.deletePaymentMethod(
        deleteTarget.documentId || deleteTarget.id,
        deleteTarget.itemKey,
      );
      setSuccessMessage(result.message);
      setDeleteTarget(null);
      await fetchMethods();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao excluir coordenada.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-white tracking-tight">
            Coordenadas de Depósito (Coleção `pasta`)
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Gestão das contas bancárias, terminais Express e carteiras exibidas na recarga Teggram-X
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleOpenEdit()}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold shadow-md shadow-cyan-900/30 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>Adicionar Novo Canal</span>
          </button>
          <button
            onClick={fetchMethods}
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

      {/* Payment methods list */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {loading && (
          <div className="md:col-span-2 rounded-xl border border-slate-800 bg-slate-900 p-6 text-center text-sm text-slate-400">
            A carregar coordenadas de depósito...
          </div>
        )}
        {!loading && methods.length === 0 && (
          <div className="md:col-span-2 rounded-xl border border-slate-800 bg-slate-900 p-6 text-center text-sm text-slate-400">
            Nenhuma coordenada foi encontrada na coleção `pasta`.
          </div>
        )}
        {methods.map((m) => (
          <div
            key={m.id}
            className={`bg-slate-900 border ${
              m.ativo === true ? 'border-slate-800' : 'border-slate-800/50'
            } rounded-2xl p-5 shadow-lg flex flex-col justify-between`}
          >
            <div>
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-cyan-950/60 border border-cyan-800/50 flex items-center justify-center text-cyan-400 shrink-0">
                    {m.tipo === 'multicaixa_express' ? (
                      <Smartphone className="w-5 h-5" />
                    ) : m.tipo === 'cripto' ? (
                      <Coins className="w-5 h-5" />
                    ) : (
                      <Building2 className="w-5 h-5" />
                    )}
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                      <span>{m.nome}</span>
                      <span className="text-[10px] font-mono text-slate-500 uppercase">
                        {m.tipo === 'banco' ? 'Banco' : m.tipo === 'multicaixa_express' ? 'Express' : 'Carteira'}
                      </span>
                    </h3>
                    <p className="text-xs text-slate-400 font-mono">
                      Documento: <span className="text-slate-300">{m.documentId || m.id}</span>
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setShowPreview(m)}
                    className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-cyan-300 transition-colors"
                    title="Pré-visualizar ecrã do cliente"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleOpenEdit(m)}
                    className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-cyan-300 transition-colors"
                    title="Editar coordenada"
                    aria-label={`Editar ${m.nome}`}
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setDeleteTarget(m)}
                    className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-rose-300 transition-colors"
                    title="Excluir coordenada"
                    aria-label={`Excluir ${m.nome}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Data points */}
              <div className="bg-slate-950/70 border border-slate-800/80 rounded-xl p-3 space-y-1.5 text-xs text-slate-300 mb-3">
                <div className="flex justify-between gap-3">
                  <span className="text-slate-500">Titular da Conta:</span>
                  <span className="font-semibold text-slate-200 text-right">{m.titular || 'Não informado'}</span>
                </div>
                {m.tipo === 'banco' && (
                  <div className="flex justify-between gap-3 font-mono">
                    <span className="text-slate-500 font-sans">IBAN:</span>
                    <span className="text-cyan-400 text-right break-all">{m.iban || 'Temporariamente indisponível'}</span>
                  </div>
                )}
                {m.conta && (
                  <div className="flex justify-between font-mono">
                    <span className="text-slate-500 font-sans">Nº da Conta:</span>
                    <span>{m.conta}</span>
                  </div>
                )}
                {m.telefone && (
                  <div className="flex justify-between font-mono">
                    <span className="text-slate-500 font-sans">Terminal / Telefone:</span>
                    <span className="text-emerald-400">{m.telefone}</span>
                  </div>
                )}
                {m.tipo === 'multicaixa_express' && !m.telefone && (
                  <div className="flex justify-between">
                    <span className="text-slate-500 font-sans">Número Express:</span>
                    <span>Não informado</span>
                  </div>
                )}
                {m.endereco && (
                  <div className="flex justify-between font-mono text-[11px]">
                    <span className="text-slate-500 font-sans">Carteira ({m.rede}):</span>
                    <span className="truncate max-w-[200px] text-amber-400">{m.endereco}</span>
                  </div>
                )}
                {m.tipo === 'cripto' && m.rede && (
                  <div className="flex justify-between">
                    <span className="text-slate-500 font-sans">Rede:</span>
                    <span>{m.rede}</span>
                  </div>
                )}
              </div>

              {m.instrucoes && (
                <p className="text-[11px] text-slate-400 line-clamp-2 mb-3 italic">
                  "{m.instrucoes}"
                </p>
              )}
              {m.atualizado_em && (
                <p className="mb-2 text-[10px] text-slate-500">
                  Atualizado em {new Date(m.atualizado_em).toLocaleString('pt-PT')}
                </p>
              )}
            </div>

            <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
              <span
                className={`inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase ${
                  m.ativo === true ? 'text-emerald-400' : m.ativo === false ? 'text-slate-500' : 'text-amber-400'
                }`}
              >
                <span className={`w-2 h-2 rounded-full ${m.ativo === true ? 'bg-emerald-500' : m.ativo === false ? 'bg-slate-600' : 'bg-amber-500'}`}></span>
                {m.ativo === true ? 'Disponível (true)' : m.ativo === false ? 'Indisponível (false)' : 'Estado não definido'}
              </span>

              <button
                type="button"
                onClick={() => handleToggleActive(m)}
                disabled={isProcessing}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                  m.ativo === true
                    ? 'bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border border-rose-900/50'
                    : 'bg-emerald-950/40 hover:bg-emerald-900/60 text-emerald-300 border border-emerald-900/50'
                }`}
              >
                {m.ativo === true ? 'Desativar' : 'Ativar'}
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Client Screen Preview Modal */}
      {showPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="relative w-full max-w-sm bg-slate-900 border border-cyan-500/30 rounded-3xl p-6 shadow-2xl text-slate-100">
            <div className="text-center mb-4">
              <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-400 px-2 py-0.5 rounded-full bg-cyan-950 border border-cyan-800">
                Pré-visualização do Cliente (Teggram-X)
              </span>
              <h4 className="text-base font-bold text-white mt-2">{showPreview.nome}</h4>
            </div>

            <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 space-y-3 text-xs mb-4">
              <div>
                <span className="text-slate-500 block text-[10px]">BENEFICIÁRIO / TITULAR</span>
                <span className="font-semibold text-slate-100 text-sm">{showPreview.titular}</span>
              </div>
              {showPreview.iban && (
                <div>
                  <span className="text-slate-500 block text-[10px]">IBAN PARA TRANSFERÊNCIA</span>
                  <span className="font-mono text-cyan-300 font-bold tracking-tight block">
                    {showPreview.iban}
                  </span>
                </div>
              )}
              {showPreview.telefone && (
                <div>
                  <span className="text-slate-500 block text-[10px]">NÚMERO EXPRESS</span>
                  <span className="font-mono text-emerald-400 font-bold text-sm block">
                    {showPreview.telefone}
                  </span>
                </div>
              )}
              {showPreview.rede && (
                <div>
                  <span className="text-slate-500 block text-[10px]">REDE</span>
                  <span className="font-mono text-amber-300 block">{showPreview.rede}</span>
                </div>
              )}
              {showPreview.endereco && (
                <div>
                  <span className="text-slate-500 block text-[10px]">ENDEREÇO</span>
                  <span className="font-mono text-amber-300 break-all block">{showPreview.endereco}</span>
                </div>
              )}
              <div>
                <span className="text-slate-500 block text-[10px]">ESTADO</span>
                <span className={showPreview.ativo === true ? 'text-emerald-400' : 'text-slate-400'}>
                  {showPreview.ativo === true ? 'Disponível (true)' : showPreview.ativo === false ? 'Indisponível (false)' : 'Não definido'}
                </span>
              </div>
              {showPreview.instrucoes && (
                <div className="pt-2 border-t border-slate-800 text-[11px] text-slate-400 leading-relaxed">
                  {showPreview.instrucoes}
                </div>
              )}
            </div>

            <button
              onClick={() => setShowPreview(null)}
              className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-semibold transition-colors"
            >
              Fechar Visualização
            </button>
          </div>
        </div>
      )}

      {/* Edit / Create Form Modal */}
      {isEditing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="relative w-full max-w-lg bg-slate-900 border border-slate-700 rounded-2xl p-6 shadow-2xl text-slate-100 max-h-[90vh] overflow-y-auto">
            <h3 className="text-base font-bold text-white mb-1">
              {currentEdit.nome ? `Editar Canal: ${currentEdit.nome}` : 'Adicionar Nova Coordenada'}
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              Os dados salvos aqui serão atualizados no documento da coleção `pasta`.
            </p>

            <div className="space-y-3.5 text-xs">
              <div>
                <label className="text-slate-300 font-medium block mb-1">
                  ID do Documento (Canónico) <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  value={currentEdit.id || ''}
                  onChange={(e) => setCurrentEdit({ ...currentEdit, id: e.target.value })}
                  disabled={Boolean(currentEdit.documentId)}
                  placeholder="ex: metodo_bai_01 ou express_01"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 font-mono focus:border-cyan-500 disabled:opacity-60"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-slate-300 font-medium block mb-1">
                    Nome Exibido na App <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={currentEdit.nome || ''}
                    onChange={(e) => setCurrentEdit({ ...currentEdit, nome: e.target.value })}
                    placeholder="ex: Banco BAI ou Multicaixa Express"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:border-cyan-500"
                  />
                </div>
                <div>
                  <label className="text-slate-300 font-medium block mb-1">Tipo de Canal</label>
                  <select
                    value={currentEdit.tipo || 'banco'}
                    onChange={(e) => setCurrentEdit({ ...currentEdit, tipo: e.target.value as any })}
                    disabled={Boolean(currentEdit.documentId)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:border-cyan-500"
                  >
                    <option value="banco">Banco / Transferência</option>
                    <option value="multicaixa_express">Multicaixa Express</option>
                    <option value="cripto">Criptomoeda (USDT)</option>
                  </select>
                </div>
              </div>

              {currentEdit.tipo !== 'multicaixa_express' && (
                <div>
                  <label className="text-slate-300 font-medium block mb-1">
                    {currentEdit.tipo === 'cripto' ? 'Titular da carteira' : 'Titular da conta'} <span className="text-rose-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={currentEdit.titular || ''}
                    onChange={(e) => setCurrentEdit({ ...currentEdit, titular: e.target.value })}
                    placeholder="Nome do titular"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:border-cyan-500"
                  />
                </div>
              )}

              {currentEdit.tipo === 'banco' && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-slate-300 font-medium block mb-1">Nome do Banco</label>
                      <input
                        type="text"
                        value={currentEdit.banco || ''}
                        onChange={(e) => setCurrentEdit({ ...currentEdit, banco: e.target.value })}
                        placeholder="ex: Banco BAI"
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200"
                      />
                    </div>
                    <div>
                      <label className="text-slate-300 font-medium block mb-1">Nº da Conta</label>
                      <input
                        type="text"
                        value={currentEdit.conta || ''}
                        onChange={(e) => setCurrentEdit({ ...currentEdit, conta: e.target.value })}
                        placeholder="ex: 123456789"
                        className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 font-mono"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-slate-300 font-medium block mb-1">IBAN Oficial</label>
                    <input
                      type="text"
                      value={currentEdit.iban || ''}
                      onChange={(e) => setCurrentEdit({ ...currentEdit, iban: e.target.value })}
                      placeholder="AO0600400000..."
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 font-mono focus:border-cyan-500"
                    />
                  </div>
                </>
              )}

              {currentEdit.tipo === 'multicaixa_express' && (
                <div>
                  <label className="text-slate-300 font-medium block mb-1">
                    Número de Telefone Express
                  </label>
                  <input
                    type="text"
                    value={currentEdit.telefone || ''}
                    onChange={(e) => setCurrentEdit({ ...currentEdit, telefone: e.target.value })}
                    placeholder="923456789"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 font-mono"
                  />
                </div>
              )}

              {currentEdit.tipo === 'cripto' && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-slate-300 font-medium block mb-1">Rede</label>
                    <input
                      type="text"
                      value={currentEdit.rede || ''}
                      onChange={(e) => setCurrentEdit({ ...currentEdit, rede: e.target.value })}
                      placeholder="TRC-20"
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200"
                    />
                  </div>
                  <div>
                    <label className="text-slate-300 font-medium block mb-1">Endereço Carteira</label>
                    <input
                      type="text"
                      value={currentEdit.endereco || ''}
                      onChange={(e) => setCurrentEdit({ ...currentEdit, endereco: e.target.value })}
                      placeholder="T..."
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 font-mono"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="text-slate-300 font-medium block mb-1">
                  Instruções para o Utilizador
                </label>
                <textarea
                  rows={2}
                  value={currentEdit.instrucoes || ''}
                  onChange={(e) => setCurrentEdit({ ...currentEdit, instrucoes: e.target.value })}
                  placeholder="Orientações específicas sobre envio e anexo de talão..."
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200"
                />
              </div>

              <div>
                <label htmlFor="ativo-select" className="text-slate-300 font-medium block mb-1">
                  Estado da coordenada
                </label>
                <select
                  id="ativo-select"
                  value={currentEdit.ativo === undefined ? 'undefined' : String(currentEdit.ativo)}
                  onChange={(e) => setCurrentEdit({
                    ...currentEdit,
                    ativo: e.target.value === 'undefined' ? undefined : e.target.value === 'true',
                  })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:border-cyan-500"
                >
                  <option value="undefined">Não definido</option>
                  <option value="true">Disponível (true)</option>
                  <option value="false">Indisponível (false)</option>
                </select>
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
                onClick={handleSaveMethod}
                disabled={isProcessing}
                className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-xs font-semibold shadow-md"
              >
                {isProcessing ? 'Salvando...' : 'Salvar no Firestore'}
              </button>
            </div>
          </div>
        </div>
      )}
      <ConfirmDialog
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteMethod}
        title={`Excluir coordenada: ${deleteTarget?.nome || ''}`}
        description={(
          <div className="space-y-2">
            <p>Esta ação remove a coordenada de depósito da coleção <strong>pasta</strong>.</p>
            <p>Coordenada: <strong>{deleteTarget?.nome}</strong></p>
            <p className="text-rose-300">A exclusão não pode ser desfeita.</p>
          </div>
        )}
        confirmLabel="Excluir coordenada"
        variant="danger"
        isProcessing={isProcessing}
      />
    </div>
  );
};
