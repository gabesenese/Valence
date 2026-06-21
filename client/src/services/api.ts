import axios, { type AxiosInstance, type InternalAxiosRequestConfig } from 'axios';
import { useAuthStore } from '@/state/auth.store';

export const api: AxiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? '/api',
  headers: { 'Content-Type': 'application/json' },
  timeout: 15000,
});

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = useAuthStore.getState().accessToken;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    const url: string = original?.url ?? '';
    const isAuthEntry = /\/auth\/(login|register|refresh|mfa\/verify|demo-session|forgot-password|reset-password)/.test(url);
    if (error.response?.status === 401 && !original._retry && !isAuthEntry) {
      original._retry = true;
      if (useAuthStore.getState().isImpersonating) {
        useAuthStore.getState().stopImpersonation();
        window.location.href = '/admin';
        return Promise.reject(error);
      }
      try {
        const refreshToken = useAuthStore.getState().refreshToken;
        if (!refreshToken) throw new Error('No refresh token');

        const { data } = await axios.post('/api/auth/refresh', { refreshToken });
        const { accessToken, refreshToken: newRefresh } = data.data.tokens;
        useAuthStore.getState().setTokens(accessToken, newRefresh);

        original.headers.Authorization = `Bearer ${accessToken}`;
        return api(original);
      } catch {
        useAuthStore.getState().logout();
        window.location.href = '/auth/login';
        return Promise.reject(error);
      }
    }
    const message = error.response?.data?.message ?? error.message;
    return Promise.reject(new Error(message));
  }
);

export function extractData<T>(response: { data: { data: T } }): T {
  return response.data.data;
}

export function extractPaginated<T>(response: { data: { data: T[]; meta: PaginationMeta } }): PaginatedResult<T> {
  return { data: response.data.data, meta: response.data.meta };
}

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  pages: number;
  hasNext: boolean;
  hasPrev: boolean;
}

export interface PaginatedResult<T> {
  data: T[];
  meta: PaginationMeta;
}
