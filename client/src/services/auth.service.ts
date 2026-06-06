import { api, extractData } from './api';

export interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  plan: import('@/state/auth.store').Plan;
  trialEndsAt: string | null;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthResult {
  user: AuthUser;
  tokens: AuthTokens;
}

export const authService = {
  login: (email: string, password: string): Promise<AuthResult> =>
    api.post('/auth/login', { email, password }).then(extractData<AuthResult>),

  register: (data: { email: string; password: string; firstName: string; lastName: string }): Promise<AuthResult> =>
    api.post('/auth/register', data).then(extractData<AuthResult>),

  logout: (refreshToken: string): Promise<void> =>
    api.post('/auth/logout', { refreshToken }).then(() => undefined),

  getMe: (): Promise<AuthUser> =>
    api.get('/auth/me').then(extractData<AuthUser>),

  getUsers: (): Promise<AuthUser[]> =>
    api.get('/auth/users').then(extractData<AuthUser[]>),
};
