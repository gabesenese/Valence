import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, CalendarClock, ClipboardPlus, Check } from 'lucide-react';
import { financeService, type RevenueRisk } from '@/services/finance.service';
import { tasksService } from '@/services/tasks.service';
import { formatCurrency, compactCurrency, formatDate } from '@/utils/format';

type ActionKind = 'renewal' | 'followup';

const RISK_DOT: Record<string, string> = {
  CRITICAL: 'bg-danger',
  HIGH: 'bg-warning',
  MEDIUM: 'bg-info',
  LOW: 'bg-slate-500',
};

export function RevenueAtRisk() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [done, setDone] = useState<Record<string, ActionKind[]>>({});

  const { data } = useQuery({
    queryKey: ['finance', 'at-risk'],
    queryFn: () => financeService.getAtRisk(),
  });

  const action = useMutation({
    mutationFn: ({ risk, kind }: { risk: RevenueRisk; kind: ActionKind }) =>
      tasksService.create(
        kind === 'renewal'
          ? {
              title: `Renew lease — ${risk.tenantName} (${risk.propertyName})`,
              leaseId: risk.leaseId,
              propertyId: risk.propertyId,
              dueAt: risk.endDate,
            }
          : {
              title: `Follow up: ${risk.tenantName} renewal`,
              description: risk.reasons.join(' · '),
              leaseId: risk.leaseId,
              propertyId: risk.propertyId,
            },
      ),
    onSuccess: (_task, { risk, kind }) => {
      setDone((prev) => ({ ...prev, [risk.leaseId]: [...(prev[risk.leaseId] ?? []), kind] }));
      qc.invalidateQueries({ queryKey: ['tasks'] });
    },
  });

  if (!data || data.leaseCount === 0) return null;

  const isDone = (leaseId: string, kind: ActionKind) => (done[leaseId] ?? []).includes(kind);
  const isPending = (leaseId: string, kind: ActionKind) =>
    action.isPending && action.variables?.risk.leaseId === leaseId && action.variables?.kind === kind;

  const context = [
    data.expiringWithin30 > 0 && `${data.expiringWithin30} expiring within 30 days`,
    data.renewalsNotStarted > 0 && `${data.renewalsNotStarted} renewals not started`,
    data.highRiskCount > 0 && `${data.highRiskCount} high-risk`,
  ].filter(Boolean) as string[];

  return (
    <div className="rounded-xl border border-warning/30 bg-warning/[0.03] overflow-hidden">
      <div className="flex flex-col gap-1 border-b border-surface-400/40 px-5 py-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-widest text-warning">
            <AlertTriangle className="h-3.5 w-3.5" />
            Revenue at Risk
          </div>
          <p className="text-2xl font-bold tabular-nums text-fg">
            {compactCurrency(data.totalAtRisk)}<span className="text-base font-medium text-slate-500">/mo</span>
          </p>
        </div>
        {context.length > 0 && (
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
            {context.map((line) => (
              <span key={line}>{line}</span>
            ))}
          </div>
        )}
      </div>

      <div className="divide-y divide-surface-400/30">
        {data.risks.map((risk, i) => (
          <div key={risk.leaseId} className="flex flex-col gap-3 px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between">
            <button
              type="button"
              onClick={() => navigate(`/leases/${risk.leaseId}`)}
              className="flex min-w-0 items-start gap-3 rounded-lg px-1 py-0.5 -mx-1 text-left transition-colors hover:bg-warning/[0.06] focus:outline-none focus-visible:ring-1 focus-visible:ring-warning/50"
              title={`View ${risk.tenantName}'s lease`}
            >
              <span className="mt-0.5 w-4 shrink-0 text-right text-xs font-semibold tabular-nums text-slate-600">{i + 1}</span>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className={`inline-block h-1.5 w-1.5 shrink-0 rounded-full ${RISK_DOT[risk.renewalRisk] ?? 'bg-slate-500'}`} />
                  <span className="truncate text-sm font-semibold text-fg">{risk.tenantName}</span>
                  <span className="truncate text-xs text-slate-500">{risk.propertyName}</span>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-slate-500">
                  {risk.reasons.map((reason, ri) => (
                    <span key={reason} className="flex items-center gap-2">
                      {ri > 0 && <span className="text-slate-700">·</span>}
                      {reason}
                    </span>
                  ))}
                </div>
              </div>
            </button>

            <div className="flex items-center gap-3 pl-7 sm:pl-0">
              <div className="text-right">
                <p className="text-sm font-semibold tabular-nums text-fg">{formatCurrency(risk.monthlyRent)}<span className="text-xs text-slate-500">/mo</span></p>
                <p className="text-[11px] text-slate-500">{formatDate(risk.endDate)}</p>
              </div>
              <div className="flex shrink-0 gap-1.5">
                <button
                  onClick={() => action.mutate({ risk, kind: 'renewal' })}
                  disabled={isDone(risk.leaseId, 'renewal') || isPending(risk.leaseId, 'renewal')}
                  className="inline-flex items-center gap-1 rounded-lg border border-surface-400/50 bg-surface-100 px-2.5 py-1.5 text-[11px] font-medium text-slate-300 transition-colors hover:bg-surface-200 disabled:opacity-60"
                >
                  {isDone(risk.leaseId, 'renewal') ? <Check className="h-3 w-3 text-success" /> : <ClipboardPlus className="h-3 w-3" />}
                  {isDone(risk.leaseId, 'renewal') ? 'Task created' : 'Create Renewal Task'}
                </button>
                <button
                  onClick={() => action.mutate({ risk, kind: 'followup' })}
                  disabled={isDone(risk.leaseId, 'followup') || isPending(risk.leaseId, 'followup')}
                  className="inline-flex items-center gap-1 rounded-lg border border-surface-400/50 bg-surface-100 px-2.5 py-1.5 text-[11px] font-medium text-slate-300 transition-colors hover:bg-surface-200 disabled:opacity-60"
                >
                  {isDone(risk.leaseId, 'followup') ? <Check className="h-3 w-3 text-success" /> : <CalendarClock className="h-3 w-3" />}
                  {isDone(risk.leaseId, 'followup') ? 'Scheduled' : 'Schedule Follow-up'}
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
