import { api, extractData, extractPaginated, type PaginatedResult } from './api';

export type AlertStatus = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'DISMISSED' | 'ACKNOWLEDGED' | 'SUPPRESSED';

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
  lease?: { id: string; leaseNumber: string };
  assignee?: { id: string; firstName: string; lastName: string } | null;
  resolutionNote?: string | null;
  metadata?: Record<string, unknown>;
  createdAt: string;
  resolvedAt?: string;
}

export interface AlertActivity {
  id: string;
  alertId: string;
  action: string;
  actorUserId?: string | null;
  actor?: { id: string; firstName: string; lastName: string } | null;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
}

export interface AlertSummary {
  openTotal: number;
  bySeverity: Array<{ severity: string; _count: number }>;
  byType: Array<{ type: string; _count: number }>;
  byStatus: Array<{ status: string; _count: number }>;
}

export const alertsService = {
  getAlerts: (query: Record<string, unknown> = {}): Promise<PaginatedResult<Alert>> =>
    api.get('/alerts', { params: query }).then(extractPaginated<Alert>),

  getSummary: (): Promise<AlertSummary> =>
    api.get('/alerts/summary').then(extractData<AlertSummary>),

  getActivity: (id: string): Promise<AlertActivity[]> =>
    api.get(`/alerts/${id}/activity`).then(extractData<AlertActivity[]>),

  progress: (id: string): Promise<Alert> =>
    api.post(`/alerts/${id}/progress`).then(extractData<Alert>),

  resolve: (id: string, note?: string): Promise<Alert> =>
    api.post(`/alerts/${id}/resolve`, { note }).then(extractData<Alert>),

  dismiss: (id: string, note?: string): Promise<Alert> =>
    api.post(`/alerts/${id}/dismiss`, { note }).then(extractData<Alert>),

  // Legacy
  acknowledge: (id: string): Promise<Alert> =>
    api.post(`/alerts/${id}/acknowledge`).then(extractData<Alert>),
};
