import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  TrendingDown, TrendingUp, AlertTriangle, Users,
  RefreshCw, ArrowRight, CheckCircle2, Zap,
} from 'lucide-react';
import { aiService, type ScenarioType, type SimulationResult } from '@/services/ai.service';
import { formatCurrency, compactCurrency } from '@/utils/format';
import { Card, CardBody } from '@/components/ui/Card';
import { Select } from '@/components/ui/Select';


const SCENARIOS: {
  type: ScenarioType;
  label: string;
  question: string;
  icon: React.ComponentType<{ className?: string }>;
  accentColor: string;
  defaultParams: Record<string, unknown>;
}[] = [
  {
    type: 'tenant_departure',
    label: 'Tenant Leaves',
    question: 'What if a tenant stops paying?',
    icon: Users,
    accentColor: '#f59e0b',
    defaultParams: {},
  },
  {
    type: 'occupancy_drop',
    label: 'Occupancy Drops',
    question: 'What if occupancy falls by X%?',
    icon: TrendingDown,
    accentColor: '#ef4444',
    defaultParams: { percentageDrop: 5 },
  },
  {
    type: 'expense_increase',
    label: 'Expenses Increase',
    question: 'What if operating costs rise by X%?',
    icon: AlertTriangle,
    accentColor: '#f97316',
    defaultParams: { percentageIncrease: 10 },
  },
];


function TenantDepartureForm({ value, onChange }: { value: Record<string, unknown>; onChange: (v: Record<string, unknown>) => void }) {
  const { data: tenants, isLoading } = useQuery({
    queryKey: ['simulator', 'tenants'],
    queryFn:  aiService.getSimulatorTenants,
    staleTime: 60_000,
  });

  if (isLoading) return <div className="text-sm text-slate-500">Loading tenants...</div>;

  return (
    <div>
      <label className="text-xs font-medium text-slate-400 block mb-1.5">Select Tenant</label>
      <Select
        size="md"
        value={(value.tenantId as string) ?? ''}
        onChange={(v) => {
          const t = tenants?.find(x => x.tenantId === v);
          onChange({ ...value, tenantId: v, tenantName: t?.tenantName });
        }}
        placeholder="— Select a tenant —"
        options={tenants?.map(t => ({
          value: t.tenantId,
          label: `${t.tenantName} · ${t.propertyName} · ${compactCurrency(t.monthlyRent)}/mo`,
        })) ?? []}
      />
    </div>
  );
}

function OccupancyDropForm({ value, onChange }: { value: Record<string, unknown>; onChange: (v: Record<string, unknown>) => void }) {
  return (
    <div>
      <label className="text-xs font-medium text-slate-400 block mb-1.5">Occupancy Drop (%)</label>
      <input
        type="number" min={1} max={100}
        value={(value.percentageDrop as number) ?? 5}
        onChange={e => onChange({ ...value, percentageDrop: Number(e.target.value) })}
        className="w-full rounded-lg border border-surface-400/50 bg-surface-200 px-3 py-2 text-sm text-fg focus:border-brand-500 focus:outline-none"
      />
      <p className="mt-1 text-[11px] text-slate-600">e.g. 5 = occupancy drops from 90% to 85%</p>
    </div>
  );
}

function ExpenseIncreaseForm({ value, onChange }: { value: Record<string, unknown>; onChange: (v: Record<string, unknown>) => void }) {
  return (
    <div className="flex flex-col gap-3">
      <div>
        <label className="text-xs font-medium text-slate-400 block mb-1.5">Expense Increase (%)</label>
        <input
          type="number" min={1} max={200}
          value={(value.percentageIncrease as number) ?? 10}
          onChange={e => onChange({ ...value, percentageIncrease: Number(e.target.value) })}
          className="w-full rounded-lg border border-surface-400/50 bg-surface-200 px-3 py-2 text-sm text-fg focus:border-brand-500 focus:outline-none"
        />
      </div>
      <div>
        <label className="text-xs font-medium text-slate-400 block mb-1.5">Category (optional)</label>
        <input
          type="text"
          value={(value.category as string) ?? ''}
          placeholder="e.g. Maintenance, Utilities…"
          onChange={e => onChange({ ...value, category: e.target.value })}
          className="w-full rounded-lg border border-surface-400/50 bg-surface-200 px-3 py-2 text-sm text-fg placeholder-slate-600 focus:border-brand-500 focus:outline-none"
        />
      </div>
    </div>
  );
}

const PARAM_FORMS: Record<string, React.FC<{ value: Record<string, unknown>; onChange: (v: Record<string, unknown>) => void }>> = {
  tenant_departure: TenantDepartureForm,
  occupancy_drop:   OccupancyDropForm,
  expense_increase: ExpenseIncreaseForm,
};


