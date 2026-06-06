import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  Wand2, TrendingDown, TrendingUp, AlertTriangle, CheckCircle2,
  Building2, DollarSign, Users, Zap, ArrowRight, RefreshCw,
} from 'lucide-react';
import { aiService, type ScenarioType, type SimulationResult } from '@/services/ai.service';
import { formatCurrency, compactCurrency } from '@/utils/format';
import { Card, CardHeader, CardTitle, CardBody } from '@/components/ui/Card';

// ─── Scenario config ──────────────────────────────────────────────────────────

const SCENARIOS: {
  type: ScenarioType;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  accentColor: string;
}[] = [
  { type: 'occupancy_drop',    label: 'Occupancy Drop',       description: 'What if occupancy falls by X%?',              icon: TrendingDown, accentColor: '#ef4444' },
  { type: 'tenant_departure',  label: 'Tenant Departure',     description: 'What if a specific tenant leaves?',           icon: Users,        accentColor: '#f59e0b' },
  { type: 'expense_increase',  label: 'Expense Increase',     description: 'What if operating costs rise by X%?',         icon: AlertTriangle, accentColor: '#f97316' },
  { type: 'acquisition',       label: 'Property Acquisition', description: 'What if we add a new property?',             icon: Building2,    accentColor: '#6366f1' },
  { type: 'rent_increase',     label: 'Rent Increase',        description: 'What if rents increase by X% across leases?', icon: DollarSign,   accentColor: '#10b981' },
];

// ─── Parameter forms ──────────────────────────────────────────────────────────

function OccupancyDropForm({ value, onChange }: { value: Record<string, unknown>; onChange: (v: Record<string, unknown>) => void }) {
  return (
    <div className="space-y-4">
      <div>
        <label className="text-xs font-medium text-slate-400 block mb-1.5">Occupancy Drop (%)</label>
        <input
          type="number" min={1} max={100}
          value={(value.percentageDrop as number) ?? 5}
          onChange={e => onChange({ ...value, percentageDrop: Number(e.target.value) })}
          className="w-full rounded-lg border border-surface-400/50 bg-surface-200 px-3 py-2 text-sm text-white placeholder-slate-600 focus:border-brand-500 focus:outline-none"
        />
        <p className="mt-1 text-[11px] text-slate-600">e.g. 5 = occupancy drops from 90% to 85%</p>
      </div>
    </div>
  );
}

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
      <select
        value={(value.tenantId as string) ?? ''}
        onChange={e => {
          const t = tenants?.find(x => x.tenantId === e.target.value);
          onChange({ ...value, tenantId: e.target.value, tenantName: t?.tenantName });
        }}
        className="w-full rounded-lg border border-surface-400/50 bg-surface-200 px-3 py-2 text-sm text-white focus:border-brand-500 focus:outline-none"
      >
        <option value="">— Select a tenant —</option>
        {tenants?.map(t => (
          <option key={t.tenantId} value={t.tenantId}>
            {t.tenantName} · {t.propertyName} · {compactCurrency(t.monthlyRent)}/mo
          </option>
        ))}
      </select>
    </div>
  );
}

function ExpenseIncreaseForm({ value, onChange }: { value: Record<string, unknown>; onChange: (v: Record<string, unknown>) => void }) {
  return (
    <div className="space-y-4">
      <div>
        <label className="text-xs font-medium text-slate-400 block mb-1.5">Expense Increase (%)</label>
        <input
          type="number" min={1} max={200}
          value={(value.percentageIncrease as number) ?? 10}
          onChange={e => onChange({ ...value, percentageIncrease: Number(e.target.value) })}
          className="w-full rounded-lg border border-surface-400/50 bg-surface-200 px-3 py-2 text-sm text-white focus:border-brand-500 focus:outline-none"
        />
      </div>
      <div>
        <label className="text-xs font-medium text-slate-400 block mb-1.5">Category (optional)</label>
        <input
          type="text"
          value={(value.category as string) ?? ''}
          placeholder="e.g. Maintenance, Utilities..."
          onChange={e => onChange({ ...value, category: e.target.value })}
          className="w-full rounded-lg border border-surface-400/50 bg-surface-200 px-3 py-2 text-sm text-white placeholder-slate-600 focus:border-brand-500 focus:outline-none"
        />
      </div>
    </div>
  );
}

