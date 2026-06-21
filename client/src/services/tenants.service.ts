import { api, extractData, extractPaginated, type PaginatedResult } from './api';

export type CreditScoreSource = 'MANUAL' | 'EQUIFAX' | 'TRANSUNION';

export interface Tenant {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  company?: string;
  creditScore?: number;
  creditScoreSource?: CreditScoreSource;
  creditScoreDate?: string;
  isActive: boolean;
  createdAt: string;
  _count: { leases: number };
}

export interface TenantDetail extends Omit<Tenant, '_count'> {
  taxId?: string;
  notes?: string;
  _count: { leases: number };
  leases: Array<{
    id: string;
    leaseNumber: string;
    status: string;
    renewalRisk: string;
    baseRent: number;
    endDate: string;
    property: { id: string; name: string; code: string };
  }>;
}

export interface TenantQuery {
  page?: number;
  limit?: number;
  search?: string;
  isActive?: boolean;
}

export interface CreateTenantInput {
  name: string;
  email?: string;
  phone?: string;
  company?: string;
  taxId?: string;
  creditScore?: number;
  creditScoreSource?: CreditScoreSource;
  creditScoreDate?: string;
  notes?: string;
  isActive?: boolean;
}

export const tenantsService = {
  getTenants: (query: TenantQuery = {}): Promise<PaginatedResult<Tenant>> =>
    api.get('/tenants', { params: query }).then(extractPaginated<Tenant>),

  getTenant: (id: string): Promise<TenantDetail> =>
    api.get(`/tenants/${id}`).then(extractData<TenantDetail>),

  createTenant: (input: CreateTenantInput): Promise<Tenant> =>
    api.post('/tenants', input).then(extractData<Tenant>),

  updateTenant: (id: string, input: Partial<CreateTenantInput>): Promise<Tenant> =>
    api.patch(`/tenants/${id}`, input).then(extractData<Tenant>),
};
