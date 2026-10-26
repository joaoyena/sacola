/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { AdminAuthProvider, useAdminAuth } from './context/AdminAuthContext';
import { AdminLayout } from './components/admin/AdminLayout';
import { AdminLogin } from './pages/admin/AdminLogin';
import { AdminDashboard } from './pages/admin/AdminDashboard';
import { AdminRecharges } from './pages/admin/AdminRecharges';
import { AdminWithdrawals } from './pages/admin/AdminWithdrawals';
import { AdminPaymentMethods } from './pages/admin/AdminPaymentMethods';
import { AdminProducts } from './pages/admin/AdminProducts';
import { AdminUsers } from './pages/admin/AdminUsers';
import { AdminAudit } from './pages/admin/AdminAudit';
import { Loader2 } from 'lucide-react';

const routePaths: Record<string, string> = {
  dashboard: '/admin',
  recharges: '/admin/recharges',
  withdrawals: '/admin/withdrawals',
  'payment-methods': '/admin/payment-methods',
  products: '/admin/products',
  users: '/admin/users',
  audit: '/admin/audit',
};

function routeFromLocation(): { tab: string; filter: string } {
  const tab = Object.entries(routePaths).find(([, path]) => path === window.location.pathname)?.[0]
    || (window.location.pathname === '/' ? 'dashboard' : 'not-found');
  const filter = new URLSearchParams(window.location.search).get('filter') || 'todos';
  return { tab, filter };
}

function AdminContent() {
  const { isAuthenticated, isLoading, user } = useAdminAuth();
  const [route, setRoute] = useState(routeFromLocation);
  const { tab: currentTab, filter: activeFilter } = route;

  const handleNavigateWithFilter = (tab: string, filter?: string) => {
    const path = routePaths[tab];
    if (!path) return;

    const query = filter && filter !== 'todos'
      ? `?filter=${encodeURIComponent(filter)}`
      : '';
    window.history.pushState({}, '', `${path}${query}`);
    setRoute({ tab, filter: filter || 'todos' });
  };

  useEffect(() => {
    const syncRoute = () => setRoute(routeFromLocation());
    window.addEventListener('popstate', syncRoute);
    return () => window.removeEventListener('popstate', syncRoute);
  }, []);

  useEffect(() => {
    if (isAuthenticated && window.location.pathname === '/') {
      window.history.replaceState({}, '', routePaths.dashboard);
      setRoute({ tab: 'dashboard', filter: 'todos' });
    }
  }, [isAuthenticated]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-100">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-cyan-600/20 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
          <p className="text-xs font-medium text-slate-400 tracking-wide uppercase">
            A validar Custom Claims do Administrador...
          </p>
        </div>
      </div>
    );
  }

  // If user is not authenticated or lacks admin claim, show AdminLogin (with Access Denied status if applicable)
  if (!isAuthenticated || !user) {
    return <AdminLogin />;
  }

  if (currentTab === 'not-found') {
    return (
      <AdminLayout currentTab="" onSelectTab={handleNavigateWithFilter}>
        <div className="mx-auto max-w-lg py-20 text-center">
          <h1 className="text-xl font-bold text-white">Página não encontrada</h1>
          <p className="mt-2 text-sm text-slate-400">A rota não corresponde a uma página do painel.</p>
          <button
            type="button"
            onClick={() => handleNavigateWithFilter('dashboard')}
            className="mt-6 rounded-lg bg-cyan-600 px-4 py-2 text-sm font-semibold text-white hover:bg-cyan-500"
          >
            Voltar ao painel
          </button>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout currentTab={currentTab} onSelectTab={(tab) => handleNavigateWithFilter(tab)}>
      {currentTab === 'dashboard' && <AdminDashboard onNavigate={handleNavigateWithFilter} />}
      {currentTab === 'recharges' && <AdminRecharges initialFilter={activeFilter} />}
      {currentTab === 'withdrawals' && <AdminWithdrawals initialFilter={activeFilter} />}
      {currentTab === 'payment-methods' && <AdminPaymentMethods />}
      {currentTab === 'products' && <AdminProducts />}
      {currentTab === 'users' && <AdminUsers />}
      {currentTab === 'audit' && <AdminAudit />}
    </AdminLayout>
  );
}

export default function App() {
  return (
    <AdminAuthProvider>
      <AdminContent />
    </AdminAuthProvider>
  );
}
