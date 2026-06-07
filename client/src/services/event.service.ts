import { api } from './api';

type FunnelEvent = 'visitor' | 'setup_complete';

const SESSION_KEY = 'valence-tracked-events';

function hasTracked(event: string): boolean {
  try {
    const set = JSON.parse(sessionStorage.getItem(SESSION_KEY) ?? '[]') as string[];
    return set.includes(event);
  } catch { return false; }
}

function markTracked(event: string) {
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
