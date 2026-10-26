import React, { useEffect } from 'react';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';

export interface GoogleToastProps {
  type?: 'error' | 'success' | 'info';
  title?: string;
  message: string;
  actionLabel?: string;
  duration?: number;
  onClose: () => void;
}

export const GoogleToast: React.FC<GoogleToastProps> = ({
  type = 'info',
  title,
  message,
  actionLabel = 'Dispensar',
  duration = 6000,
  onClose,
}) => {
  const isError = type === 'error';
  const isSuccess = type === 'success';

  useEffect(() => {
    if (duration <= 0) return undefined;
    const timer = window.setTimeout(onClose, duration);
    return () => window.clearTimeout(timer);
  }, [duration, onClose]);

  return (
    <div
      role={isError ? 'alert' : 'status'}
      aria-live="polite"
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-lg animate-google-toast"
    >
      <div
        className={`flex items-center gap-3.5 px-4 py-3 sm:px-5 sm:py-3.5 rounded-2xl md:rounded-full bg-[#202124] text-[#e8eaed] border border-[#3c4043]/80 shadow-[0_10px_35px_rgba(0,0,0,0.6)] backdrop-blur-xl transition-all select-none ${
          isError
            ? 'ring-1 ring-red-500/20'
            : isSuccess
            ? 'ring-1 ring-emerald-500/20'
            : 'ring-1 ring-blue-500/20'
        }`}
      >
        {/* Leading Google-style indicator icon */}
        <div className="shrink-0 flex items-center justify-center">
          {isError && (
            <div className="w-8 h-8 rounded-full bg-red-500/15 flex items-center justify-center text-[#f28b82]">
              <AlertCircle className="w-4 h-4" />
            </div>
          )}
          {isSuccess && (
            <div className="w-8 h-8 rounded-full bg-emerald-500/15 flex items-center justify-center text-[#81c995]">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          )}
          {!isError && !isSuccess && (
            <div className="w-8 h-8 rounded-full bg-blue-500/15 flex items-center justify-center text-[#8ab4f8]">
              <Info className="w-4 h-4" />
            </div>
          )}
        </div>

        {/* Content text */}
        <div className="min-w-0 flex-1 py-0.5">
          {title && (
            <p className="text-[13px] font-semibold text-white tracking-tight leading-snug">
              {title}
            </p>
          )}
          <p
            className={`text-[12px] sm:text-[13px] text-[#bdc1c6] leading-relaxed break-words ${
              title ? 'mt-0.5' : ''
            }`}
          >
            {message}
          </p>
        </div>

        {/* Google-style Action / Dismiss Button */}
        <div className="shrink-0 flex items-center gap-1">
          {actionLabel && (
            <button
              type="button"
              onClick={onClose}
              className="px-2.5 py-1 text-xs font-semibold uppercase tracking-wider text-[#8ab4f8] hover:text-[#aecbfa] hover:bg-white/5 active:bg-white/10 rounded-full transition-colors cursor-pointer"
            >
              {actionLabel}
            </button>
          )}

          <button
            type="button"
            aria-label="Fechar"
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-full text-[#9aa0a6] hover:text-white hover:bg-white/10 active:bg-white/15 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
