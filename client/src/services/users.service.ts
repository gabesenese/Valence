import { api, extractData } from './api';

export type UserRole = 'SUPER_ADMIN' | 'ADMIN' | 'ANALYST' | 'VIEWER';

export interface TeamMember {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

export const usersService = {
  listUsers: () => api.get('/auth/users').then(extractData<TeamMember[]>),

  updateRole: (id: string, role: UserRole) =>
    api.patch(`/auth/users/${id}/role`, { role }).then(extractData<TeamMember>),

  setActive: (id: string, isActive: boolean) =>
    api.patch(`/auth/users/${id}/active`, { isActive }).then(extractData<TeamMember>),
};
