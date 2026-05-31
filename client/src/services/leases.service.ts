import { api, extractData, extractPaginated, type PaginatedResult } from './api';

export interface Lease {
  id: string;
  leaseNumber: string;
  propertyId: string;
  tenantId: string;
  unitNumber?: string;
  type: string;
  status: string;
  renewalRisk: string;
  startDate: string;
  endDate: string;
  baseRent: number;
  rentEscalation: number;
  securityDeposit?: number;
  sqft?: number;
  property: { id: string; name: string; code: string };
  tenant: { id: string; name: string; email?: string };
  createdAt: string;
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
  propertyId?: string;
  expiringWithinDays?: number;
  search?: string;
}

export const leasesService = {
  getLeases: (query: LeaseQuery = {}): Promise<PaginatedResult<Lease>> =>
    api.get('/leases', { params: query }).then(extractPaginated<Lease>),

  getLease: (id: string): Promise<Lease> =>
    api.get(`/leases/${id}`).then(extractData<Lease>),

  createLease: (data: Partial<Lease>): Promise<Lease> =>
    api.post('/leases', data).then(extractData<Lease>),

  updateLease: (id: string, data: Partial<Lease>): Promise<Lease> =>
    api.patch(`/leases/${id}`, data).then(extractData<Lease>),

  deleteLease: (id: string): Promise<void> =>
    api.delete(`/leases/${id}`).then(() => undefined),

  getStats: (): Promise<LeaseStats> =>
    api.get('/leases/stats').then(extractData<LeaseStats>),
};
