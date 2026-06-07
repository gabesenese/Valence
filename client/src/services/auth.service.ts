import { api, extractData } from './api';

export interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  plan: import('@/state/auth.store').Plan;
  trialEndsAt: string | null;
  emailVerifiedAt: string | null;
  mfaEnabled: boolean;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthResult {
  user: AuthUser;
  tokens: AuthTokens;
}

export interface MfaChallenge {
  mfaRequired: true;
  mfaToken: string;
}

export interface Session {
  id: string;
  userAgent: string | null;
  ipAddress: string | null;
  createdAt: string;
  expiresAt: string;
}

export const authService = {
  login: (email: string, password: string, totp?: string): Promise<AuthResult | MfaChallenge> =>
    api.post('/auth/login', { email, password, ...(totp && { totp }) }).then(extractData<AuthResult | MfaChallenge>),

  verifyMfa: (mfaToken: string, totp: string): Promise<AuthResult> =>
    api.post('/auth/mfa/verify', { mfaToken, totp }).then(extractData<AuthResult>),

  register: (data: { email: string; password: string; firstName: string; lastName: string }): Promise<AuthResult> =>
    api.post('/auth/register', data).then(extractData<AuthResult>),

  logout: (refreshToken: string): Promise<void> =>
    api.post('/auth/logout', { refreshToken }).then(() => undefined),

  getMe: (): Promise<AuthUser> =>
    api.get('/auth/me').then(extractData<AuthUser>),

  getUsers: (): Promise<AuthUser[]> =>
    api.get('/auth/users').then(extractData<AuthUser[]>),

  claimTrial: (): Promise<AuthResult> =>
    api.post('/auth/claim-trial').then(extractData<AuthResult>),

  forgotPassword: (email: string): Promise<void> =>
    api.post('/auth/forgot-password', { email }).then(() => undefined),

  resetPassword: (token: string, newPassword: string): Promise<void> =>
    api.post('/auth/reset-password', { token, newPassword }).then(() => undefined),

  verifyEmail: (token: string): Promise<void> =>
    api.get(`/auth/verify-email?token=${encodeURIComponent(token)}`).then(() => undefined),

  resendVerification: (): Promise<void> =>
    api.post('/auth/me/resend-verification').then(() => undefined),

  setupMfa: (): Promise<{ secret: string; otpauth: string; qrCode: string }> =>
    api.post('/auth/mfa/setup').then(extractData<{ secret: string; otpauth: string; qrCode: string }>),

  enableMfa: (totp: string): Promise<AuthUser> =>
    api.post('/auth/mfa/enable', { totp }).then(extractData<AuthUser>),

  disableMfa: (totp: string): Promise<AuthUser> =>
    api.post('/auth/mfa/disable', { totp }).then(extractData<AuthUser>),

  listSessions: (): Promise<Session[]> =>
    api.get('/auth/sessions').then(extractData<Session[]>),

  revokeSession: (id: string): Promise<void> =>
    api.delete(`/auth/sessions/${id}`).then(() => undefined),

  revokeAllSessions: (): Promise<void> =>
    api.delete('/auth/sessions/all').then(() => undefined),
};
