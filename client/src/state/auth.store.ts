import { create } from 'zustand';
import { persist, createJSONStorage, type StateStorage } from 'zustand/middleware';

export type Plan = 'FREE' | 'ESSENTIALS' | 'PROFESSIONAL' | 'EXECUTIVE';

interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  plan: Plan;
  isPlatformStaff?: boolean;
  addons?: string[];
  trialEndsAt: string | null;
  emailVerifiedAt: string | null;
  mfaEnabled: boolean;
  isDemo: boolean;
  alertEmailOptIn?: boolean;
}

interface OriginalSession {
  user: AuthUser;
  accessToken: string;
  refreshToken: string;
}

interface AuthState {
  user: AuthUser | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isImpersonating: boolean;
  originalSession: OriginalSession | null;
  setAuth: (user: AuthUser, accessToken: string, refreshToken: string) => void;
  setTokens: (accessToken: string, refreshToken: string) => void;
  updateUser: (patch: Partial<AuthUser>) => void;
  logout: () => void;
  startImpersonation: (user: AuthUser, token: string) => void;
  stopImpersonation: () => void;
}

/**
 * A demo session must not outlive the tab: it lives in sessionStorage instead
 * of localStorage, so closing the tab signs it out automatically rather than
 * leaving a live demo portfolio reachable from a fresh visit.
 */
const demoAwareStorage: StateStorage = {
  getItem: (name) => sessionStorage.getItem(name) ?? localStorage.getItem(name),
  setItem: (name, value) => {
    const isDemo = (() => {
      try {
        return !!JSON.parse(value)?.state?.user?.isDemo;
      } catch {
        return false;
      }
    })();
    if (isDemo) {
      localStorage.removeItem(name);
      sessionStorage.setItem(name, value);
    } else {
      sessionStorage.removeItem(name);
      localStorage.setItem(name, value);
    }
  },
  removeItem: (name) => {
    localStorage.removeItem(name);
    sessionStorage.removeItem(name);
  },
};

(function migrateExistingDemoSessionOutOfLocalStorage() {
  const existing = localStorage.getItem('valence-auth');
  if (!existing) return;
  try {
    if (JSON.parse(existing)?.state?.user?.isDemo) {
      localStorage.removeItem('valence-auth');
      sessionStorage.setItem('valence-auth', existing);
    }
  } catch {
    localStorage.removeItem('valence-auth');
  }
})();

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      isImpersonating: false,
      originalSession: null,

      setAuth: (user, accessToken, refreshToken) =>
        set({ user, accessToken, refreshToken, isAuthenticated: true }),

      setTokens: (accessToken, refreshToken) =>
        set({ accessToken, refreshToken }),

      updateUser: (patch) =>
        set((s) => ({ user: s.user ? { ...s.user, ...patch } : s.user })),

      logout: () =>
        set({ user: null, accessToken: null, refreshToken: null, isAuthenticated: false, isImpersonating: false, originalSession: null }),

      startImpersonation: (user, token) => {
        const s = get();
        set({
          originalSession: { user: s.user!, accessToken: s.accessToken!, refreshToken: s.refreshToken! },
          user, accessToken: token, refreshToken: null,
          isAuthenticated: true, isImpersonating: true,
        });
      },

      stopImpersonation: () => {
        const { originalSession } = get();
        if (!originalSession) return;
        set({
          user: originalSession.user,
          accessToken: originalSession.accessToken,
          refreshToken: originalSession.refreshToken,
          isAuthenticated: true,
          isImpersonating: false,
          originalSession: null,
        });
      },
    }),
    {
      name: 'valence-auth',
      storage: createJSONStorage(() => demoAwareStorage),
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        isAuthenticated: state.isAuthenticated,
        isImpersonating: state.isImpersonating,
        originalSession: state.originalSession,
      }),
    },
  ),
);
