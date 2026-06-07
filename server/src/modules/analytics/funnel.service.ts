import { prisma } from '../../infrastructure/database';

export type FunnelEventType =
  | 'visitor'
  | 'signup'
  | 'demo_started'
  | 'setup_complete'
  | 'data_imported'
  | 'team_invited'
  | 'upgrade_clicked'
  | 'upgraded';

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
      data: { event, userId: userId ?? null, meta: meta ?? {} },
    });
  } catch { /* non-blocking — never let tracking fail a real request */ }
}

export async function getFunnelStats(days = 30) {
  const since = new Date(Date.now() - days * 86400000);

  const rows = await prisma.funnelEvent.groupBy({
    by: ['event'],
    _count: { _all: true },
    where: { createdAt: { gte: since } },
  });

  const counts = Object.fromEntries(rows.map((r) => [r.event, r._count._all]));

  return FUNNEL_STEPS.map((step, i) => {
    const count = counts[step] ?? 0;
    const prev  = i === 0 ? null : counts[FUNNEL_STEPS[i - 1]] ?? 0;
    const convRate = prev == null ? null : prev > 0 ? Math.round((count / prev) * 100) : 0;
    return { step, count, convRate };
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
