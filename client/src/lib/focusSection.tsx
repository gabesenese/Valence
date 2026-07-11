import { useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';

const HIGHLIGHT_MS = 2500;
export const FOCUS_PARAM = 'focus';

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function useFocusTarget<T extends HTMLElement = HTMLElement>(name: string) {
  const ref = useRef<T>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const firedRef = useRef(false);
  const isActive = searchParams.get(FOCUS_PARAM) === name;

  useEffect(() => {
    if (!isActive || firedRef.current) return;
    const el = ref.current;
    if (!el) return;
    firedRef.current = true;

    el.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'center' });
    el.setAttribute('data-focus-active', '');
    window.setTimeout(() => el.removeAttribute('data-focus-active'), HIGHLIGHT_MS);

    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete(FOCUS_PARAM);
      return next;
    }, { replace: true });
  }, [isActive, setSearchParams]);

  return ref;
}

export function withFocus(to: string, focus?: string): string {
  if (!focus) return to;
  const sep = to.includes('?') ? '&' : '?';
  return `${to}${sep}${FOCUS_PARAM}=${encodeURIComponent(focus)}`;
}
