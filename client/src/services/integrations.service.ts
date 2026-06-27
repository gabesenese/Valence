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
  health: {
    lastSyncedAt: string | null;
    lastSuccessAt: string | null;
    nextSyncAt: string;
    failures30d: number;
    successRatePct: number | null;
    records: Record<string, number>;
  } | null;
}

export interface MappingQueue {
  entities: { sourceType: string; value: string; count: number }[];
  untaggedCount: number;
  pendingTotal: number;
  properties: { id: string; code: string; name: string }[];
}

export interface SyncRun {
  id: string;
  provider: string;
  status: 'running' | 'success' | 'partial' | 'error';
  startedAt: string;
  finishedAt: string | null;
  summary: {
    entities: Record<string, { created: number; updated: number; skipped: number; unmapped: number }>;
    errors: { entity?: string; message: string }[];
  } | null;
  error: string | null;
}

export const integrationsService = {
  list: (): Promise<IntegrationProvider[]> =>
    api.get('/integrations').then(extractData<IntegrationProvider[]>),

  history: (provider: string): Promise<SyncRun[]> =>
    api.get(`/integrations/${provider}/history`).then(extractData<SyncRun[]>),

  authorize: (provider: string): Promise<{ url: string }> =>
    api.get(`/integrations/${provider}/authorize`).then(extractData<{ url: string }>),

  mappingQueue: (provider: string): Promise<MappingQueue> =>
    api.get(`/integrations/${provider}/mapping-queue`).then(extractData<MappingQueue>),

  createMapping: (provider: string, body: { sourceType: string; sourceValue: string; propertyId: string }): Promise<{ resolved: number }> =>
    api.post(`/integrations/${provider}/mappings`, body).then(extractData<{ resolved: number }>),

  assignPending: (provider: string, body: { propertyId: string; untaggedOnly?: boolean; sourceType?: string; sourceValue?: string }): Promise<{ resolved: number }> =>
    api.post(`/integrations/${provider}/assign`, body).then(extractData<{ resolved: number }>),

  connect: (provider: string): Promise<unknown> =>
    api.post(`/integrations/${provider}/connect`).then(extractData),

  disconnect: (provider: string): Promise<unknown> =>
    api.delete(`/integrations/${provider}`).then(extractData),

  sync: (provider: string): Promise<{ properties: number; leases: number; tenants: number }> =>
    api.post(`/integrations/${provider}/sync`).then(extractData<{ properties: number; leases: number; tenants: number }>),
};
