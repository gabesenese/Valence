import { api, extractData } from './api';

export type IntegrationStatus = 'REQUESTED' | 'CONNECTED' | 'DISCONNECTED';
export type ConnectorCategory = 'property_management' | 'accounting' | 'crm' | 'storage';

export const CONNECTOR_CATEGORY_LABEL: Record<ConnectorCategory, string> = {
  property_management: 'Property Management',
  accounting:          'Accounting',
  crm:                 'CRM',
  storage:             'Storage',
};

export interface IntegrationProvider {
  id: string;
  name: string;
  description: string;
  category: ConnectorCategory;
  authType: 'oauth2' | 'api_key';
  status: 'available' | 'planned';
  available: boolean;
  connection: {
    status: IntegrationStatus;
    lastSyncedAt: string | null;
    requestedAt: string;
  } | null;
}

export interface SyncRun {
  id: string;
  provider: string;
  status: 'running' | 'success' | 'partial' | 'error';
  startedAt: string;
  finishedAt: string | null;
  summary: {
    entities: Record<string, { created: number; updated: number; skipped: number }>;
    errors: { entity?: string; message: string }[];
  } | null;
  error: string | null;
}

export const integrationsService = {
  list: (): Promise<IntegrationProvider[]> =>
    api.get('/integrations').then(extractData<IntegrationProvider[]>),

  history: (provider: string): Promise<SyncRun[]> =>
    api.get(`/integrations/${provider}/history`).then(extractData<SyncRun[]>),

  connect: (provider: string): Promise<unknown> =>
    api.post(`/integrations/${provider}/connect`).then(extractData),

  disconnect: (provider: string): Promise<unknown> =>
    api.delete(`/integrations/${provider}`).then(extractData),

  sync: (provider: string): Promise<{ properties: number; leases: number; tenants: number }> =>
    api.post(`/integrations/${provider}/sync`).then(extractData<{ properties: number; leases: number; tenants: number }>),
};
