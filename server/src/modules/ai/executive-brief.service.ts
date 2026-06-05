import Anthropic from '@anthropic-ai/sdk';
import { prisma } from '../../infrastructure/database';
import { differenceInDays, addDays } from 'date-fns';

// ─── Output types ─────────────────────────────────────────────────────────────

export interface RiskItem {
  title:       string;
  description: string;
  severity:    'critical' | 'high' | 'medium';
  monthlyRevenue?: number;
  leaseNumber?:    string;
  tenantName?:     string;
  daysRemaining?:  number;
}

export interface ActionItem {
  action:      string;
  context:     string;
  urgency:     'immediate' | 'this_week' | 'this_month';
  category:    'contact_tenant' | 'start_renewal' | 'send_document' | 'financial_review' | 'investigate';
  entityName?: string;
  leaseNumber?: string;
}

export interface ExecutiveBrief {
  generatedAt:     string;
  portfolioHealth: 'critical' | 'at_risk' | 'stable' | 'healthy';
  headline:        string;
  summary:         string;
  revenueRisk:     RiskItem[];
  actions:         ActionItem[];
}

// ─── Data gathering ───────────────────────────────────────────────────────────

async function gatherContext() {
  const now = new Date();

  const [leases, properties, criticalAlerts, flaggedFinancials] = await Promise.all([
    prisma.lease.findMany({
      where: { status: 'ACTIVE' },
      include: {
        property: { select: { name: true, code: true } },
        tenant:   { select: { name: true, email: true } },
        owner:    { select: { firstName: true, lastName: true } },
        alerts: {
          where: { status: { in: ['OPEN', 'ACKNOWLEDGED', 'IN_PROGRESS'] } },
          select: { severity: true, type: true },
        },
      },
      orderBy: { endDate: 'asc' },
    }),
    prisma.property.findMany({
      where: { status: 'ACTIVE' },
      select: { totalUnits: true, _count: { select: { leases: { where: { status: 'ACTIVE' } } } } },
    }),
    prisma.alert.findMany({
      where: { severity: 'CRITICAL', status: { in: ['OPEN', 'ACKNOWLEDGED', 'IN_PROGRESS'] } },
      include: {
        lease:    { select: { leaseNumber: true, tenant: { select: { name: true } } } },
        property: { select: { name: true } },
      },
      take: 15,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.financialRecord.findMany({
      where: { status: { in: ['FLAGGED', 'DISPUTED'] } },
      include: { lease: { select: { leaseNumber: true, tenant: { select: { name: true } } } } },
      take: 10,
    }),
  ]);

  const totalRevenue = leases.reduce((s, l) => s + Number(l.baseRent), 0);
  const totalUnits   = properties.reduce((s, p) => s + p.totalUnits, 0);
  const occupiedUnits = properties.reduce((s, p) => s + p._count.leases, 0);
  const occupancyRate = totalUnits > 0 ? Math.round((occupiedUnits / totalUnits) * 100) : 0;

  const expiring90  = leases.filter(l => differenceInDays(l.endDate, now) <= 90);
  const revenueAt90 = expiring90.reduce((s, l) => s + Number(l.baseRent), 0);
  const revenueAt30 = leases.filter(l => differenceInDays(l.endDate, now) <= 30)
    .reduce((s, l) => s + Number(l.baseRent), 0);

  return {
    portfolioSummary: {
      totalActiveLeases:     leases.length,
      totalMonthlyRevenue:   totalRevenue,
      occupancyRate,
      criticalAlertsOpen:    criticalAlerts.length,
      flaggedFinancialCount: flaggedFinancials.length,
    },
    expiringLeases: expiring90.map(l => ({
      leaseNumber:    l.leaseNumber,
      tenantName:     l.tenant.name,
      tenantEmail:    l.tenant.email,
      propertyName:   l.property.name,
      monthlyRent:    Number(l.baseRent),
      renewalRisk:    l.renewalRisk,
      renewalStage:   l.renewalStage,
      daysRemaining:  differenceInDays(l.endDate, now),
      hasRenewalDate: !!l.renewalDate,
      owner:          l.owner ? `${l.owner.firstName} ${l.owner.lastName}` : null,
      openAlerts:     l.alerts.filter(a => a.severity === 'CRITICAL').length,
    })),
    criticalAlerts: criticalAlerts.map(a => ({
      title:        a.title,
      type:         a.type,
      leaseRef:     a.lease ? `${a.lease.leaseNumber} (${a.lease.tenant.name})` : null,
      propertyName: a.property?.name ?? null,
    })),
    flaggedFinancials: flaggedFinancials.map(r => ({
      leaseNumber: r.lease.leaseNumber,
      tenantName:  r.lease.tenant.name,
      amount:      Number(r.amount),
      status:      r.status,
    })),
    financialMetrics: {
      revenueAtRiskIn30Days: revenueAt30,
      revenueAtRiskIn90Days: revenueAt90,
      percentageAtRisk:      totalRevenue > 0 ? Math.round((revenueAt90 / totalRevenue) * 100) : 0,
    },
  };
}

// ─── Claude call ──────────────────────────────────────────────────────────────

const client = new Anthropic();

export async function generateExecutiveBrief(): Promise<ExecutiveBrief> {
  const ctx = await gatherContext();

  const contextBlock = JSON.stringify(ctx, null, 2);

  const message = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 3000,
    tools: [
      {
        name: 'generate_executive_brief',
        description: 'Generate a structured executive intelligence brief for a commercial real estate portfolio.',
        input_schema: {
          type: 'object' as const,
          required: ['portfolioHealth', 'headline', 'summary', 'revenueRisk', 'actions'],
          properties: {
            portfolioHealth: {
              type: 'string',
              enum: ['critical', 'at_risk', 'stable', 'healthy'],
              description: 'Overall portfolio health based on risks identified',
            },
            headline: {
              type: 'string',
              description: 'One powerful sentence describing the most urgent portfolio situation. Must include a specific dollar amount or percentage and a specific action needed.',
            },
            summary: {
              type: 'string',
              description: 'Two to three sentences of executive context. Mention specific tenants, revenue figures, and the single most important thing the executive needs to know today.',
            },
            revenueRisk: {
              type: 'array',
              description: 'Top 3-5 revenue risk items, ordered by severity and dollar impact.',
              items: {
                type: 'object',
                required: ['title', 'description', 'severity'],
                properties: {
                  title:         { type: 'string',  description: 'Short risk label (e.g. "Vertex Consulting — 20 days")' },
                  description:   { type: 'string',  description: 'One sentence with specific amounts and stakes' },
                  severity:      { type: 'string', enum: ['critical', 'high', 'medium'] },
                  monthlyRevenue:{ type: 'number',  description: 'Monthly revenue at risk in USD' },
                  leaseNumber:   { type: 'string' },
                  tenantName:    { type: 'string' },
                  daysRemaining: { type: 'number' },
                },
              },
            },
            actions: {
              type: 'array',
              description: 'Three to six recommended actions ordered by urgency. Every action must name a specific tenant or record.',
              items: {
                type: 'object',
                required: ['action', 'context', 'urgency', 'category'],
                properties: {
                  action:      { type: 'string', description: 'Imperative verb phrase — what to do (e.g. "Contact Vertex Consulting CEO")' },
                  context:     { type: 'string', description: 'Why this matters right now, with specific numbers' },
                  urgency:     { type: 'string', enum: ['immediate', 'this_week', 'this_month'] },
                  category:    { type: 'string', enum: ['contact_tenant', 'start_renewal', 'send_document', 'financial_review', 'investigate'] },
                  entityName:  { type: 'string' },
                  leaseNumber: { type: 'string' },
                },
              },
            },
          },
        },
      },
    ],
    tool_choice: { type: 'tool', name: 'generate_executive_brief' },
    messages: [
      {
        role: 'user',
        content: `You are an executive intelligence assistant for Valence, a commercial real estate portfolio management platform.

Analyze this real-time portfolio snapshot and generate an executive brief. Be specific — use real tenant names, lease numbers, and dollar figures from the data. Every recommendation must be actionable and tied to real data.

<portfolio_snapshot>
${contextBlock}
</portfolio_snapshot>

Rules:
- Headline must include a specific dollar amount and the single most urgent action
- Never say "consider" — say exactly what to do
- Revenue risk items must mention the specific monthly revenue at stake
- Actions must be concrete: who to contact, what to do, why it matters now
- If a lease has daysRemaining <= 30 and no renewalDate, this is your top priority
- For flagged financials, name the tenant and amount`,
      },
    ],
  });

  const toolUse = message.content.find((b) => b.type === 'tool_use');
  if (!toolUse || toolUse.type !== 'tool_use') {
    throw new Error('Executive brief generation failed');
  }

  const result = toolUse.input as Omit<ExecutiveBrief, 'generatedAt'>;
  return { ...result, generatedAt: new Date().toISOString() };
}