function AcquisitionForm({ value, onChange }: { value: Record<string, unknown>; onChange: (v: Record<string, unknown>) => void }) {
  const set = (k: string, v: unknown) => onChange({ ...value, [k]: v });
  return (
    <div className="space-y-4">
      {[
        { key: 'propertyName',    label: 'Property Name',            type: 'text',   placeholder: 'e.g. Westview Plaza' },
        { key: 'units',           label: 'Number of Units',           type: 'number', placeholder: '12' },
        { key: 'monthlyRevenue',  label: 'Projected Monthly Revenue ($)', type: 'number', placeholder: '50000' },
        { key: 'monthlyExpenses', label: 'Projected Monthly Expenses ($)', type: 'number', placeholder: '20000' },
      ].map(({ key, label, type, placeholder }) => (
        <div key={key}>
          <label className="text-xs font-medium text-slate-400 block mb-1.5">{label}</label>
          <input
            type={type}
            value={(value[key] as string | number) ?? ''}
            placeholder={placeholder}
            onChange={e => set(key, type === 'number' ? Number(e.target.value) : e.target.value)}
            className="w-full rounded-lg border border-surface-400/50 bg-surface-200 px-3 py-2 text-sm text-white placeholder-slate-600 focus:border-brand-500 focus:outline-none"
          />
        </div>
      ))}
    </div>
  );
}

function RentIncreaseForm({ value, onChange }: { value: Record<string, unknown>; onChange: (v: Record<string, unknown>) => void }) {
  return (
    <div>
      <label className="text-xs font-medium text-slate-400 block mb-1.5">Rent Increase (%)</label>
      <input
        type="number" min={1} max={100}
        value={(value.percentageIncrease as number) ?? 5}
        onChange={e => onChange({ ...value, percentageIncrease: Number(e.target.value) })}
        className="w-full rounded-lg border border-surface-400/50 bg-surface-200 px-3 py-2 text-sm text-white focus:border-brand-500 focus:outline-none"
      />
      <p className="mt-1 text-[11px] text-slate-600">Applied across all active leases in portfolio</p>
    </div>
  );
}

const PARAM_FORMS: Record<ScenarioType, React.FC<{ value: Record<string, unknown>; onChange: (v: Record<string, unknown>) => void }>> = {
  occupancy_drop:   OccupancyDropForm,
  tenant_departure: TenantDepartureForm,
  expense_increase: ExpenseIncreaseForm,
  acquisition:      AcquisitionForm,
  rent_increase:    RentIncreaseForm,
};

// ─── Impact metric ────────────────────────────────────────────────────────────

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
      <div className="flex items-end justify-between gap-2">
        <div>
          <p className="text-xs text-slate-600">Current</p>
          <p className="text-sm font-semibold text-slate-300 tabular-nums">{format(current)}</p>
        </div>
        <ArrowRight className="h-3.5 w-3.5 text-slate-600 mb-0.5 shrink-0" />
        <div className="text-right">
          <p className="text-xs text-slate-600">Projected</p>
          <p className="text-sm font-bold text-white tabular-nums">{format(projected)}</p>
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

// ─── Results panel ────────────────────────────────────────────────────────────

