import { api, extractData } from './api';

export type IntegrationStatus = 'REQUESTED' | 'CONNECTED' | 'DISCONNECTED';

export interface IntegrationProvider {
  id: string;
  name: string;
  description: string;
  status: 'available' | 'planned';
  available: boolean;
  connection: {
    status: IntegrationStatus;
    lastSyncedAt: string | null;
    requestedAt: string;
  } | null;
}

export const integrationsService = {
  list: (): Promise<IntegrationProvider[]> =>
    api.get('/integrations').then(extractData<IntegrationProvider[]>),

  connect: (provider: string): Promise<unknown> =>
    api.post(`/integrations/${provider}/connect`).then(extractData),

  disconnect: (provider: string): Promise<unknown> =>
    api.delete(`/integrations/${provider}`).then(extractData),

  sync: (provider: string): Promise<{ properties: number; leases: number; tenants: number }> =>
    api.post(`/integrations/${provider}/sync`).then(extractData<{ properties: number; leases: number; tenants: number }>),
};
