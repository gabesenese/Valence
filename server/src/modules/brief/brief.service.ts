import { prisma } from '../../infrastructure/database';
import { logger } from '../../utils/logger';
import { sendDailyBriefEmail } from '../../lib/email';
import { getRevenueAtRisk } from '../finance/revenue-at-risk.service';

export interface BriefItem {
  kind: 'risk' | 'task' | 'alert';
  title: string;
  detail: string;
  severity?: string;
}

export interface DailyBrief {
  date: string;
  firstName: string;
  totalAtRisk: number;
  counts: { atRisk: number; dueTasks: number; newAlerts: number };
  atRisk: BriefItem[];
  dueTasks: BriefItem[];
  newAlerts: BriefItem[];
  isEmpty: boolean;
}

// Day boundaries computed in UTC. Per-user timezones are a future refinement
// (only Organization carries a timezone today); UTC keeps "due today" deterministic.
function endOfTodayUTC(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 23, 59, 59, 999));
}
function startOfTodayUTC(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

export async function buildDailyBrief(userId: string): Promise<DailyBrief> {
  const now = new Date();
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { firstName: true } });

  const atRiskData = await getRevenueAtRisk(userId);
  const atRisk: BriefItem[] = atRiskData.risks.slice(0, 5).map((r) => ({
    kind: 'risk',
    severity: r.renewalRisk,
    title: `${r.tenantName} — ${r.propertyName}`,
    detail: `$${r.monthlyRent.toLocaleString()}/mo · ${r.reasons[0] ?? `expires in ${r.daysToExpiry} days`}`,
  }));

  const dueTaskRows = await prisma.task.findMany({
    where: {
      deletedAt: null,
      status: { in: ['OPEN', 'IN_PROGRESS'] },
      dueAt: { lte: endOfTodayUTC(now) },
      OR: [{ assigneeUserId: userId }, { property: { ownerId: userId } }],
    },
    select: { id: true, title: true, lease: { select: { tenant: { select: { name: true } } } } },
    orderBy: { dueAt: 'asc' },
    take: 8,
  });
  const dueTasks: BriefItem[] = dueTaskRows.map((t) => ({
    kind: 'task',
    title: t.title,
    detail: t.lease?.tenant?.name ?? 'Due today',
  }));

  const alertRows = await prisma.alert.findMany({
    where: {
      severity: 'CRITICAL',
      status: 'OPEN',
      createdAt: { gte: new Date(now.getTime() - 24 * 3600_000) },
      OR: [{ property: { ownerId: userId } }, { lease: { property: { ownerId: userId } } }],
    },
    select: { id: true, title: true, description: true },
    orderBy: { createdAt: 'desc' },
    take: 5,
  });
  const newAlerts: BriefItem[] = alertRows.map((a) => ({ kind: 'alert', title: a.title, detail: a.description ?? '' }));

  const isEmpty = atRisk.length === 0 && dueTasks.length === 0 && newAlerts.length === 0;

  return {
    date: now.toISOString(),
    firstName: user?.firstName ?? 'there',
    totalAtRisk: atRiskData.totalAtRisk,
    counts: { atRisk: atRiskData.leaseCount, dueTasks: dueTaskRows.length, newAlerts: alertRows.length },
    atRisk,
    dueTasks,
    newAlerts,
    isEmpty,
  };
}

function section(title: string, items: BriefItem[]): string {
  if (!items.length) return '';
  const rows = items
    .map((i) => `<div style="padding:10px 0;border-top:1px solid #2a2a3a"><div style="font-size:14px;color:#fff;font-weight:600">${escapeHtml(i.title)}</div><div style="font-size:12px;color:#94a3b8;margin-top:2px">${escapeHtml(i.detail)}</div></div>`)
    .join('');
  return `<p style="margin:20px 0 4px;font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#64748b">${title}</p>${rows}`;
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c] as string));
}

export function renderBriefHtml(brief: DailyBrief): string {
  const intro = `<p style="margin:0 0 4px;font-size:14px;color:#94a3b8">Good morning, ${escapeHtml(brief.firstName)} — here's what needs you today.</p>`;
  const headline = brief.totalAtRisk > 0
    ? `<p style="margin:8px 0 0;font-size:13px;color:#cbd5e1">$${Math.round(brief.totalAtRisk).toLocaleString()}/mo at risk · ${brief.counts.dueTasks} task(s) due · ${brief.counts.newAlerts} new alert(s)</p>`
    : '';
  return intro + headline
    + section('Revenue at risk', brief.atRisk)
    + section('Due today', brief.dueTasks)
    + section('New alerts', brief.newAlerts);
}

async function acquireBriefLock(durationMs: number): Promise<boolean> {
  const now = new Date();
  const lockedUntil = new Date(now.getTime() + durationMs);
  const existing = await prisma.jobLock.findUnique({ where: { id: 'daily_brief' } });
  if (existing && existing.lockedUntil > now) return false;
  await prisma.jobLock.upsert({
    where: { id: 'daily_brief' },
    update: { lockedAt: now, lockedUntil },
    create: { id: 'daily_brief', lockedAt: now, lockedUntil },
  });
  return true;
}

export async function sendDailyBriefs(): Promise<{ sent: number; skipped: number }> {
  const locked = await acquireBriefLock(15 * 60 * 1000);
  if (!locked) return { sent: 0, skipped: 0 };

  const now = new Date();
  const users = await prisma.user.findMany({
    where: {
      isActive: true,
      dailyBriefOptOut: false,
      emailVerifiedAt: { not: null },
      OR: [{ lastBriefSentAt: null }, { lastBriefSentAt: { lt: startOfTodayUTC(now) } }],
    },
    select: { id: true, email: true },
  });

  let sent = 0;
  let skipped = 0;
  for (const u of users) {
    try {
      const brief = await buildDailyBrief(u.id);
      if (brief.isEmpty) { skipped++; continue; } // never send an empty brief
      await sendDailyBriefEmail(u.email, renderBriefHtml(brief));
      await prisma.user.update({ where: { id: u.id }, data: { lastBriefSentAt: new Date() } });
      sent++;
    } catch (err) {
      logger.warn('daily brief failed for user', { userId: u.id, error: err instanceof Error ? err.message : String(err) });
    }
  }
  return { sent, skipped };
}