function ImpactMetric({ label, current, projected, format }: {
  label: string; current: number; projected: number; format: (v: number) => string;
}) {
  const delta    = projected - current;
  const positive = delta >= 0;
  const Icon     = positive ? TrendingUp : TrendingDown;
  const color    = positive ? 'text-success' : 'text-danger';

  return (
    <div className="flex flex-col gap-1.5 rounded-xl bg-surface-200/40 px-4 py-3">
      <p className="text-[11px] text-slate-500 uppercase tracking-wider">{label}</p>
      <div className="flex flex-wrap items-end justify-between gap-x-2 gap-y-1">
        <div>
          <p className="text-xs text-slate-600">Current</p>
          <p className="text-sm font-semibold text-slate-300 tabular-nums">{format(current)}</p>
        </div>
        <ArrowRight className="h-3.5 w-3.5 text-slate-600 mb-0.5 shrink-0" />
        <div className="text-right">
          <p className="text-xs text-slate-600">Projected</p>
          <p className="text-sm font-bold text-fg tabular-nums">{format(projected)}</p>
        </div>
      </div>
      <div className={`flex items-center gap-1 ${color}`}>
        <Icon className="h-3 w-3" />
        <span className="text-xs font-semibold tabular-nums">
          {delta >= 0 ? '+' : ''}{format(delta)}
        </span>
      </div>
    </div>
  );
}


