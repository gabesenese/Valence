import { api, extractData, extractPaginated, type PaginatedResult } from './api';

export interface Alert {
  id: string;
  type: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  status: 'OPEN' | 'ACKNOWLEDGED' | 'RESOLVED' | 'SUPPRESSED';
  title: string;
  description: string;
  propertyId?: string;
  leaseId?: string;
  property?: { id: string; name: string; code: string };
  lease?: { id: string; leaseNumber: string };
  metadata?: Record<string, unknown>;
  createdAt: string;
  resolvedAt?: string;
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

  acknowledge: (id: string): Promise<Alert> =>
    api.post(`/alerts/${id}/acknowledge`).then(extractData<Alert>),

  resolve: (id: string): Promise<Alert> =>
    api.post(`/alerts/${id}/resolve`).then(extractData<Alert>),
};
