import { prisma } from '../../infrastructure/database';

export type FunnelEventType =
  | 'visitor'
  | 'signup'
  | 'demo_started'
  | 'setup_complete'
  | 'data_imported'
  | 'first_insight'
  | 'team_invited'
  | 'upgrade_clicked'
  | 'upgraded'
  | 'return_visit';

const FUNNEL_STEPS: FunnelEventType[] = [
  'visitor',
  'signup',
  'setup_complete',
  'data_imported',
  'first_insight',
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

export async function trackIfFirstTime(
  event: FunnelEventType,
  userId: string,
  meta?: Record<string, unknown>,
): Promise<void> {
  try {
    const already = await prisma.funnelEvent.findFirst({
      where: { event, userId },
      select: { id: true },
    });
    if (!already) await prisma.funnelEvent.create({ data: { event, userId, meta: (meta ?? {}) as object } });
  } catch { /* non-blocking — duplicate on race condition is acceptable */ }
}

export async function trackReturnVisit(userId: string): Promise<void> {
  try {
    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);
    const already = await prisma.funnelEvent.findFirst({
      where: { event: 'return_visit', userId, createdAt: { gte: todayStart } },
      select: { id: true },
    });
    if (!already) await prisma.funnelEvent.create({ data: { event: 'return_visit', userId, meta: {} as object } });
  } catch { /* non-blocking */ }
}

/**
 * Records the activation moment — the first time a real (non-demo) account views
 * its Finance Overview with actual data behind it. This is the metric that matters
 * for trials: signup → first_insight = time-to-first-insight. Fired from the
 * intelligence endpoint; the early dedup check keeps it to one cheap query per view
 * after it has fired once.
 */
export async function trackFirstInsight(userId: string): Promise<void> {
  try {
    const already = await prisma.funnelEvent.findFirst({
      where: { event: 'first_insight', userId },
      select: { id: true },
    });
    if (already) return;

    const user = await prisma.user.findUnique({ where: { id: userId }, select: { isDemo: true } });
    if (user?.isDemo) return;

    const leaseCount = await prisma.lease.count({ where: { property: { ownerId: userId }, deletedAt: null } });
    if (leaseCount === 0) return;

    await prisma.funnelEvent.create({ data: { event: 'first_insight', userId, meta: {} as object } });
  } catch { /* non-blocking */ }
}

export async function getFunnelStats(days = 30) {
  const since = new Date(Date.now() - days * 86400000);

  const rawRows = await prisma.funnelEvent.groupBy({
    by: ['event'],
    _count: { _all: true },
    where: { createdAt: { gte: since } },
  });
  const rawCounts = Object.fromEntries(rawRows.map((r) => [r.event, r._count._all]));

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

/**
 * A single user's activation journey — the chronological FunnelEvent sequence
 * plus derived metrics — so a trial can be watched individually (signup → first
 * import → first insight → return visits → where they dropped off). Admin-only.
 */
export async function getUserJourney(userId: string) {
  const events = await prisma.funnelEvent.findMany({
    where: { userId },
    select: { event: true, meta: true, createdAt: true },
    orderBy: { createdAt: 'asc' },
  });

  const firstAt = (e: FunnelEventType) => events.find((ev) => ev.event === e)?.createdAt ?? null;
  const signupAt = firstAt('signup');
  const firstInsightAt = firstAt('first_insight');

  return {
    events,
    metrics: {
      signupAt,
      firstInsightAt,
      reachedFirstInsight: firstInsightAt != null,
      timeToFirstInsightMs: signupAt && firstInsightAt ? firstInsightAt.getTime() - signupAt.getTime() : null,
      returnVisits: events.filter((e) => e.event === 'return_visit').length,
      lastEventAt: events.length ? events[events.length - 1].createdAt : null,
    },
  };
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
