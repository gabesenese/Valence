import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Building2, Users, FileText, CheckCircle2, Circle,
  ArrowRight, Activity, ChevronRight, Zap, Database, Loader2,
} from 'lucide-react';
import { useAuthStore } from '@/state/auth.store';
import { propertiesService } from '@/services/properties.service';
import { tenantsService } from '@/services/tenants.service';
import { leasesService } from '@/services/leases.service';
import { demoService } from '@/services/demo.service';
import { eventService } from '@/services/event.service';
import { Button } from '@/components/ui/Button';
import PropertyFormModal from '@/features/properties/PropertyFormModal';
import TenantFormModal from '@/features/tenants/TenantFormModal';
import LeaseFormModal from '@/features/leases/LeaseFormModal';

type Mode = 'choose' | 'demo-loading' | 'manual';

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

export default function SetupPage() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const [mode, setMode] = useState<Mode>('choose');
  const [demoError, setDemoError] = useState('');

  const [propertyOpen, setPropertyOpen] = useState(false);
  const [tenantOpen, setTenantOpen] = useState(false);
  const [leaseOpen, setLeaseOpen] = useState(false);

  const { data: properties, refetch: refetchProperties } = useQuery({
    queryKey: ['setup', 'properties'],
    queryFn: () => propertiesService.getProperties({ limit: 1 }),
    enabled: mode === 'manual',
  });

  const { data: tenants, refetch: refetchTenants } = useQuery({
    queryKey: ['setup', 'tenants'],
    queryFn: () => tenantsService.getTenants({ limit: 1 }),
    enabled: mode === 'manual',
  });

  const { data: leases, refetch: refetchLeases } = useQuery({
    queryKey: ['setup', 'leases'],
    queryFn: () => leasesService.getLeases({ limit: 1 }),
    enabled: mode === 'manual',
  });

  const hasProperty = (properties?.meta.total ?? 0) > 0;
  const hasTenant   = (tenants?.meta.total ?? 0) > 0;
  const hasLease    = (leases?.meta.total ?? 0) > 0;

  const stepsComplete = [hasProperty, hasTenant, hasLease].filter(Boolean).length;
  const allDone = stepsComplete === 3;

  useEffect(() => {
    if (!allDone || mode !== 'manual') return;
    const t = setTimeout(() => { eventService.track('setup_complete'); navigate('/queue'); }, 2500);
    return () => clearTimeout(t);
  }, [allDone, mode, navigate]);

  async function handleLoadDemo() {
    setMode('demo-loading');
    setDemoError('');
    try {
      await demoService.loadDemo();
      eventService.track('setup_complete');
      navigate('/queue');
    } catch {
      setDemoError('Failed to load demo data. Please try again.');
      setMode('choose');
    }
  }

  const steps = [
    {
      number: 1,
      icon: Building2,
      title: 'Add your properties',
      description: 'Start by adding the buildings and locations your company owns or manages.',
      cta: hasProperty ? 'Add Another' : 'Add Property',
      done: hasProperty,
      doneLabel: `${properties?.meta.total ?? 1} propert${(properties?.meta.total ?? 1) === 1 ? 'y' : 'ies'} added`,
      onAction: () => setPropertyOpen(true),
      disabled: false,
    },
    {
      number: 2,
      icon: Users,
      title: 'Add your tenants',
      description: 'Add the businesses or individuals who rent space in your properties.',
      cta: hasTenant ? 'Add Another' : 'Add Tenant',
      done: hasTenant,
      doneLabel: `${tenants?.meta.total ?? 1} tenant${(tenants?.meta.total ?? 1) === 1 ? '' : 's'} added`,
      onAction: () => setTenantOpen(true),
      disabled: false,
    },
    {
      number: 3,
      icon: FileText,
      title: 'Create your first lease',
      description: 'Connect a tenant to a property with a lease agreement.',
      cta: hasLease ? 'Add Another' : 'Create Lease',
      done: hasLease,
      doneLabel: `${leases?.meta.total ?? 1} lease${(leases?.meta.total ?? 1) === 1 ? '' : 's'} created`,
      onAction: () => setLeaseOpen(true),
      disabled: !hasProperty || !hasTenant,
      disabledReason: !hasProperty ? 'Add a property first' : 'Add a tenant first',
    },
  ];

  return (
    <div className="min-h-screen bg-surface-0 flex flex-col items-center px-4 py-16 animate-fade-in">
      {/* Logo */}
      <div className="flex items-center gap-2.5 mb-12">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-600 shadow-glow-brand">
          <Activity className="h-5 w-5 text-white" />
        </div>
        <span className="text-lg font-bold text-white tracking-tight">Valence</span>
      </div>

      {/* ── Choose mode ───────────────────────────────────────────────────────── */}
      {(mode === 'choose' || mode === 'demo-loading') && (
        <>
          <div className="text-center mb-10 max-w-lg">
            <h1 className="text-2xl font-bold text-white tracking-tight">
              {getGreeting()}, {user?.firstName}!
            </h1>
            <p className="mt-2 text-slate-400">
              How would you like to get started?
            </p>
          </div>

          {demoError && (
            <p className="mb-6 text-xs text-danger text-center">{demoError}</p>
          )}

          <div className="w-full max-w-lg grid gap-4 sm:grid-cols-2">
            {/* Demo data card */}
            <button
              onClick={handleLoadDemo}
              disabled={mode === 'demo-loading'}
              className="group flex flex-col gap-4 rounded-2xl border border-brand-500/40 bg-brand-600/5 p-6 text-left transition-all hover:border-brand-500/70 hover:bg-brand-600/10 disabled:opacity-70 disabled:cursor-not-allowed"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-600/20">
                {mode === 'demo-loading'
                  ? <Loader2 className="h-5 w-5 text-brand-400 animate-spin" />
                  : <Zap className="h-5 w-5 text-brand-400" />
                }
              </div>
              <div>
                <p className="text-sm font-semibold text-white">
                  {mode === 'demo-loading' ? 'Loading demo…' : 'Explore demo portfolio'}
                </p>
                <p className="mt-1 text-xs leading-relaxed text-slate-500">
                  See the platform with a pre-built portfolio — properties, leases, alerts, and tasks already set up.
                </p>
              </div>
              <div className="mt-auto flex items-center gap-1.5 text-xs font-medium text-brand-400 group-hover:text-brand-300 transition-colors">
                Load instantly <ArrowRight className="h-3.5 w-3.5" />
              </div>
            </button>

            {/* Real data card */}
            <button
              onClick={() => setMode('manual')}
              disabled={mode === 'demo-loading'}
              className="group flex flex-col gap-4 rounded-2xl border border-surface-400/40 bg-surface-100 p-6 text-left transition-all hover:border-surface-500 hover:bg-surface-200/60 disabled:opacity-70 disabled:cursor-not-allowed"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface-300/60">
                <Database className="h-5 w-5 text-slate-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-white">Set up my real portfolio</p>
                <p className="mt-1 text-xs leading-relaxed text-slate-500">
                  Add your own properties, tenants, and leases step by step. Start with what you have.
                </p>
              </div>
              <div className="mt-auto flex items-center gap-1.5 text-xs font-medium text-slate-400 group-hover:text-slate-300 transition-colors">
                Get started <ArrowRight className="h-3.5 w-3.5" />
              </div>
            </button>
          </div>

          <p className="mt-6 text-xs text-slate-600">
            You can switch between demo and real data anytime in settings.
          </p>
        </>
      )}

      {/* ── Manual setup ──────────────────────────────────────────────────────── */}
      {mode === 'manual' && (
        <>
          <div className="text-center mb-10 max-w-lg">
            <h1 className="text-2xl font-bold text-white tracking-tight">
              {getGreeting()}, {user?.firstName}!
            </h1>
            <p className="mt-2 text-slate-400">
              Follow these three steps and you'll be up and running in minutes.
            </p>
          </div>

          {/* Progress */}
          <div className="w-full max-w-lg mb-8">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-slate-500">{stepsComplete} of 3 steps complete</span>
              {allDone && <span className="text-xs font-semibold text-success">All done!</span>}
            </div>
            <div className="h-1.5 w-full rounded-full bg-surface-400 overflow-hidden">
              <div
                className="h-full rounded-full bg-brand-500 transition-all duration-500"
                style={{ width: `${(stepsComplete / 3) * 100}%` }}
              />
            </div>
          </div>

          {/* Steps */}
          <div className="w-full max-w-lg flex flex-col gap-3 mb-8">
            {steps.map((step) => {
              const Icon = step.icon;
              return (
                <div
                  key={step.number}
                  className={`rounded-xl border p-5 transition-colors ${
                    step.done
                      ? 'border-success/30 bg-success/5'
                      : step.disabled
                      ? 'border-surface-400/40 bg-surface-100/50 opacity-60'
                      : 'border-surface-400/60 bg-surface-100'
                  }`}
                >
                  <div className="flex items-start gap-4">
                    <div className="mt-0.5 shrink-0">
                      {step.done
                        ? <CheckCircle2 className="h-5 w-5 text-success" />
                        : <Circle className="h-5 w-5 text-slate-600" />
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Icon className={`h-4 w-4 shrink-0 ${step.done ? 'text-success' : 'text-brand-400'}`} />
                        <h3 className="text-sm font-semibold text-white">{step.title}</h3>
                        {step.done && (
                          <span className="ml-auto text-xs text-success font-medium">{step.doneLabel}</span>
                        )}
                      </div>
                      <p className="text-xs text-slate-500 leading-relaxed mb-3">{step.description}</p>
                      {step.disabled && step.disabledReason ? (
                        <span className="text-xs text-slate-600 italic">{step.disabledReason}</span>
                      ) : (
                        <button
                          onClick={step.onAction}
                          className={`inline-flex items-center gap-1.5 text-xs font-medium transition-colors ${
                            step.done ? 'text-slate-500 hover:text-slate-300' : 'text-brand-400 hover:text-brand-300'
                          }`}
                        >
                          {step.cta}
                          <ChevronRight className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex flex-col items-center gap-2">
            <Button onClick={() => { eventService.track('setup_complete'); navigate('/queue'); }} size="md">
              {allDone ? 'Go to Dashboard' : 'Skip for Now'}
              <ArrowRight className="h-4 w-4" />
            </Button>
            {allDone ? (
              <p className="text-xs text-slate-600">Taking you to your dashboard…</p>
            ) : (
              <p className="text-xs text-slate-600">You can finish setup anytime from the dashboard.</p>
            )}
          </div>

          <button
            onClick={() => setMode('choose')}
            className="mt-6 text-xs text-slate-600 hover:text-slate-400 transition-colors"
          >
            ← Back to options
          </button>
        </>
      )}

      {/* Modals */}
      <PropertyFormModal
        open={propertyOpen}
        onClose={() => { setPropertyOpen(false); refetchProperties(); }}
      />
      <TenantFormModal
        open={tenantOpen}
        onClose={() => { setTenantOpen(false); refetchTenants(); }}
      />
      <LeaseFormModal
        open={leaseOpen}
        onClose={() => { setLeaseOpen(false); refetchLeases(); }}
      />
    </div>
  );
}
