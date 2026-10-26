import React, { useState } from 'react';
import { X, ZoomIn, ZoomOut, RotateCw, ExternalLink, ShieldCheck, AlertTriangle } from 'lucide-react';
import { isValidProofUrl } from '../../lib/adminLogic';

interface ProofViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageUrl: string | null;
  title: string;
  transactionMeta?: {
    referencia?: string;
    banco_origem?: string;
    titular_origem?: string;
    telefone_pagamento?: string;
    valor?: string | number;
    metodo?: string;
    usuario?: string;
  };
}

export const ProofViewerModal: React.FC<ProofViewerModalProps> = ({
  isOpen,
  onClose,
  imageUrl,
  title,
  transactionMeta,
}) => {
  const [zoom, setZoom] = useState<number>(1);
  const [rotation, setRotation] = useState<number>(0);

  if (!isOpen) return null;

  const isValidUrl = imageUrl ? isValidProofUrl(imageUrl) : false;

  const handleZoomIn = () => setZoom((z) => Math.min(z + 0.25, 3));
  const handleZoomOut = () => setZoom((z) => Math.max(z - 0.25, 0.5));
  const handleRotate = () => setRotation((r) => (r + 90) % 360);
  const handleReset = () => {
    setZoom(1);
    setRotation(0);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="proof-viewer-title"
    >
      <div className="relative w-full max-w-4xl bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden text-slate-100">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900/90">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 id="proof-viewer-title" className="text-base font-semibold text-white">
                {title}
              </h3>
              <p className="text-xs text-slate-400">
                Auditoria visual de comprovativo bancário
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            aria-label="Fechar visualizador"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Transaction Metadata Bar */}
        {transactionMeta && (
          <div className="bg-slate-950/70 border-b border-slate-800/80 px-6 py-2.5 grid grid-cols-2 sm:grid-cols-5 gap-3 text-xs">
            <div>
              <span className="text-slate-500 block">Referência:</span>
              <span className="font-mono font-medium text-slate-300">
                {transactionMeta.referencia || 'N/A'}
              </span>
            </div>
            <div>
              <span className="text-slate-500 block">Banco/Canal:</span>
              <span className="font-medium text-slate-300">
                {transactionMeta.banco_origem || transactionMeta.metodo || 'N/A'}
              </span>
            </div>
            <div>
              <span className="text-slate-500 block">Titular Declarado:</span>
              <span className="font-medium text-slate-300 truncate block">
                {transactionMeta.titular_origem || 'Não especificado'}
              </span>
            </div>
            <div>
              <span className="text-slate-500 block">Telefone Multicaixa:</span>
              <span className="font-medium text-slate-300">
                {transactionMeta.telefone_pagamento || 'N/A'}
              </span>
            </div>
            <div>
              <span className="text-slate-500 block">Utilizador:</span>
              <span className="font-medium text-emerald-400 font-mono">
                {transactionMeta.usuario || 'N/A'}
              </span>
            </div>
          </div>
        )}

        {/* Content / Canvas */}
        <div className="flex-1 overflow-auto p-4 flex items-center justify-center min-h-[360px] bg-slate-950 relative select-none">
          {!isValidUrl || !imageUrl ? (
            <div className="text-center p-8 max-w-md">
              <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                <AlertTriangle className="w-7 h-7" />
              </div>
              <h4 className="text-sm font-semibold text-slate-200 mb-1">
                Comprovativo não disponível ou URL inseguro
              </h4>
              <p className="text-xs text-slate-400">
                Não foi possível carregar a imagem deste comprovativo ou o link viola a política de segurança.
              </p>
            </div>
          ) : (
            <div
              className="transition-transform duration-150 ease-out flex items-center justify-center"
              style={{
                transform: `scale(${zoom}) rotate(${rotation}deg)`,
              }}
            >
              <img
                src={imageUrl}
                alt="Comprovativo de transação"
                className="max-h-[55vh] max-w-full object-contain rounded-lg shadow-lg border border-slate-800"
                loading="lazy"
              />
            </div>
          )}
        </div>

        {/* Footer with Controls */}
        <div className="px-6 py-3 border-t border-slate-800 bg-slate-900/90 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <button
              onClick={handleZoomIn}
              disabled={!isValidUrl || zoom >= 3}
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-40 transition-colors flex items-center gap-1.5"
              aria-label="Aumentar zoom"
            >
              <ZoomIn className="w-4 h-4" />
              <span>Zoom +</span>
            </button>
            <button
              onClick={handleZoomOut}
              disabled={!isValidUrl || zoom <= 0.5}
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-40 transition-colors flex items-center gap-1.5"
              aria-label="Diminuir zoom"
            >
              <ZoomOut className="w-4 h-4" />
              <span>Zoom -</span>
            </button>
            <button
              onClick={handleRotate}
              disabled={!isValidUrl}
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-40 transition-colors flex items-center gap-1.5"
              aria-label="Girar 90 graus"
            >
              <RotateCw className="w-4 h-4" />
              <span>Girar</span>
            </button>
            <button
              onClick={handleReset}
              disabled={!isValidUrl}
              className="px-2.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 transition-colors"
            >
              Repor ({Math.round(zoom * 100)}%)
            </button>
          </div>

          <div className="flex items-center gap-2">
            {isValidUrl && imageUrl && (
              <a
                href={imageUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors flex items-center gap-1.5 font-medium"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Abrir Original</span>
              </a>
            )}
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-white font-medium transition-colors"
            >
              Fechar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
