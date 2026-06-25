import { api, extractData, extractPaginated, type PaginatedResult } from './api';
import type { RenewalStage, LeaseActivityDTO, LeaseNoteDTO } from '@valence/shared';

export type { RenewalStage, LeaseActivityDTO, LeaseNoteDTO };

export interface LeaseFinancialRecord {
  id: string;
  type: string;
  status: string;
  amount: number;
  periodStart: string;
  periodEnd: string;
  paidDate?: string | null;
  dueDate?: string | null;
  description?: string | null;
  discrepancy?: number | null;
}

export interface LeaseAlert {
  id: string;
  type: string;
  severity: string;
  status: string;
  title: string;
  description: string;
  createdAt: string;
}

export interface LeaseOwner {
  id: string;
  firstName: string;
  lastName: string;
}

export interface Lease {
  id: string;
  leaseNumber: string;
  propertyId: string;
  tenantId: string;
  unitNumber?: string | null;
  type: string;
  status: string;
  renewalRisk: string;
  renewalStage: RenewalStage;
  startDate: string;
  endDate: string;
  renewalDate?: string | null;
  renewalScheduledAt?: string | null;
  lastContactedAt?: string | null;
  snoozedUntil?: string | null;
  reviewedAt?: string | null;
  baseRent: number;
  rentEscalation: number;
  securityDeposit?: number | null;
  sqft?: number | null;
  lateFeeType?: string | null;
  lateFeeFlat?: number | null;
  lateFeePercent?: number | null;
  lateFeeGraceDays?: number | null;
  lateFeeInterestPct?: number | null;
  notes?: string | null;
  ownerUserId?: string | null;
  property: { id: string; name: string; code: string };
  tenant: { id: string; name: string; email?: string | null };
  owner?: LeaseOwner | null;
  alerts?: LeaseAlert[];
  financialRecords?: LeaseFinancialRecord[];
  openAlertCount?: number;
  createdAt: string;
}

export interface PriorityLease extends Lease {
  priorityScore: number;
  whyThisIsHere: string;
}

export interface PaymentPoint {
  period: string;
  amount: number;
  status: string;
}

export interface LeasePreview {
  lease: Lease;
  paymentSeries: PaymentPoint[];
  priorityScore: number;
  whyThisIsHere: string;
}

export interface KanbanLease {
  id: string;
  leaseNumber: string;
  tenantName: string;
  propertyName: string;
  unitNumber?: string | null;
  endDate: string;
  renewalRisk: string;
  renewalStage: RenewalStage;
  baseRent: number;
  owner: { id: string; firstName: string; lastName: string } | null;
  openAlerts: number;
  criticalAlerts: number;
}

export interface KanbanColumn {
  stage: RenewalStage;
  count: number;
  totalRent: number;
  leases: KanbanLease[];
}

export interface LeaseStats {
  byStatus: Array<{ status: string; _count: number }>;
  byRisk: Array<{ renewalRisk: string; _count: number }>;
  expiringIn30: number;
  expiringIn90: number;
  totalActive: number;
}

export interface LeaseQuery {
  page?: number;
  limit?: number;
  status?: string;
  renewalRisk?: string;
  renewalStage?: RenewalStage;
  propertyId?: string;
  ownerUserId?: string;
  expiringWithinDays?: number;
  hasAlerts?: boolean;
  search?: string;
  sortBy?: 'endDate' | 'baseRent' | 'createdAt';
  sortOrder?: 'asc' | 'desc';
}

export interface BulkActionPayload {
  ids: string[];
  action: 'assignOwner' | 'startRenewal' | 'markReviewed' | 'addNote' | 'exportCsv';
  ownerUserId?: string;
  note?: string;
}

export interface CreateLeaseInput {
  propertyId: string;
  tenantId: string;
  unitNumber?: string;
  type: string;
  startDate: string;
  endDate: string;
  baseRent: number;
  rentEscalation?: number;
  securityDeposit?: number;
  sqft?: number;
  lateFeeType?: string;
  lateFeeFlat?: number | null;
  lateFeePercent?: number | null;
  lateFeeGraceDays?: number;
  lateFeeInterestPct?: number | null;
  notes?: string;
}

