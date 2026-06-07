import { api } from './api';

export interface AdminUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  plan: string;
  role: string;
  isActive: boolean;
  emailVerifiedAt: string | null;
  mfaEnabled: boolean;
  trialEndsAt: string | null;
  createdAt: string;
  lastLoginAt: string | null;
  _count: { ownedProperties: number; ownedLeases: number; ownedTenants: number };
}

export interface AdminStats {
  totalUsers: number;
  byPlan: Record<string, number>;
  signupsToday: number;
  signups7d: number;
  signups30d: number;
  activeTrials: number;
  emailVerified: number;
  mfaEnabled: number;
}

function headers(secret: string) {
  return { 'x-admin-secret': secret };
}

export const adminService = {
  getStats: (secret: string): Promise<AdminStats> =>
    api.get('/admin/stats', { headers: headers(secret) }).then((r) => r.data.data),

  getUsers: (secret: string, params?: { search?: string; plan?: string; page?: number }): Promise<{ users: AdminUser[]; total: number; pages: number }> =>
    api.get('/admin/users', { headers: headers(secret), params }).then((r) => r.data.data),

  changePlan: (secret: string, userId: string, plan: string): Promise<void> =>
    api.patch(`/admin/users/${userId}/plan`, { plan }, { headers: headers(secret) }).then(() => undefined),

  changeRole: (secret: string, userId: string, role: string): Promise<void> =>
    api.patch(`/admin/users/${userId}/role`, { role }, { headers: headers(secret) }).then(() => undefined),

  setActive: (secret: string, userId: string, isActive: boolean): Promise<void> =>
    api.patch(`/admin/users/${userId}/active`, { isActive }, { headers: headers(secret) }).then(() => undefined),

  sendPasswordReset: (secret: string, userId: string): Promise<void> =>
    api.post(`/admin/users/${userId}/reset-password`, {}, { headers: headers(secret) }).then(() => undefined),

  deleteUser: (secret: string, userId: string): Promise<void> =>
    api.delete(`/admin/users/${userId}`, { headers: headers(secret) }).then(() => undefined),
};
