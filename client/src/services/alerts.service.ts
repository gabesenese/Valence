import { api, extractData, extractPaginated, type PaginatedResult } from './api';

export type AlertStatus = 'OPEN' | 'ACKNOWLEDGED' | 'IN_PROGRESS' | 'RESOLVED' | 'DISMISSED' | 'SUPPRESSED';

export interface AlertUser {
  id: string;
  firstName: string;
  lastName: string;
}

export interface Alert {
  id: string;
  type: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  status: AlertStatus;
  title: string;
  description: string;
  propertyId?: string;
  leaseId?: string;
  property?: { id: string; name: string; code: string };
  lease?: { id: string; leaseNumber: string; tenant?: { name: string } | null };
  assignee?: AlertUser | null;
  resolutionNote?: string | null;
  metadata?: Record<string, unknown>;
  createdAt: string;
  acknowledgedAt?: string | null;
  acknowledgedByUser?: AlertUser | null;
  resolvedAt?: string | null;
  resolvedByUser?: AlertUser | null;
  dismissedAt?: string | null;
  dismissedByUser?: AlertUser | null;
}

export interface AlertActivity {
  id: string;
  alertId: string;
  action: string;
  actorUserId?: string | null;
  actor?: AlertUser | null;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
}

export interface AlertSummary {
  openTotal: number;
  acknowledgedTotal: number;
  bySeverity: Array<{ severity: string; _count: number }>;
  byType: Array<{ type: string; _count: number }>;
  byStatus: Array<{ status: string; _count: number }>;
}

export const alertsService = {
  getAlerts: (query: Record<string, unknown> = {}): Promise<PaginatedResult<Alert>> => {
    const params = { ...query };
    if (Array.isArray(params.statuses)) {
      params.statuses = (params.statuses as string[]).join(',') as unknown;
    }
    return api.get('/alerts', { params }).then(extractPaginated<Alert>);
  },

  getSummary: (): Promise<AlertSummary> =>
    api.get('/alerts/summary').then(extractData<AlertSummary>),

  getActivity: (id: string): Promise<AlertActivity[]> =>
    api.get(`/alerts/${id}/activity`).then(extractData<AlertActivity[]>),

  acknowledge: (id: string): Promise<Alert> =>
    api.post(`/alerts/${id}/acknowledge`).then(extractData<Alert>),

  progress: (id: string): Promise<Alert> =>
    api.post(`/alerts/${id}/progress`).then(extractData<Alert>),

  resolve: (id: string, note?: string): Promise<Alert> =>
    api.post(`/alerts/${id}/resolve`, { note }).then(extractData<Alert>),

  dismiss: (id: string, note?: string): Promise<Alert> =>
    api.post(`/alerts/${id}/dismiss`, { note }).then(extractData<Alert>),

  dismissAll: (): Promise<{ dismissed: number }> =>
    api.post('/alerts/dismiss-all').then(extractData<{ dismissed: number }>),

  reopen: (id: string): Promise<Alert> =>
    api.post(`/alerts/${id}/reopen`).then(extractData<Alert>),

  assign: (id: string, assigneeUserId: string): Promise<Alert> =>
    api.post(`/alerts/${id}/assign`, { assigneeUserId }).then(extractData<Alert>),

  email: (id: string): Promise<{ sent: boolean; to: string }> =>
    api.post(`/alerts/${id}/email`).then(extractData<{ sent: boolean; to: string }>),
};
