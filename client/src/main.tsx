import { initSentry, Sentry } from '@/lib/sentry';
initSentry();

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { useAuthStore } from '@/state/auth.store';
import './index.css';

// If the user chose not to be remembered, clear auth when a new browser session starts.
// sessionStorage is cleared on tab/browser close, so absence of the marker = new session.
if (localStorage.getItem('valence-remember-me') === '0' && !sessionStorage.getItem('valence-session-active')) {
  useAuthStore.getState().logout();
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 2,
      retry: (failureCount, error: unknown) => {
        const status = (error as { response?: { status?: number } })?.response?.status;
        if (status === 401 || status === 403 || status === 404) return false;
        return failureCount < 2;
      },
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 0,
    },
  },
});

const root = document.getElementById('root');
if (!root) throw new Error('Root element not found');

createRoot(root).render(
  <StrictMode>
    <Sentry.ErrorBoundary fallback={<div className="flex h-screen items-center justify-center text-sm text-gray-500">Something went wrong. Please refresh the page.</div>}>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <App />
        </BrowserRouter>
        {import.meta.env.DEV && <ReactQueryDevtools initialIsOpen={false} />}
      </QueryClientProvider>
    </Sentry.ErrorBoundary>
  </StrictMode>
);
