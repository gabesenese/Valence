import { api } from './api';

export interface DemoResult {
  message: string;
  properties: number;
  tenants: number;
  leases: number;
  alerts: number;
  tasks: number;
}

export const demoService = {
  loadDemo: () => api.post<{ data: DemoResult }>('/demo/load').then((r) => r.data.data),
  resetDemo: () => api.post('/demo/reset').then((r) => r.data),
};
