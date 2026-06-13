import { api } from './api';

export interface BackupMeta {
  id: string;
  label: string;
  trigger: 'manual' | 'automated';
  sizeBytes: number;
  createdAt: string;
}

export interface RestoreResult {
  properties: number;
  tenants: number;
  leases: number;
  financialRecords: number;
}

export const backupService = {
  list: async (): Promise<BackupMeta[]> => {
    const res = await api.get('/backups');
    return (res.data as { data: BackupMeta[] }).data;
  },

  create: async (label?: string): Promise<BackupMeta> => {
    const res = await api.post('/backups', { label });
    return (res.data as { data: BackupMeta }).data;
  },

  restore: async (id: string): Promise<RestoreResult> => {
    const res = await api.post(`/backups/${id}/restore`);
    return (res.data as { data: RestoreResult }).data;
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/backups/${id}`);
  },

  downloadUrl: (id: string): string => `/api/backups/${id}/download`,
};
