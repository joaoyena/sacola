import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
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
  const closeRef = useRef(onClose);
  const timerRef = useRef<number | null>(null);
  const remainingRef = useRef(duration);
  const startedAtRef = useRef(0);

  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    remainingRef.current = duration;
    if (duration <= 0) return undefined;

    const startTimer = () => {
      startedAtRef.current = Date.now();
      timerRef.current = window.setTimeout(() => closeRef.current(), remainingRef.current);
    };
    startTimer();

    return () => {
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
      timerRef.current = null;
    };
  }, [duration]);

  const pauseTimer = () => {
    if (timerRef.current === null) return;
    window.clearTimeout(timerRef.current);
    timerRef.current = null;
    remainingRef.current = Math.max(0, remainingRef.current - (Date.now() - startedAtRef.current));
  };

  const resumeTimer = () => {
    if (duration <= 0 || timerRef.current !== null || remainingRef.current <= 0) return;
    startedAtRef.current = Date.now();
    timerRef.current = window.setTimeout(() => closeRef.current(), remainingRef.current);
  };

  const dismiss = () => {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    timerRef.current = null;
    closeRef.current();
  };

  const Icon = isError ? AlertCircle : isSuccess ? CheckCircle2 : Info;
  const heading = title || (isError ? 'Ocorreu um erro' : isSuccess ? 'Concluído' : 'Informação');
  return createPortal(
    <div
      role={isError ? 'alert' : 'status'}
      aria-live={isError ? 'assertive' : 'polite'}
      onMouseEnter={pauseTimer}
      onMouseLeave={resumeTimer}
      onFocus={pauseTimer}
      onBlur={resumeTimer}
      className="animate-google-toast pointer-events-none fixed inset-x-0 top-5 z-[100] flex justify-center px-3"
    >
      <div className={`pointer-events-auto flex w-fit max-w-[min(26rem,100%)] items-start gap-3 rounded-2xl border bg-slate-900/95 p-4 text-slate-100 shadow-2xl shadow-black/40 backdrop-blur-xl ${
        isError
          ? 'border-rose-500/30'
          : isSuccess
          ? 'border-emerald-500/30'
          : 'border-cyan-500/30'
      }`}>
        <span className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
          isError
            ? 'bg-rose-500/10 text-rose-300'
            : isSuccess
            ? 'bg-emerald-500/10 text-emerald-300'
            : 'bg-cyan-500/10 text-cyan-300'
        }`}>
          <Icon className="h-5 w-5" aria-hidden="true" />
        </span>

        <div className="min-w-0 flex-1 pt-0.5">
          <p className="text-sm font-semibold leading-5 text-white">{heading}</p>
          <p className="mt-1 break-words text-sm leading-5 text-slate-300">{message}</p>
        </div>

        <button
          type="button"
          aria-label={actionLabel || 'Fechar notificação'}
          onClick={dismiss}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-white/10 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </div>,
    document.body,
  );
};