function ResultsPanel({ result }: { result: SimulationResult }) {
  const { current, projected, impact, analysis } = result;
  const annualPositive = impact.estimatedAnnualImpact >= 0;
  const confidenceColor = {
    high: 'text-success bg-success/10 border-success/20',
    medium: 'text-warning bg-warning/10 border-warning/20',
    low: 'text-slate-400 bg-surface-300/50 border-surface-400/30',
  }[analysis.confidence];

  return (
    <div className="flex flex-col gap-5">
      {/* Annual impact hero */}
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

      {/* Metric grid */}
      <div className="grid grid-cols-2 gap-3">
        <ImpactMetric label="Monthly Revenue" current={current.monthlyRevenue} projected={projected.monthlyRevenue} format={formatCurrency} />
        <ImpactMetric label="Monthly NOI"     current={current.noi}            projected={projected.noi}            format={formatCurrency} />
        <ImpactMetric label="Monthly Expenses" current={current.monthlyExpenses} projected={projected.monthlyExpenses} format={formatCurrency} />
        <ImpactMetric label="Occupancy Rate"  current={current.occupancyRate}   projected={projected.occupancyRate}  format={v => `${v.toFixed(1)}%`} />
      </div>

      {/* Analysis sections */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[
          { title: 'Findings',         items: analysis.findings,        icon: Zap,           color: 'text-brand-400'  },
          { title: 'Recommendations',  items: analysis.recommendations, icon: CheckCircle2,  color: 'text-success'    },
          { title: 'Risk Factors',     items: analysis.riskFactors,     icon: AlertTriangle, color: 'text-warning'    },
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

// ─── Main page ────────────────────────────────────────────────────────────────

export default function SimulatorPage() {
  const [selectedScenario, setSelectedScenario] = useState<ScenarioType>('occupancy_drop');
  const [params, setParams] = useState<Record<string, unknown>>({ percentageDrop: 5 });

  const DEFAULT_PARAMS: Record<ScenarioType, Record<string, unknown>> = {
    occupancy_drop:   { percentageDrop: 5 },
    tenant_departure: {},
    expense_increase: { percentageIncrease: 10 },
    acquisition:      { units: 10, monthlyRevenue: 50000, monthlyExpenses: 20000, propertyName: '' },
    rent_increase:    { percentageIncrease: 5 },
  };

  const handleScenarioChange = (type: ScenarioType) => {
    setSelectedScenario(type);
    setParams(DEFAULT_PARAMS[type]);
    mutation.reset();
  };

  const mutation = useMutation({
    mutationFn: () => aiService.runSimulation({ scenario: selectedScenario, params }),
  });

  const scenario = SCENARIOS.find(s => s.type === selectedScenario)!;
  const ParamForm = PARAM_FORMS[selectedScenario];

  const canSubmit = selectedScenario !== 'tenant_departure' || !!params.tenantId;

  return (
    <div className="flex flex-col gap-6 p-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-white tracking-tight">Scenario Simulator</h1>
        <p className="mt-0.5 text-sm text-slate-500">
          Model the financial impact of portfolio changes before they happen
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[340px_1fr]">
        {/* Left panel — scenario picker + params */}
        <div className="flex flex-col gap-4">
          {/* Scenario type selector */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Wand2 className="h-4 w-4 text-brand-400" />
                <CardTitle>Choose a Scenario</CardTitle>
              </div>
            </CardHeader>
            <CardBody className="p-2">
              <div className="flex flex-col gap-1">
                {SCENARIOS.map(s => {
                  const active = s.type === selectedScenario;
                  return (
                    <button
                      key={s.type}
                      onClick={() => handleScenarioChange(s.type)}
                      className={`flex items-start gap-3 rounded-lg px-3 py-2.5 text-left transition-colors ${
                        active ? 'bg-brand-600/20 ring-1 ring-brand-500/30' : 'hover:bg-surface-200/40'
                      }`}
                    >
                      <div
                        className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg"
                        style={{ backgroundColor: `${s.accentColor}20` }}
                      >
                        <span style={{ color: s.accentColor }}><s.icon className="h-3.5 w-3.5" /></span>
                      </div>
                      <div>
                        <p className={`text-sm font-medium ${active ? 'text-brand-300' : 'text-slate-300'}`}>{s.label}</p>
                        <p className="text-[11px] text-slate-600 mt-0.5">{s.description}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </CardBody>
          </Card>

          {/* Parameter form */}
          <Card>
            <CardHeader>
              <CardTitle>Parameters</CardTitle>
            </CardHeader>
            <CardBody>
              <ParamForm value={params} onChange={setParams} />
              <button
                onClick={() => mutation.mutate()}
                disabled={mutation.isPending || !canSubmit}
                className="mt-4 w-full inline-flex items-center justify-center gap-2 rounded-xl bg-brand-600 hover:bg-brand-500 disabled:opacity-40 disabled:cursor-not-allowed px-4 py-2.5 text-sm font-semibold text-white transition-colors shadow-glow-brand"
              >
                {mutation.isPending ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    Simulating...
                  </>
                ) : (
                  <>
                    <Wand2 className="h-4 w-4" />
                    Run Simulation
                  </>
                )}
              </button>
            </CardBody>
          </Card>
        </div>

        {/* Right panel — results */}
        <div>
          {mutation.isPending && (
            <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-surface-400/40 bg-surface-100 h-64">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-600/20 ring-1 ring-brand-500/30">
                <Wand2 className="h-5 w-5 text-brand-400 animate-pulse" />
              </div>
              <p className="text-sm font-medium text-slate-300">Running scenario analysis...</p>
              <p className="text-xs text-slate-600">This may take a few seconds</p>
            </div>
          )}

          {mutation.isError && (
            <div className="rounded-2xl border border-danger/20 bg-danger/5 px-5 py-4 flex items-start gap-3">
              <AlertTriangle className="h-4 w-4 text-danger shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-danger">Simulation failed</p>
                <p className="text-xs text-slate-500 mt-0.5">{(mutation.error as Error)?.message ?? 'Please try again.'}</p>
              </div>
            </div>
          )}

          {mutation.data && !mutation.isPending && (
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <span style={{ color: scenario.accentColor }}><scenario.icon className="h-4 w-4" /></span>
                  <CardTitle>{scenario.label} — Results</CardTitle>
                </div>
                <span className="text-xs text-slate-500">
                  {new Date(mutation.data.computedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </CardHeader>
              <CardBody>
                <ResultsPanel result={mutation.data} />
              </CardBody>
            </Card>
          )}

          {!mutation.data && !mutation.isPending && !mutation.isError && (
            <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-surface-400/50 h-64 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-surface-200/50">
                <Wand2 className="h-6 w-6 text-slate-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-400">Select a scenario and run the simulation</p>
                <p className="text-xs text-slate-600 mt-1">Results will show financial impact, findings, and recommended actions</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
