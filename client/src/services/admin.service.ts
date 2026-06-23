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

export interface AnalyticsData {
  mrr: number;
  arr: number;
  planDist: Record<string, number>;
  trialConvRate: number;
  signupTrend: { date: string; count: number }[];
  churn: { inactive14: number; inactive30: number; inactive60: number };
  cohorts: { week: string; users: number }[];
  adoption: { withProperties: number; withLeases: number; withAlerts: number; withTasks: number; withAI: number };
  slowAccounts: { id: string; email: string; firstName: string; lastName: string; plan: string; _count: { ownedProperties: number; ownedLeases: number; ownedTenants: number } }[];
}

export interface SystemData {
  db: { users: number; properties: number; leases: number; tenants: number; alerts: number; tasks: number; financialRecords: number };
  memory: { heapUsed: number; heapTotal: number; heapLimit: number; rss: number; systemUsed: number; systemTotal: number };
  uptime: number;
  recentErrors: { id: string; method: string; path: string; status: number; message: string; userId: string | null; createdAt: string }[];
}

export interface FeatureFlag {
  id: string;
  key: string;
  name: string;
  description: string | null;
  enabled: boolean;
  rules: { type: 'plan' | 'user'; value: string }[];
  createdAt: string;
  updatedAt: string;
}

export interface Announcement {
  id: string;
  title: string;
  body: string;
  type: 'INFO' | 'WARNING' | 'SUCCESS' | 'DANGER';
  target: 'ALL' | 'ESSENTIALS' | 'PROFESSIONAL' | 'EXECUTIVE';
  active: boolean;
  startsAt: string;
  endsAt: string | null;
  createdAt: string;
}

const h = (s: string) => ({ headers: { 'x-admin-secret': s } });

export const adminService = {
  getStats:  (s: string) => api.get<{ data: AdminStats }>('/admin/stats', h(s)).then((r) => r.data.data),
  getUsers:  (s: string, params: { search?: string; plan?: string; page?: number }) =>
    api.get<{ data: { users: AdminUser[]; total: number; pages: number } }>('/admin/users', { ...h(s), params }).then((r) => r.data.data),
  getAnalytics: (s: string) => api.get<{ data: AnalyticsData }>('/admin/analytics', h(s)).then((r) => r.data.data),
  getSystem:    (s: string) => api.get<{ data: SystemData }>('/admin/system', h(s)).then((r) => r.data.data),
  getAuditLog:  (s: string, page = 1) =>
    api.get<{ data: { logs: { id: string; action: string; entity: string; entityName: string | null; createdAt: string; user: { email: string; firstName: string; lastName: string } | null }[]; total: number; pages: number } }>('/admin/audit-log', { ...h(s), params: { page } }).then((r) => r.data.data),
  changePlan:        (s: string, id: string, plan: string)              => api.patch(`/admin/users/${id}/plan`,           { plan },       h(s)).then((r) => r.data),
  changeRole:        (s: string, id: string, role: string)              => api.patch(`/admin/users/${id}/role`,           { role },       h(s)).then((r) => r.data),
  setActive:         (s: string, id: string, isActive: boolean)         => api.patch(`/admin/users/${id}/active`,         { isActive },   h(s)).then((r) => r.data),
  setTrial:          (s: string, id: string, trialEndsAt: string | null) => api.patch(`/admin/users/${id}/trial`,         { trialEndsAt }, h(s)).then((r) => r.data),
  sendPasswordReset: (s: string, id: string)                            => api.post(`/admin/users/${id}/reset-password`,  {},             h(s)).then((r) => r.data),
  impersonate:       (s: string, id: string)                            => api.post<{ data: { token: string; user: AdminUser } }>(`/admin/users/${id}/impersonate`, {}, h(s)).then((r) => r.data.data),
  deleteUser:        (s: string, id: string)                            => api.delete(`/admin/users/${id}`,                               h(s)).then((r) => r.data),
  getFlags:          (s: string)                                         => api.get<{ data: FeatureFlag[] }>('/admin/flags', h(s)).then((r) => r.data.data),
  createFlag:        (s: string, data: Partial<FeatureFlag>)            => api.post<{ data: FeatureFlag }>('/admin/flags', data, h(s)).then((r) => r.data.data),
  updateFlag:        (s: string, id: string, data: Partial<FeatureFlag>) => api.patch<{ data: FeatureFlag }>(`/admin/flags/${id}`, data, h(s)).then((r) => r.data.data),
  deleteFlag:        (s: string, id: string)                            => api.delete(`/admin/flags/${id}`, h(s)).then((r) => r.data),
  getAnnouncements:   (s: string)                                        => api.get<{ data: Announcement[] }>('/admin/announcements', h(s)).then((r) => r.data.data),
  createAnnouncement: (s: string, data: Partial<Announcement>)          => api.post<{ data: Announcement }>('/admin/announcements', data, h(s)).then((r) => r.data.data),
  updateAnnouncement: (s: string, id: string, data: Partial<Announcement>) => api.patch<{ data: Announcement }>(`/admin/announcements/${id}`, data, h(s)).then((r) => r.data.data),
  deleteAnnouncement: (s: string, id: string)                           => api.delete(`/admin/announcements/${id}`, h(s)).then((r) => r.data),
  getMaintenance:     (s: string)                                        => api.get<{ data: { enabled: boolean; message: string } }>('/admin/maintenance', h(s)).then((r) => r.data.data),
  setMaintenance:     (s: string, enabled: boolean, message: string)    => api.patch('/admin/maintenance', { enabled, message }, h(s)).then((r) => r.data),
  getActiveAnnouncements: ()                                             => api.get<{ data: Announcement[] }>('/announcements').then((r) => r.data.data),
  getFunnel: (s: string, days = 30) =>
    api.get<{ data: { step: string; count: number; convRate: number | null }[] }>('/admin/funnel', { ...h(s), params: { days } }).then((r) => r.data.data),
};
