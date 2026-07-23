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

export interface Invite {
  id: string;
  email: string;
  role: UserRole;
  token: string;
  expiresAt: string;
  createdAt: string;
  invitedBy: { firstName: string; lastName: string };
}

export interface InviteInfo {
  email: string;
  role: UserRole;
  expiresAt: string;
  invitedBy: { firstName: string; lastName: string };
}

export interface ProfileUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  plan: string;
  trialEndsAt: string | null;
}

export const usersService = {
  listUsers: () => api.get('/auth/users').then(extractData<TeamMember[]>),
  removeMember: (id: string) => api.delete(`/auth/users/${id}/membership`).then(extractData<TeamMember>),

  updateProfile: (firstName: string, lastName: string) =>
    api.patch('/auth/me', { firstName, lastName }).then(extractData<ProfileUser>),

  changeEmail: (email: string, currentPassword: string) =>
    api.patch('/auth/me/email', { email, currentPassword }).then(extractData<ProfileUser>),

  updatePreferences: (prefs: { alertEmailOptIn?: boolean }) =>
    api.patch('/auth/me/preferences', prefs).then(extractData<ProfileUser & { alertEmailOptIn: boolean }>),

  changePassword: (currentPassword: string, newPassword: string) =>
    api.patch('/auth/me/password', { currentPassword, newPassword }).then(extractData<{ message: string }>),

  updateRole: (id: string, role: UserRole) =>
    api.patch(`/auth/users/${id}/role`, { role }).then(extractData<TeamMember>),

  setActive: (id: string, isActive: boolean) =>
    api.patch(`/auth/users/${id}/active`, { isActive }).then(extractData<TeamMember>),

  createInvite: (email: string, role: UserRole) =>
    api.post('/team/invites', { email, role }).then(extractData<Invite>),

  listInvites: () => api.get('/team/invites').then(extractData<Invite[]>),

  revokeInvite: (id: string) =>
    api.delete(`/team/invites/${id}`).then(extractData<{ message: string }>),

  validateInvite: (token: string) =>
    api.get(`/team/invites/validate/${token}`).then(extractData<InviteInfo>),

  acceptInvite: (token: string, body: { firstName: string; lastName: string; password: string }) =>
    api.post(`/team/invites/accept/${token}`, body).then(
      extractData<{ user: { id: string; email: string; firstName: string; lastName: string; role: UserRole; plan: string; trialEndsAt: string | null }; tokens: { accessToken: string; refreshToken: string } }>
    ),
};
