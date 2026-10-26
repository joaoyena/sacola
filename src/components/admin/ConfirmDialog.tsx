import React, { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle2, Loader2, X } from 'lucide-react';

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (extraData?: { motivo?: string; valorPago?: number }) => Promise<void>;
  title: string;
  description: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'success' | 'warning' | 'primary';
  requireReason?: boolean;
  reasonPlaceholder?: string;
  expectedPaymentAmount?: number;
  isProcessing?: boolean;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  variant = 'primary',
  requireReason = false,
  reasonPlaceholder = 'Descreva o motivo desta decisão...',
  expectedPaymentAmount,
  isProcessing = false,
}) => {
  const [motivo, setMotivo] = useState<string>('');
  const [valorPago, setValorPago] = useState<string>('');
  const [inputError, setInputError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setMotivo('');
    setValorPago('');
    setInputError(null);
  }, [isOpen, title]);

  if (!isOpen) return null;

  const handleConfirm = async () => {
    if (requireReason && (!motivo || motivo.trim().length < 3)) {
      setInputError('O motivo é obrigatório (mínimo 3 caracteres).');
      return;
    }
    const parsedPaidAmount = Number(valorPago);
    if (expectedPaymentAmount !== undefined && (
      !valorPago.trim()
      || !Number.isFinite(parsedPaidAmount)
      || Math.round(parsedPaidAmount * 100) !== Math.round(expectedPaymentAmount * 100)
    )) {
      setInputError(`Informe exatamente ${expectedPaymentAmount.toFixed(2)} KZ, o valor líquido a pagar.`);
      return;
    }
    setInputError(null);
    await onConfirm({
      motivo: motivo.trim() || undefined,
      valorPago: expectedPaymentAmount === undefined ? undefined : parsedPaidAmount,
    });
    setMotivo('');
    setValorPago('');
  };

  const colors = {
    danger: {
      btn: 'bg-rose-600 hover:bg-rose-700 text-white',
      icon: 'text-rose-400 bg-rose-500/10 border-rose-500/20',
      border: 'border-rose-500/30',
    },
    success: {
      btn: 'bg-emerald-600 hover:bg-emerald-700 text-white',
      icon: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
      border: 'border-emerald-500/30',
    },
    warning: {
      btn: 'bg-amber-600 hover:bg-amber-700 text-white',
      icon: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
      border: 'border-amber-500/30',
    },
    primary: {
      btn: 'bg-cyan-600 hover:bg-cyan-700 text-white',
      icon: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20',
      border: 'border-cyan-500/30',
    },
  }[variant];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-150"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-modal-title"
    >
      <div className={`relative w-full max-w-md bg-slate-900 border ${colors.border} rounded-2xl shadow-2xl p-6 text-slate-100 overflow-hidden`}>
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl border flex items-center justify-center ${colors.icon}`}>
              {variant === 'success' ? (
                <CheckCircle2 className="w-5 h-5" />
              ) : (
                <AlertCircle className="w-5 h-5" />
              )}
            </div>
            <div>
              <h3 id="confirm-modal-title" className="text-base font-semibold text-white">
                {title}
              </h3>
              <p className="text-xs text-slate-400">Ação administrativa auditada</p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isProcessing}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors disabled:opacity-40"
            aria-label="Cancelar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="text-sm text-slate-300 mb-4 leading-relaxed">
          {description}
        </div>

        {/* Inputs */}
        <div className="space-y-3 mb-5">
          {requireReason && (
            <div>
              <label htmlFor="motivo-input" className="block text-xs font-medium text-slate-300 mb-1">
                Motivo da Decisão <span className="text-rose-400">*</span>
              </label>
              <textarea
                id="motivo-input"
                rows={3}
                value={motivo}
                onChange={(e) => {
                  setMotivo(e.target.value);
                  if (inputError) setInputError(null);
                }}
                disabled={isProcessing}
                placeholder={reasonPlaceholder}
                className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-700 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-colors"
              />
            </div>
          )}

          {expectedPaymentAmount !== undefined && (
            <div>
              <label htmlFor="payout-amount-input" className="block text-xs font-medium text-slate-300 mb-1">
                Valor efetivamente pago (KZ) <span className="text-rose-400">*</span>
              </label>
              <input
                id="payout-amount-input"
                type="number"
                min="0.01"
                step="0.01"
                value={valorPago}
                onChange={(e) => {
                  setValorPago(e.target.value);
                  if (inputError) setInputError(null);
                }}
                disabled={isProcessing}
                placeholder={expectedPaymentAmount.toFixed(2)}
                className="w-full px-3 py-2 text-xs bg-slate-950 border border-slate-700 rounded-lg text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition-colors font-mono"
              />
            </div>
          )}

          {inputError && (
            <span className="text-xs text-rose-400 block" role="alert">
              {inputError}
            </span>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
          <button
            type="button"
            onClick={onClose}
            disabled={isProcessing}
            className="px-4 py-2 text-xs font-medium text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={
              isProcessing
              || (requireReason && motivo.trim().length < 3)
              || (expectedPaymentAmount !== undefined && (
                !valorPago.trim()
                || !Number.isFinite(Number(valorPago))
                || Math.round(Number(valorPago) * 100) !== Math.round(expectedPaymentAmount * 100)
              ))
            }
            className={`px-4 py-2 text-xs font-semibold rounded-lg flex items-center gap-2 transition-all shadow-md disabled:opacity-50 ${colors.btn}`}
          >
            {isProcessing && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            <span>{isProcessing ? 'Processando...' : confirmLabel}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
