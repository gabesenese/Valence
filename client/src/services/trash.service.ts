import { api } from './api';

export interface TrashedProperty {
  id: string;
  name: string;
  code: string;
  type: string;
  city: string;
  state: string;
  deletedAt: string;
  daysLeft: number;
  purgesAt: string;
}

export interface TrashedLease {
  id: string;
  leaseNumber: string;
  baseRent: number;
  deletedAt: string;
  daysLeft: number;
  purgesAt: string;
  property: { id: string; name: string };
  tenant: { id: string; name: string };
}

export interface TrashedTenant {
  id: string;
  name: string;
  email?: string;
  company?: string;
  deletedAt: string;
  daysLeft: number;
  purgesAt: string;
}

export interface TrashData {
  properties: TrashedProperty[];
  leases: TrashedLease[];
  tenants: TrashedTenant[];
}

export type TrashItemType = 'property' | 'lease' | 'tenant';

export const trashService = {
  list: async (): Promise<TrashData> => {
    const res = await api.get('/trash');
    return (res.data as { data: TrashData }).data;
  },
  restore: async (type: TrashItemType, id: string): Promise<void> => {
    await api.post(`/trash/${type}/${id}/restore`);
  },
  purge: async (type: TrashItemType, id: string): Promise<void> => {
    await api.delete(`/trash/${type}/${id}`);
  },
  empty: async (): Promise<void> => {
    await api.delete('/trash/empty');
  },
};