export const leasesService = {
  getLeases: (query: LeaseQuery = {}): Promise<PaginatedResult<Lease>> =>
    api.get('/leases', { params: query }).then(extractPaginated<Lease>),

  getPriorityQueue: (): Promise<PriorityLease[]> =>
    api.get('/leases/priority-queue').then(extractData<PriorityLease[]>),

  getKanban: (): Promise<KanbanColumn[]> =>
    api.get('/leases/kanban').then(extractData<KanbanColumn[]>),

  getLease: (id: string): Promise<Lease> =>
    api.get(`/leases/${id}`).then(extractData<Lease>),

  getPreview: (id: string): Promise<LeasePreview> =>
    api.get(`/leases/${id}/preview`).then(extractData<LeasePreview>),

  getActivity: (id: string): Promise<LeaseActivityDTO[]> =>
    api.get(`/leases/${id}/activity`).then(extractData<LeaseActivityDTO[]>),

  getNotes: (id: string): Promise<LeaseNoteDTO[]> =>
    api.get(`/leases/${id}/notes`).then(extractData<LeaseNoteDTO[]>),

  createLease: (input: CreateLeaseInput): Promise<Lease> =>
    api.post('/leases', input).then(extractData<Lease>),

  updateLease: (id: string, data: Record<string, unknown>): Promise<Lease> =>
    api.patch(`/leases/${id}`, data).then(extractData<Lease>),

  setRenewalDate: (id: string, renewalDate: string): Promise<Lease> =>
    api.patch(`/leases/${id}`, { renewalDate }).then(extractData<Lease>),

  getStats: (): Promise<LeaseStats> =>
    api.get('/leases/stats').then(extractData<LeaseStats>),

  startRenewal: (id: string): Promise<Lease> =>
    api.post(`/leases/${id}/start-renewal`).then(extractData<Lease>),

  setRenewalDateAction: (id: string, renewalDate: string): Promise<Lease> =>
    api.post(`/leases/${id}/set-renewal-date`, { renewalDate }).then(extractData<Lease>),

  assignOwner: (id: string, ownerUserId: string): Promise<Lease> =>
    api.post(`/leases/${id}/assign-owner`, { ownerUserId }).then(extractData<Lease>),

  markContacted: (id: string): Promise<Lease> =>
    api.post(`/leases/${id}/mark-contacted`).then(extractData<Lease>),

  snooze: (id: string, days = 7): Promise<Lease> =>
    api.post(`/leases/${id}/snooze`, { days }).then(extractData<Lease>),

  advanceStage: (id: string, stage: RenewalStage): Promise<Lease> =>
    api.post(`/leases/${id}/advance-stage`, { stage }).then(extractData<Lease>),

  clearRenewalDate: (id: string): Promise<Lease> =>
    api.post(`/leases/${id}/clear-renewal-date`).then(extractData<Lease>),

  addNote: (id: string, body: string): Promise<LeaseNoteDTO> =>
    api.post(`/leases/${id}/notes`, { body }).then(extractData<LeaseNoteDTO>),

  editNote: (id: string, noteId: string, body: string): Promise<LeaseNoteDTO> =>
    api.patch(`/leases/${id}/notes/${noteId}`, { body }).then(extractData<LeaseNoteDTO>),

  deleteLease: (id: string): Promise<{ deleted: boolean }> =>
    api.delete(`/leases/${id}`).then(extractData<{ deleted: boolean }>),

  deleteNote: (id: string, noteId: string): Promise<{ deleted: boolean }> =>
    api.delete(`/leases/${id}/notes/${noteId}`).then(extractData<{ deleted: boolean }>),

  bulk: (payload: BulkActionPayload): Promise<{ results?: Array<{ id: string; success: boolean }> }> =>
    api.post('/leases/bulk', payload).then(extractData<{ results?: Array<{ id: string; success: boolean }> }>),

  bulkExportCsv: async (ids: string[]): Promise<void> => {
    const res = await api.post('/leases/bulk', { ids, action: 'exportCsv' }, { responseType: 'blob' });
    const url = URL.createObjectURL(new Blob([res.data as BlobPart]));
    const a = document.createElement('a');
    a.href = url;
    a.download = 'leases.csv';
    a.click();
    URL.revokeObjectURL(url);
  },
};
