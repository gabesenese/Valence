export type OccupancyTier = 'healthy' | 'watch' | 'critical' | 'unknown';

export function occupancyTier(pct: number | null): OccupancyTier {
  if (pct === null) return 'unknown';
  if (pct >= 80) return 'healthy';
  if (pct >= 60) return 'watch';
  return 'critical';
}

const TIER_TEXT: Record<OccupancyTier, string> = {
  healthy: 'text-success',
  watch: 'text-warning',
  critical: 'text-danger',
  unknown: 'text-slate-500',
};

const TIER_BAR: Record<OccupancyTier, string> = {
  healthy: 'bg-success',
  watch: 'bg-warning',
  critical: 'bg-danger',
  unknown: 'bg-slate-500',
};

export function occupancyColor(pct: number | null): string {
  return TIER_TEXT[occupancyTier(pct)];
}

export function occupancyBarColor(pct: number | null): string {
  return TIER_BAR[occupancyTier(pct)];
}

/**
 * Continuous occupancy color: red at the bottom, through amber mid-range,
 * to green near 100 — the higher the occupancy, the greener. Returns an
 * hsl() string for use as an inline `color` / `backgroundColor`.
 *
 * Anchored so a low-occupancy building still reads clearly red (a problem),
 * ~70% reads amber, and it keeps getting greener all the way to 100.
 */
export function occupancyColorValue(pct: number | null): string {
  if (pct === null) return 'rgb(148 163 184)';
  const p = Math.max(0, Math.min(100, pct));
  let hue: number;
  if (p <= 50) hue = 0;                          // red
  else if (p <= 75) hue = ((p - 50) / 25) * 50;  // red → amber (0 → 50)
  else hue = 50 + ((p - 75) / 25) * 80;          // amber → green (50 → 130)
  return `hsl(${Math.round(hue)}, 72%, 45%)`;
}
