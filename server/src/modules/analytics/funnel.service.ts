import { prisma } from '../../infrastructure/database';

export type FunnelEventType =
  | 'visitor'
  | 'signup'
  | 'demo_started'
  | 'setup_complete'
  | 'data_imported'
  | 'team_invited'
  | 'upgrade_clicked'
  | 'upgraded'
  | 'return_visit';

const FUNNEL_STEPS: FunnelEventType[] = [
  'visitor',
  'signup',
  'setup_complete',
  'data_imported',
  'team_invited',
  'upgrade_clicked',
  'upgraded',
];

export async function trackEvent(
  event: FunnelEventType,
  userId?: string | null,
  meta?: Record<string, unknown>,
): Promise<void> {
  try {
    await prisma.funnelEvent.create({
      data: { event, userId: userId ?? null, meta: (meta ?? {}) as object },
    });
  } catch { /* non-blocking */ }
}

// Only tracks the event once per user across their lifetime (DB-level dedup)
export async function trackIfFirstTime(
  event: FunnelEventType,
  userId: string,
  meta?: Record<string, unknown>,
): Promise<void> {
  try {
    const already = await prisma.funnelEvent.findFirst({ where: { event, userId } });
    if (!already) await prisma.funnelEvent.create({ data: { event, userId, meta: (meta ?? {}) as object } });
  } catch { /* non-blocking */ }
}

export async function getFunnelStats(days = 30) {
  const since = new Date(Date.now() - days * 86400000);

  // Raw event counts (for visitor which is anonymous)
  const rawRows = await prisma.funnelEvent.groupBy({
    by: ['event'],
    _count: { _all: true },
    where: { createdAt: { gte: since } },
  });
  const rawCounts = Object.fromEntries(rawRows.map((r) => [r.event, r._count._all]));

  // Unique user counts per step (excludes anonymous events)
  const uniqueRows = await prisma.$queryRaw<{ event: string; unique_users: bigint }[]>`
    SELECT event, COUNT(DISTINCT user_id) AS unique_users
    FROM funnel_events
    WHERE created_at >= ${since} AND user_id IS NOT NULL
    GROUP BY event
  `;
  const uniqueCounts = Object.fromEntries(uniqueRows.map((r) => [r.event, Number(r.unique_users)]));

  return FUNNEL_STEPS.map((step, i) => {
    const count      = rawCounts[step] ?? 0;
    const uniqueUsers = uniqueCounts[step] ?? 0;
    const prev        = i === 0 ? null : (uniqueCounts[FUNNEL_STEPS[i - 1]] ?? rawCounts[FUNNEL_STEPS[i - 1]] ?? 0);
    const convRate    = prev == null ? null : prev > 0 ? Math.round((uniqueUsers / prev) * 100) : 0;
    return { step, count, uniqueUsers, convRate };
  });
}

export async function getDemoFunnelStats(days = 30) {
  const since = new Date(Date.now() - days * 86400000);
  const rows = await prisma.funnelEvent.groupBy({
    by: ['event'],
    _count: { _all: true },
    where: { event: 'demo_started', createdAt: { gte: since } },
  });
  return rows[0]?._count._all ?? 0;
}
