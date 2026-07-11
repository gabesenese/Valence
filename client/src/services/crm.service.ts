import { api, extractData } from './api';

export type CrmStatus = 'ACTIVE' | 'AT_RISK' | 'HIGH_VALUE' | 'CHURNED';
export type ContactLogType = 'CALL' | 'EMAIL' | 'MEETING' | 'NOTE' | 'SITE_VISIT';

export interface CrmManager {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

export interface CrmLease {
  id: string;
  leaseNumber: string;
  baseRent: number;
  endDate: string;
  renewalRisk: string;
  renewalStage: string;
  property: { id: string; name: string; code: string };
}

export interface ContactLog {
  id: string;
  type: ContactLogType;
  body: string;
  createdAt: string;
  leaseId: string | null;
  user: { id: string; firstName: string; lastName: string } | null;
  lease: { id: string; leaseNumber: string } | null;
}

export interface CrmTenant {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  creditScore: number | null;
  notes: string | null;
  isActive: boolean;
  crmStatus: CrmStatus;
  renewalProbability: number | null;
  lastContactAt: string | null;
  createdAt: string;
  assignedManager: CrmManager | null;
  leases: CrmLease[];
  expiringSoon: number;
  totalMonthlyRent: number;
  _count: { contactLogs: number; leases: number };
}

export interface CrmTenantProfile extends CrmTenant {
  openAlerts: number;
  recentContacts: ContactLog[];
}

export interface CrmListResponse {
  data: CrmTenant[];
  meta: { total: number; page: number; limit: number; pages: number };
}

export const crmService = {
  getTenants: (params?: {
    search?: string;
    crmStatus?: CrmStatus;
    assignedManagerId?: string;
    page?: number;
    limit?: number;
  }) =>
    api.get('/crm/tenants', { params }).then(extractData<CrmListResponse>),

  getTenantProfile: (id: string) =>
    api.get(`/crm/tenants/${id}`).then(extractData<CrmTenantProfile>),

  updateTenant: (
    id: string,
    data: {
      crmStatus?: CrmStatus;
      renewalProbability?: number | null;
      assignedManagerId?: string | null;
      notes?: string;
    },
  ) => api.patch(`/crm/tenants/${id}`, data).then(extractData<Partial<CrmTenant>>),

  getContactLogs: (tenantId: string) =>
    api.get(`/crm/tenants/${tenantId}/contacts`).then(extractData<ContactLog[]>),

  addContactLog: (
    tenantId: string,
    data: { type: ContactLogType; body: string; leaseId?: string },
  ) =>
    api.post(`/crm/tenants/${tenantId}/contacts`, data).then(extractData<ContactLog>),

  deleteContactLog: (logId: string) =>
    api.delete(`/crm/contacts/${logId}`).then(extractData<{ deleted: boolean }>),

  emailTenant: (
    tenantId: string,
    data: { subject: string; body: string; leaseId?: string; fromLabel?: string },
  ) =>
    api.post(`/crm/tenants/${tenantId}/email`, data).then(extractData<ContactLog>),
};
