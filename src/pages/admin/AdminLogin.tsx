import React, { useEffect, useState } from 'react';
import { LockKeyhole, ShieldAlert, Cpu, Loader2, CheckCircle2, UserPlus, X } from 'lucide-react';
import { useAdminAuth } from '../../context/AdminAuthContext';

interface LoginToast {
  type: 'success' | 'error';
  title: string;
  message: string;
}

export const AdminLogin: React.FC = () => {
  const { login, registerAdmin, error, clearError, isLoading } = useAdminAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [toast, setToast] = useState<LoginToast | null>(null);

  useEffect(() => {
    if (!error) {
      setToast(null);
      return undefined;
    }

    setToast({
      type: 'error',
      title: isRegistering ? 'Não foi possível criar a conta' : 'Não foi possível iniciar sessão',
      message: error,
    });
    return undefined;
  }, [error, isRegistering]);

  useEffect(() => {
    if (!toast) return undefined;
    const timeout = window.setTimeout(() => setToast(null), 8000);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    clearError();
    setToast(null);

    if (isRegistering) {
      if (password !== confirmPassword) {
        return;
      }
      if (await registerAdmin(email, password)) {
        setToast({
          type: 'success',
          title: 'Conta criada',
          message: 'Verifique o email para confirmar o endereço e, depois, inicie sessão.',
        });
        setPassword('');
        setConfirmPassword('');
      }
      return;
    }

    await login(email.trim(), password);
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center p-4 text-slate-100 font-sans relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(14,165,233,0.15),rgba(255,255,255,0))] pointer-events-none" />

      <div className="w-full max-w-md relative z-10">
        <div className="text-center mb-8">
          <div className="inline-flex w-16 h-16 rounded-2xl bg-gradient-to-tr from-cyan-600 to-blue-600 items-center justify-center text-white shadow-xl shadow-cyan-950/60 mb-4 ring-1 ring-white/10">
            <Cpu className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            Teggram-X <span className="text-cyan-400">Admin Sentinel</span>
          </h1>
          <p className="text-xs text-slate-400 mt-1.5">
            {isRegistering ? 'Cadastro seguro do administrador autorizado' : 'Acesso seguro através da conta Firebase autorizada'}
          </p>
        </div>

        {toast && (
          <div
            role={toast.type === 'error' ? 'alert' : 'status'}
            className={`fixed right-4 top-4 z-50 flex w-[calc(100%-2rem)] max-w-sm items-start gap-3 rounded-xl border p-4 text-sm shadow-2xl ${
              toast.type === 'error'
                ? 'border-rose-800/60 bg-rose-950/95 text-rose-100'
                : 'border-emerald-800/60 bg-emerald-950/95 text-emerald-100'
            }`}
          >
            {toast.type === 'error'
              ? <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-rose-400" />
              : <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" />}
            <div className="min-w-0 flex-1">
              <p className="font-semibold">{toast.title}</p>
              <p className="mt-1 break-words leading-relaxed opacity-90">{toast.message}</p>
            </div>
            <button
              type="button"
              aria-label="Fechar notificação"
              onClick={() => setToast(null)}
              className="rounded p-1 opacity-70 transition hover:bg-white/10 hover:opacity-100"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-2xl backdrop-blur-md space-y-4">
          <div>
            <label htmlFor="admin-email" className="text-xs text-slate-300 font-medium block mb-1">
              Email
            </label>
            <input
              id="admin-email"
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(event) => {
                setEmail(event.target.value);
              }}
              className="w-full px-3 py-2 text-sm bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-cyan-500"
            />
          </div>

          <div>
            <label htmlFor="admin-password" className="text-xs text-slate-300 font-medium block mb-1">
              Palavra-passe
            </label>
            <input
              id="admin-password"
              type="password"
              autoComplete={isRegistering ? 'new-password' : 'current-password'}
              minLength={isRegistering ? 6 : undefined}
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full px-3 py-2 text-sm bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-cyan-500"
            />
          </div>

          {isRegistering && (
            <div>
              <label htmlFor="admin-password-confirm" className="text-xs text-slate-300 font-medium block mb-1">
                Confirmar palavra-passe
              </label>
              <input
                id="admin-password-confirm"
                type="password"
                autoComplete="new-password"
                minLength={6}
                required
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                className="w-full px-3 py-2 text-sm bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-cyan-500"
              />
              {confirmPassword && password !== confirmPassword && (
                <p className="mt-1 text-xs text-rose-300">As palavras-passe não coincidem.</p>
              )}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading || !email.trim() || !password || (isRegistering && password !== confirmPassword)}
            className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-medium text-sm flex items-center justify-center gap-2 shadow-md shadow-cyan-900/30 transition-all disabled:opacity-50"
          >
            {isLoading
              ? <Loader2 className="w-4 h-4 animate-spin" />
              : isRegistering ? <UserPlus className="w-4 h-4" /> : <LockKeyhole className="w-4 h-4" />}
            <span>
              {isLoading
                ? isRegistering ? 'A criar conta...' : 'A validar acesso...'
                : isRegistering ? 'Criar conta de administrador' : 'Entrar'}
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              setIsRegistering(!isRegistering);
              setToast(null);
              setPassword('');
              setConfirmPassword('');
              clearError();
            }}
            className="w-full text-xs text-cyan-300 hover:text-cyan-200 transition-colors"
          >
            {isRegistering ? 'Já tem uma conta? Iniciar sessão' : 'Primeiro acesso? Cadastrar administrador'}
          </button>
        </form>
      </div>
    </div>
  );
};
