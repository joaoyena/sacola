import {
  DashboardMetrics,
  RechargeItem,
  WithdrawalItem,
  ProductItem,
  CouponItem,
  PaymentMethodItem,
  UserItem,
  AuditLog,
  UserSearchField,
} from '../types/admin';
import { auth } from '../lib/firebase';

class AdminApiClient {
  private async getHeaders(): Promise<Record<string, string>> {
    const user = auth.currentUser;
    if (!user) {
      throw new Error('A sua sessão terminou. Inicie sessão novamente.');
    }
    const token = await user.getIdToken();
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    };
  }

  async verifyAuth(token: string): Promise<{
    authorized: boolean;
    user?: { uid: string; email: string; role: string; isSuperAdmin: boolean };
    error?: string;
  }> {
    const res = await fetch('/api/admin/auth/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    });
    return await res.json();
  }

  async bootstrapAdmin(token: string): Promise<{
    authorized: boolean;
    claimsUpdated?: boolean;
    error?: string;
  }> {
    const res = await fetch('/api/admin/auth/bootstrap', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    return await res.json();
  }

  async getDashboard(): Promise<DashboardMetrics> {
    const res = await fetch('/api/admin/dashboard', {
      headers: await this.getHeaders(),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `Erro ${res.status}: Não foi possível carregar o dashboard.`);
    }
    return await res.json();
  }

  async getRecharges(params?: { status?: string; search?: string; page?: number; limit?: number }): Promise<{
    items: RechargeItem[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    const query = new URLSearchParams();
    if (params?.status) query.append('status', params.status);
    if (params?.search?.trim()) query.append('search', params.search.trim());
    if (params?.page) query.append('page', String(params.page));
    if (params?.limit) query.append('limit', String(params.limit));

    const res = await fetch(`/api/admin/recharges?${query.toString()}`, {
      headers: await this.getHeaders(),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Erro ao carregar recargas.');
    }
    return await res.json();
  }

  async approveRecharge(id: string): Promise<{ success: boolean; message: string; updatedRecord: RechargeItem }> {
    const res = await fetch(`/api/admin/recharges/${id}/approve`, {
      method: 'POST',
      headers: await this.getHeaders(),
      body: JSON.stringify({}),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Erro ao aprovar recarga.');
    }
    return data;
  }

  async rejectRecharge(id: string, motivo: string): Promise<{ success: boolean; message: string; updatedRecord: RechargeItem }> {
    const res = await fetch(`/api/admin/recharges/${id}/reject`, {
      method: 'POST',
      headers: await this.getHeaders(),
      body: JSON.stringify({ motivo }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Erro ao rejeitar recarga.');
    }
    return data;
  }

  async getWithdrawals(params?: { status?: string; page?: number; limit?: number }): Promise<{
    items: WithdrawalItem[];
    total: number;
    page: number;
    totalPages: number;
  }> {
    const query = new URLSearchParams();
    if (params?.status) query.append('status', params.status);
    if (params?.page) query.append('page', String(params.page));
    if (params?.limit) query.append('limit', String(params.limit));

    const res = await fetch(`/api/admin/withdrawals?${query.toString()}`, {
      headers: await this.getHeaders(),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Erro ao carregar saques.');
    }
    return await res.json();
  }

  async payWithdrawal(id: string, valorPago: number): Promise<{ success: boolean; message: string; updatedRecord: WithdrawalItem }> {
    const res = await fetch(`/api/admin/withdrawals/${id}/pay`, {
      method: 'POST',
      headers: await this.getHeaders(),
      body: JSON.stringify({ valorPago }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Erro ao pagar saque.');
    }
    return data;
  }

  async rejectWithdrawal(id: string, motivo: string): Promise<{ success: boolean; message: string; updatedRecord: WithdrawalItem }> {
    const res = await fetch(`/api/admin/withdrawals/${id}/reject`, {
      method: 'POST',
      headers: await this.getHeaders(),
      body: JSON.stringify({ motivo }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Erro ao rejeitar saque.');
    }
    return data;
  }

  async getProducts(): Promise<{ items: ProductItem[] }> {
    const res = await fetch('/api/admin/products', {
      headers: await this.getHeaders(),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Erro ao carregar produtos.');
    }
    return await res.json();
  }

  async saveProduct(product: Partial<ProductItem>, isNew = false): Promise<{ success: boolean; message: string; product: ProductItem }> {
    const res = await fetch('/api/admin/products', {
      method: 'POST',
      headers: await this.getHeaders(),
      body: JSON.stringify({ ...product, isNew }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Erro ao salvar produto.');
    }
    return data;
  }

  async deleteProduct(id: string): Promise<{ success: boolean; message: string }> {
    const res = await fetch(`/api/admin/products/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: await this.getHeaders(),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Erro ao excluir produto.');
    }
    return data;
  }

  async setProductActive(id: string, active: boolean): Promise<{ success: boolean; message: string }> {
    const res = await fetch(`/api/admin/products/${encodeURIComponent(id)}/status`, {
      method: 'PATCH',
      headers: await this.getHeaders(),
      body: JSON.stringify({ ativo: active }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Erro ao alterar disponibilidade do produto.');
    }
    return data;
  }

  async getCoupons(): Promise<{ items: CouponItem[] }> {
    const res = await fetch('/api/admin/coupons', {
      headers: await this.getHeaders(),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Erro ao carregar cupons.');
    }
    return await res.json();
  }

  async saveCoupon(
    coupon: Pick<CouponItem, 'codigo_cupom' | 'valor' | 'ativo'>,
    id?: string,
  ): Promise<{ success: boolean; message: string; coupon: CouponItem }> {
    const res = await fetch(
      id ? `/api/admin/coupons/${encodeURIComponent(id)}` : '/api/admin/coupons',
      {
        method: id ? 'PATCH' : 'POST',
        headers: await this.getHeaders(),
        body: JSON.stringify(coupon),
      },
    );
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Erro ao salvar cupom.');
    }
    return data;
  }

  async deleteCoupon(id: string): Promise<{ success: boolean; message: string }> {
    const res = await fetch(`/api/admin/coupons/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: await this.getHeaders(),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Erro ao excluir cupom.');
    }
    return data;
  }

  async getPaymentMethods(): Promise<{ items: PaymentMethodItem[] }> {
    const res = await fetch('/api/admin/payment-methods', {
      headers: await this.getHeaders(),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Erro ao carregar métodos de pagamento.');
    }
    return await res.json();
  }

  async savePaymentMethod(id: string, data: Partial<PaymentMethodItem>): Promise<{ success: boolean; message: string; method: PaymentMethodItem }> {
    const res = await fetch(`/api/admin/payment-methods/${id}`, {
      method: 'POST',
      headers: await this.getHeaders(),
      body: JSON.stringify(data),
    });
    const result = await res.json();
    if (!res.ok) {
      throw new Error(result.error || 'Erro ao atualizar método de pagamento.');
    }
    return result;
  }

  async deletePaymentMethod(id: string, itemKey?: string): Promise<{ success: boolean; message: string }> {
    const query = itemKey ? `?itemKey=${encodeURIComponent(itemKey)}` : '';
    const res = await fetch(`/api/admin/payment-methods/${encodeURIComponent(id)}${query}`, {
      method: 'DELETE',
      headers: await this.getHeaders(),
    });
    const result = await res.json();
    if (!res.ok) {
      throw new Error(result.error || 'Erro ao excluir coordenada de depósito.');
    }
    return result;
  }

  async getUsers(query?: string, searchBy?: UserSearchField): Promise<{
    items: UserItem[];
    total: number;
    stats: { investors: number; normalUsers: number };
  }> {
    const params = new URLSearchParams();
    if (query) params.set('query', query);
    if (searchBy) params.set('searchBy', searchBy);
    const q = params.size > 0 ? `?${params.toString()}` : '';
    const res = await fetch(`/api/admin/users${q}`, {
      headers: await this.getHeaders(),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Erro ao buscar utilizadores.');
    }
    return await res.json();
  }

  async toggleUserStatus(uid: string, status: 'ativo' | 'congelado', motivo?: string): Promise<{ success: boolean; message: string; user: UserItem }> {
    const res = await fetch(`/api/admin/users/${encodeURIComponent(uid)}/status`, {
      method: 'POST',
      headers: await this.getHeaders(),
      body: JSON.stringify({ status, motivo }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Erro ao alterar estado do utilizador.');
    }
    return data;
  }

  async updateUserBalance(uid: string, balance: number, motivo?: string): Promise<{ success: boolean; message: string }> {
    const res = await fetch(`/api/admin/users/${encodeURIComponent(uid)}/balance`, {
      method: 'POST',
      headers: await this.getHeaders(),
      body: JSON.stringify({ balance, motivo }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Erro ao atualizar o saldo do utilizador.');
    }
    return data;
  }

  async resetUserPassword(uid: string, password: string): Promise<{ success: boolean; message: string }> {
    const res = await fetch(`/api/admin/users/${encodeURIComponent(uid)}/password`, {
      method: 'POST',
      headers: await this.getHeaders(),
      body: JSON.stringify({ password }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Erro ao redefinir a palavra-passe do utilizador.');
    }
    return data;
  }

  async getAuditLogs(params?: { acao?: string; entidade?: string; admin_uid?: string }): Promise<{ items: AuditLog[]; total: number }> {
    const query = new URLSearchParams();
    if (params?.acao) query.append('acao', params.acao);
    if (params?.entidade) query.append('entidade', params.entidade);
    if (params?.admin_uid) query.append('admin_uid', params.admin_uid);

    const res = await fetch(`/api/admin/audit-logs?${query.toString()}`, {
      headers: await this.getHeaders(),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Erro ao carregar auditoria.');
    }
    return await res.json();
  }
}

export const adminApi = new AdminApiClient();
