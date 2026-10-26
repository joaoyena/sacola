import React, { useEffect, useState } from 'react';
import { LockKeyhole, Cpu, Loader2, UserPlus } from 'lucide-react';
import { useAdminAuth } from '../../context/AdminAuthContext';
import { GoogleToast } from '../../components/common/GoogleToast';

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
          <GoogleToast
            type={toast.type}
            title={toast.title}
            message={toast.message}
            onClose={() => setToast(null)}
          />
        )}

        <form onSubmit={handleSubmit} className="bg-slate-900/85 border border-slate-800/80 rounded-2xl p-7 shadow-2xl backdrop-blur-xl ring-1 ring-white/5 space-y-4.5">
          <div>
            <label htmlFor="admin-email" className="text-xs text-slate-300 font-medium block mb-1.5">
              Email
            </label>
            <input
              id="admin-email"
              type="email"
              autoComplete="username"
              required
              placeholder="admin@exemplo.com"
              value={email}
              onChange={(event) => {
                setEmail(event.target.value);
              }}
              className="w-full px-3.5 py-2.5 text-sm bg-slate-950/80 border border-slate-800 rounded-xl text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/25 focus:border-cyan-400 transition-all"
            />
          </div>

          <div>
            <label htmlFor="admin-password" className="text-xs text-slate-300 font-medium block mb-1.5">
              Palavra-passe
            </label>
            <input
              id="admin-password"
              type="password"
              autoComplete={isRegistering ? 'new-password' : 'current-password'}
              minLength={isRegistering ? 6 : undefined}
              required
              placeholder="••••••••"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full px-3.5 py-2.5 text-sm bg-slate-950/80 border border-slate-800 rounded-xl text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/25 focus:border-cyan-400 transition-all"
            />
          </div>

          {isRegistering && (
            <div>
              <label htmlFor="admin-password-confirm" className="text-xs text-slate-300 font-medium block mb-1.5">
                Confirmar palavra-passe
              </label>
              <input
                id="admin-password-confirm"
                type="password"
                autoComplete="new-password"
                minLength={6}
                required
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                className="w-full px-3.5 py-2.5 text-sm bg-slate-950/80 border border-slate-800 rounded-xl text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/25 focus:border-cyan-400 transition-all"
              />
              {confirmPassword && password !== confirmPassword && (
                <p className="mt-1 text-xs text-rose-300">As palavras-passe não coincidem.</p>
              )}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading || !email.trim() || !password || (isRegistering && password !== confirmPassword)}
            className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-medium text-sm flex items-center justify-center gap-2 shadow-lg shadow-cyan-900/30 hover:shadow-cyan-900/50 active:scale-[0.99] transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
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
            className="w-full py-1 text-xs text-cyan-300 hover:text-cyan-200 transition-colors cursor-pointer"
          >
            {isRegistering ? 'Já tem uma conta? Iniciar sessão' : 'Primeiro acesso? Cadastrar administrador'}
          </button>
        </form>
      </div>
    </div>
  );
};