function ResultsPanel({ result }: { result: SimulationResult }) {
  const { current, projected, impact, analysis } = result;
  const annualPositive = impact.estimatedAnnualImpact >= 0;
  const confidenceColor = {
    high:   'text-success bg-success/10 border-success/20',
    medium: 'text-warning bg-warning/10 border-warning/20',
    low:    'text-slate-400 bg-surface-300/50 border-surface-400/30',
  }[analysis.confidence];

  return (
    <div className="flex flex-col gap-5">
      <div className={`rounded-xl border px-5 py-4 ${annualPositive ? 'border-success/20 bg-success/5' : 'border-danger/20 bg-danger/5'}`}>
        <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Estimated Annual Impact</p>
        <div className="flex items-baseline gap-2">
          <p className={`text-3xl font-bold tabular-nums ${annualPositive ? 'text-success' : 'text-danger'}`}>
            {impact.estimatedAnnualImpact >= 0 ? '+' : ''}{formatCurrency(impact.estimatedAnnualImpact)}
          </p>
          <p className="text-sm text-slate-500">/ year</p>
        </div>
        <div className="mt-2 flex items-center gap-3 flex-wrap">
          <span className="text-xs text-slate-500">
            Revenue: <span className={`font-medium ${impact.revenueChangePct >= 0 ? 'text-success' : 'text-danger'}`}>
              {impact.revenueChangePct >= 0 ? '+' : ''}{impact.revenueChangePct}%
            </span>
          </span>
          <span className="text-xs text-slate-600">·</span>
          <span className="text-xs text-slate-500">
            NOI: <span className={`font-medium ${impact.noiChange >= 0 ? 'text-success' : 'text-danger'}`}>
              {impact.noiChange >= 0 ? '+' : ''}{formatCurrency(impact.noiChange)}/mo
            </span>
          </span>
          {impact.occupancyChange !== 0 && (
            <>
              <span className="text-xs text-slate-600">·</span>
              <span className="text-xs text-slate-500">
                Occupancy: <span className={`font-medium ${impact.occupancyChange >= 0 ? 'text-success' : 'text-danger'}`}>
                  {impact.occupancyChange >= 0 ? '+' : ''}{impact.occupancyChange}pp
                </span>
              </span>
            </>
          )}
          <span className="text-xs text-slate-600">·</span>
          <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-bold ${confidenceColor}`}>
            {analysis.confidence.toUpperCase()} CONFIDENCE
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <ImpactMetric label="Monthly Revenue"  current={current.monthlyRevenue}  projected={projected.monthlyRevenue}  format={formatCurrency} />
        <ImpactMetric label="Monthly NOI"      current={current.noi}             projected={projected.noi}             format={formatCurrency} />
        <ImpactMetric label="Monthly Expenses" current={current.monthlyExpenses} projected={projected.monthlyExpenses} format={formatCurrency} />
        <ImpactMetric label="Occupancy Rate"   current={current.occupancyRate}   projected={projected.occupancyRate}   format={v => `${v.toFixed(1)}%`} />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[
          { title: 'Findings',        items: analysis.findings,        icon: Zap,          color: 'text-brand-400' },
          { title: 'Recommendations', items: analysis.recommendations, icon: CheckCircle2, color: 'text-success'   },
          { title: 'Risk Factors',    items: analysis.riskFactors,     icon: AlertTriangle, color: 'text-warning'  },
        ].map(({ title, items, icon: Icon, color }) => (
          <div key={title} className="rounded-xl border border-surface-400/40 bg-surface-100 p-4">
            <div className="flex items-center gap-2 mb-3">
              <Icon className={`h-3.5 w-3.5 ${color}`} />
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">{title}</span>
            </div>
            <ul className="space-y-2">
              {items.map((item, i) => (
                <li key={i} className="flex items-start gap-2 text-[12px] text-slate-400 leading-snug">
                  <span className={`mt-1.5 h-1 w-1 shrink-0 rounded-full ${color.replace('text-', 'bg-')}`} />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <p className="text-[11px] text-slate-600 text-center">
        Time to full impact: <span className="text-slate-400">{analysis.timeToImpact}</span>
      </p>
    </div>
  );
}


export default function ImpactAnalysisPage() {
  const [selected, setSelected] = useState<ScenarioType>('occupancy_drop');
  const [params, setParams]     = useState<Record<string, unknown>>({ percentageDrop: 5 });

  const handleSelect = (type: ScenarioType, defaultParams: Record<string, unknown>) => {
    setSelected(type);
    setParams(defaultParams);
    mutation.reset();
  };

  const mutation = useMutation({
    mutationFn: () => aiService.runSimulation({ scenario: selected, params }),
  });

  const scenario   = SCENARIOS.find(s => s.type === selected)!;
  const ParamForm  = PARAM_FORMS[selected];
  const canSubmit  = selected !== 'tenant_departure' || !!params.tenantId;

  return (
    <div className="flex flex-col gap-4 p-4 animate-fade-in sm:p-5">

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {SCENARIOS.map(s => {
          const active = s.type === selected;
          return (
            <button
              key={s.type}
              onClick={() => handleSelect(s.type, s.defaultParams)}
              className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition-colors ${
                active
                  ? 'border-brand-500/40 bg-brand-600/10 ring-1 ring-brand-500/20'
                  : 'border-surface-400/40 bg-surface-100 hover:bg-surface-200/40'
              }`}
            >
              <div
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                style={{ backgroundColor: `${s.accentColor}20` }}
              >
                <span style={{ color: s.accentColor }}><s.icon className="h-4 w-4" /></span>
              </div>
              <div>
                <p className={`text-sm font-semibold ${active ? 'text-brand-300' : 'text-slate-200'}`}>{s.label}</p>
                <p className="text-[11px] text-slate-500 mt-0.5">{s.question}</p>
              </div>
            </button>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[280px_1fr]">
        <div className="rounded-xl border border-surface-400/30 overflow-hidden">
          <div className="px-4 py-3 border-b border-surface-400/40 bg-surface-200/30">
            <span className="text-xs font-semibold text-fg">Parameters</span>
          </div>
          <div className="p-4 flex flex-col gap-4">
            <ParamForm value={params} onChange={setParams} />
            <button
              onClick={() => mutation.mutate()}
              disabled={mutation.isPending || !canSubmit}
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-brand-600 hover:bg-brand-500 disabled:opacity-40 disabled:cursor-not-allowed px-4 py-2.5 text-sm font-semibold text-white transition-colors"
            >
              {mutation.isPending ? (
                <><RefreshCw className="h-4 w-4 animate-spin" />Analyzing…</>
              ) : (
                <><ArrowRight className="h-4 w-4" />Run Analysis</>
              )}
            </button>
          </div>
        </div>

        <div>
          {mutation.isPending && (
            <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-surface-400/40 bg-surface-100 h-64">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-600/20 ring-1 ring-brand-500/30">
                <RefreshCw className="h-5 w-5 text-brand-400 animate-spin" />
              </div>
              <p className="text-sm font-medium text-slate-300">Running impact analysis…</p>
              <p className="text-xs text-slate-600">This may take a few seconds</p>
            </div>
          )}

          {mutation.isError && (
            <div className="rounded-2xl border border-danger/20 bg-danger/5 px-5 py-4 flex items-start gap-3">
              <AlertTriangle className="h-4 w-4 text-danger shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-danger">Analysis failed</p>
                <p className="text-xs text-slate-500 mt-0.5">{(mutation.error as Error)?.message ?? 'Please try again.'}</p>
              </div>
            </div>
          )}

          {mutation.data && !mutation.isPending && (
            <Card>
              <CardBody>
                <div className="flex items-center gap-2 mb-5">
                  <span style={{ color: scenario.accentColor }}><scenario.icon className="h-4 w-4" /></span>
                  <span className="text-sm font-semibold text-fg">{scenario.label} — Results</span>
                  <span className="ml-auto text-xs text-slate-600">
                    {new Date(mutation.data.computedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <ResultsPanel result={mutation.data} />
              </CardBody>
            </Card>
          )}

          {!mutation.data && !mutation.isPending && !mutation.isError && (
            <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-surface-400/50 h-64 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-surface-200/50">
                <ArrowRight className="h-6 w-6 text-slate-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-400">Select a scenario and run the analysis</p>
                <p className="text-xs text-slate-600 mt-1">Results will show financial impact and recommended actions</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
