import { api } from './api';

type FunnelEvent = 'visitor' | 'setup_complete';

// visitor is deduplicated per session (anonymous, no userId)
// setup_complete is deduplicated per user on the server — no client dedup needed
const SESSION_DEDUP: FunnelEvent[] = ['visitor'];

const SESSION_KEY = 'valence-tracked-events';

function hasTracked(event: string): boolean {
  if (!SESSION_DEDUP.includes(event as FunnelEvent)) return false;
  try {
    const set = JSON.parse(sessionStorage.getItem(SESSION_KEY) ?? '[]') as string[];
    return set.includes(event);
  } catch { return false; }
}

function markTracked(event: string) {
  if (!SESSION_DEDUP.includes(event as FunnelEvent)) return;
  try {
    const set = JSON.parse(sessionStorage.getItem(SESSION_KEY) ?? '[]') as string[];
    if (!set.includes(event)) {
      set.push(event);
      sessionStorage.setItem(SESSION_KEY, JSON.stringify(set));
    }
  } catch {}
}

export const eventService = {
  track(event: FunnelEvent, meta?: Record<string, unknown>) {
    if (hasTracked(event)) return;
    markTracked(event);
    void api.post('/events', { event, meta }).catch(() => {});
  },
};
