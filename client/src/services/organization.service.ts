import { api, extractData } from './api';

export interface Organization {
  id: string;
  name: string;
  industry: string | null;
  timezone: string;
  currency: string;
  createdAt: string;
  updatedAt: string;
}

export const organizationService = {
  getOrganization: () =>
    api.get('/organization').then(extractData<Organization>),

  updateOrganization: (data: Partial<Pick<Organization, 'name' | 'industry' | 'timezone' | 'currency'>>) =>
    api.patch('/organization', data).then(extractData<Organization>),

  transferOwnership: (toUserId: string) =>
    api.post('/organization/transfer-ownership', { toUserId }).then(extractData<{ message: string }>),
};
