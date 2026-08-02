import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { useAuthStore, type Plan } from './auth.store';

const demoUser = {
  id: 'demo-1', email: 'demo-abc@valence.demo', firstName: 'Demo', lastName: 'User',
  role: 'OWNER', plan: 'FREE' as Plan, trialEndsAt: null, emailVerifiedAt: null,
  mfaEnabled: false, isDemo: true,
};

const realUser = {
  ...demoUser, id: 'real-1', email: 'real@example.com', isDemo: false,
};

function readRaw(key: string) {
  const raw = sessionStorage.getItem(key) ?? localStorage.getItem(key);
  return raw ? JSON.parse(raw) : null;
}

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

afterEach(() => {
  useAuthStore.getState().logout();
  localStorage.clear();
  sessionStorage.clear();
});

describe('auth store — demo session storage', () => {
  it('persists a demo session to sessionStorage, not localStorage', () => {
    useAuthStore.getState().setAuth(demoUser, 'access', 'refresh');

    expect(localStorage.getItem('valence-auth')).toBeNull();
    expect(readRaw('valence-auth')?.state.user.isDemo).toBe(true);
  });

  it('persists a real account to localStorage, not sessionStorage', () => {
    useAuthStore.getState().setAuth(realUser, 'access', 'refresh');

    expect(sessionStorage.getItem('valence-auth')).toBeNull();
    expect(JSON.parse(localStorage.getItem('valence-auth')!).state.user.isDemo).toBe(false);
  });

  it('switching from a demo session to a real login moves storage across', () => {
    useAuthStore.getState().setAuth(demoUser, 'access', 'refresh');
    expect(sessionStorage.getItem('valence-auth')).not.toBeNull();

    useAuthStore.getState().setAuth(realUser, 'access2', 'refresh2');

    expect(sessionStorage.getItem('valence-auth')).toBeNull();
    expect(JSON.parse(localStorage.getItem('valence-auth')!).state.user.isDemo).toBe(false);
  });

  it('logout removes the demo session from sessionStorage, leaving no user behind', () => {
    useAuthStore.getState().setAuth(demoUser, 'access', 'refresh');
    useAuthStore.getState().logout();

    expect(sessionStorage.getItem('valence-auth')).toBeNull();
    expect(JSON.parse(localStorage.getItem('valence-auth')!).state.user).toBeNull();
  });
});

describe('auth store — migrates a pre-existing demo session out of localStorage', () => {
  it('moves a demo session already in localStorage into sessionStorage on load', async () => {
    vi.resetModules();
    localStorage.setItem('valence-auth', JSON.stringify({
      state: { user: demoUser, accessToken: 'a', refreshToken: 'r', isAuthenticated: true, isImpersonating: false, originalSession: null },
      version: 0,
    }));

    const { useAuthStore: reloadedStore } = await import('./auth.store');

    expect(localStorage.getItem('valence-auth')).toBeNull();
    expect(sessionStorage.getItem('valence-auth')).not.toBeNull();
    expect(reloadedStore.getState().user?.isDemo).toBe(true);
  });
});
