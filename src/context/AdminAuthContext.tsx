import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendEmailVerification,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth';
import { AdminUser, AdminRole } from '../types/admin';
import { adminApi } from '../services/adminApi';
import { auth, bootstrapAdminEmail } from '../lib/firebase';

interface AdminAuthContextType {
  user: AdminUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<boolean>;
  registerAdmin: (email: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  clearError: () => void;
}

const AdminAuthContext = createContext<AdminAuthContextType | undefined>(undefined);

function authErrorMessage(error: unknown, fallback: string): string {
  if (typeof error !== 'object' || error === null || !('code' in error)) {
    return error instanceof Error && error.message === 'Failed to fetch'
      ? 'Não foi possível contactar o servidor. Confirme se npm run dev está ativo e tente novamente.'
      : error instanceof Error ? error.message : fallback;
  }

  const code = String(error.code);
  const messages: Record<string, string> = {
    'auth/email-already-in-use': 'Este email já tem uma conta. Tente iniciar sessão.',
    'auth/invalid-credential': 'Email ou palavra-passe incorretos. Confirme os dados ou use o cadastro no primeiro acesso.',
    'auth/invalid-email': 'O endereço de email não é válido.',
    'auth/operation-not-allowed': 'O login por email e palavra-passe está desativado no Firebase Authentication.',
    'auth/too-many-requests': 'Muitas tentativas. Aguarde alguns minutos e tente novamente.',
    'auth/weak-password': 'A palavra-passe precisa ter pelo menos 6 caracteres.',
    'auth/network-request-failed': 'Falha de conexão com o Firebase. Verifique sua internet e tente novamente.',
    'auth/user-disabled': 'Esta conta está desativada. Contacte o administrador do Firebase.',
    'auth/user-not-found': 'Não existe uma conta com esse email. Use o cadastro no primeiro acesso.',
    'auth/wrong-password': 'Palavra-passe incorreta. Confirme-a ou tente recuperar o acesso.',
  };

  return messages[code] || (error instanceof Error ? error.message : fallback);
}

export const AdminAuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AdminUser | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const registrationInProgress = useRef(false);

  const verifyAdminSession = async (firebaseUser: NonNullable<typeof auth.currentUser>) => {
    let token = await firebaseUser.getIdToken(true);
    const bootstrap = await adminApi.bootstrapAdmin(token);
    if (!bootstrap.authorized) {
      throw new Error(bootstrap.error || 'A conta não possui permissões de administrador.');
    }
    if (bootstrap.claimsUpdated) {
      token = await firebaseUser.getIdToken(true);
    }

    const result = await adminApi.verifyAuth(token);
    if (!result.authorized || !result.user) {
      throw new Error(result.error || 'A conta não possui permissões de administrador.');
    }

    setUser({
      uid: result.user.uid,
      email: result.user.email,
      role: result.user.role as AdminRole,
      isSuperAdmin: result.user.isSuperAdmin,
    });
    setError(null);
  };

  useEffect(() => onAuthStateChanged(auth, async (firebaseUser) => {
    if (registrationInProgress.current) return;
    if (!firebaseUser) {
      setUser(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      await verifyAdminSession(firebaseUser);
    } catch (err) {
      setUser(null);
      setError(authErrorMessage(err, 'Falha na comunicação de autenticação.'));
      await signOut(auth);
    } finally {
      setIsLoading(false);
    }
  }), []);

  const login = async (email: string, password: string): Promise<boolean> => {
    setIsLoading(true);
    setError(null);
    try {
      const credential = await signInWithEmailAndPassword(auth, email, password);
      await verifyAdminSession(credential.user);
      return true;
    } catch (err) {
      setError(authErrorMessage(err, 'Erro na verificação de credenciais.'));
      await signOut(auth);
      setUser(null);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const registerAdmin = async (email: string, password: string): Promise<boolean> => {
    setIsLoading(true);
    setError(null);
    registrationInProgress.current = true;
    try {
      if (!bootstrapAdminEmail || email.trim().toLowerCase() !== bootstrapAdminEmail) {
        throw new Error('O cadastro está limitado ao email autorizado para administrador.');
      }

      const credential = await createUserWithEmailAndPassword(auth, email.trim(), password);
      await sendEmailVerification(credential.user);
      await signOut(auth);
      setUser(null);
      return true;
    } catch (err) {
      setError(authErrorMessage(err, 'Não foi possível criar a conta administrativa.'));
      return false;
    } finally {
      registrationInProgress.current = false;
      setIsLoading(false);
    }
  };

  const logout = async () => {
    await signOut(auth);
    setUser(null);
    setError(null);
  };

  const clearError = () => setError(null);

  return (
    <AdminAuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user && (user.role === 'admin' || user.role === 'superadmin'),
        isLoading,
        error,
        login,
        registerAdmin,
        logout,
        clearError,
      }}
    >
      {children}
    </AdminAuthContext.Provider>
  );
};

export function useAdminAuth() {
  const context = useContext(AdminAuthContext);
  if (!context) {
    throw new Error('useAdminAuth must be used within an AdminAuthProvider');
  }
  return context;
}
