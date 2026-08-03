import { useEffect } from 'react';
import { useUIStore } from '@/state/ui.store';

export type Theme = 'dark' | 'light' | 'system';
export type ResolvedTheme = 'dark' | 'light';

export const THEME_STORAGE_KEY = 'valence-theme';

const prefersDark = () =>
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-color-scheme: dark)').matches;

export function resolveTheme(theme: Theme): ResolvedTheme {
  if (theme === 'system') return prefersDark() ? 'dark' : 'light';
  return theme;
}

let themeTransitionTimeout: number | undefined;

export function applyTheme(theme: Theme): void {
  const resolved = resolveTheme(theme);
  const root = document.documentElement;
  const isChanging = root.classList.contains('dark') !== (resolved === 'dark');
  const reducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (isChanging && !reducedMotion) {
    root.classList.add('theme-transitioning');
    window.clearTimeout(themeTransitionTimeout);
    themeTransitionTimeout = window.setTimeout(() => {
      root.classList.remove('theme-transitioning');
    }, 400);
  }

  root.classList.toggle('dark', resolved === 'dark');
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
  }
}

export function useApplyTheme(): void {
  const theme = useUIStore((s) => s.theme);

  useEffect(() => {
    applyTheme(theme);
    if (theme !== 'system') return;

    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => applyTheme('system');
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [theme]);
}
