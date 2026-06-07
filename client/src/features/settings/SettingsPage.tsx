import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { User, Mail, Shield, Bell, Moon, ArrowRight, Zap, CreditCard, Trash2, Loader2 } from 'lucide-react';
import { useAuthStore } from '@/state/auth.store';
import { usePlan, PLAN_LABELS, PLAN_PRICES } from '@/hooks/usePlan';
import { Card, CardHeader, CardTitle, CardBody } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { PageHeader } from '@/components/ui/PageHeader';
import { billingService } from '@/services/billing.service';
import { demoService } from '@/services/demo.service';

export default function SettingsPage() {
  const user = useAuthStore((s) => s.user);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { plan, limits } = usePlan();
  const [portalLoading, setPortalLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [resetConfirm, setResetConfirm] = useState(false);
  const [resetDone, setResetDone] = useState(false);

  const nextPlan = plan === 'ESSENTIALS' ? 'PROFESSIONAL' : plan === 'PROFESSIONAL' ? 'EXECUTIVE' : null;

  const openPortal = async () => {
    setPortalLoading(true);
    try { window.location.href = await billingService.createPortal(); }
    finally { setPortalLoading(false); }
  };

  const resetPortfolio = async () => {
    setResetLoading(true);
    try {
      await demoService.resetDemo();
      await qc.invalidateQueries();
      setResetDone(true);
      setResetConfirm(false);
    } finally {
      setResetLoading(false);
    }
  };

  const roleVariant: Record<string, 'brand' | 'success' | 'warning' | 'neutral'> = {
    ADMIN: 'brand',
    SUPER_ADMIN: 'danger' as never,
    ANALYST: 'success',
    VIEWER: 'neutral',
  };

  return (
    <div className="flex flex-col gap-6 p-6 animate-fade-in">
      <PageHeader
        title="Settings"
        description="Account preferences & configuration"
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Profile card */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Profile</CardTitle>
          </CardHeader>
          <CardBody className="flex flex-col gap-5">
            {/* Avatar row */}
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-600/20 border border-brand-600/30">
                <User className="h-7 w-7 text-brand-400" />
              </div>
              <div>
                <p className="text-base font-semibold text-white">
                  {user?.firstName} {user?.lastName}
                </p>
                <div className="mt-1 flex items-center gap-2">
                  <Badge variant={roleVariant[user?.role ?? ''] ?? 'neutral'}>{user?.role}</Badge>
                </div>
              </div>
            </div>

            <div className="h-px bg-surface-400/30" />

            {/* Fields */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <p className="mb-1.5 text-xs font-medium uppercase tracking-wider text-slate-400">First Name</p>
                <div className="rounded-lg border border-surface-400/40 bg-surface-200/50 px-3 py-2.5 text-sm text-slate-300">
                  {user?.firstName}
                </div>
              </div>
              <div>
                <p className="mb-1.5 text-xs font-medium uppercase tracking-wider text-slate-400">Last Name</p>
                <div className="rounded-lg border border-surface-400/40 bg-surface-200/50 px-3 py-2.5 text-sm text-slate-300">
                  {user?.lastName}
                </div>
              </div>
              <div className="sm:col-span-2">
                <p className="mb-1.5 text-xs font-medium uppercase tracking-wider text-slate-400">Email</p>
                <div className="flex items-center gap-2 rounded-lg border border-surface-400/40 bg-surface-200/50 px-3 py-2.5">
                  <Mail className="h-4 w-4 text-slate-600 shrink-0" />
                  <span className="text-sm text-slate-300">{user?.email}</span>
                </div>
              </div>
            </div>
          </CardBody>
        </Card>

        {/* Access card */}
        <Card>
          <CardHeader>
            <CardTitle>Access</CardTitle>
          </CardHeader>
          <CardBody className="flex flex-col gap-4">
            <div className="flex items-center gap-3 rounded-lg bg-surface-300/50 p-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600/20">
                <Shield className="h-4 w-4 text-brand-400" />
              </div>
              <div>
                <p className="text-xs font-medium text-slate-300">Role</p>
                <p className="text-xs text-slate-400">{user?.role}</p>
              </div>
            </div>

            <div className="flex flex-col gap-2 text-xs text-slate-500">
              <p className="font-medium text-slate-400 mb-1">Permissions</p>
              {[
                { label: 'View dashboard & analytics', enabled: true },
                { label: 'Manage leases', enabled: ['ADMIN', 'SUPER_ADMIN', 'ANALYST'].includes(user?.role ?? '') },
                { label: 'Manage finance records', enabled: ['ADMIN', 'SUPER_ADMIN', 'ANALYST'].includes(user?.role ?? '') },
                { label: 'Admin controls', enabled: ['ADMIN', 'SUPER_ADMIN'].includes(user?.role ?? '') },
              ].map(({ label, enabled }) => (
                <div key={label} className="flex items-center justify-between">
                  <span className={enabled ? 'text-slate-400' : 'text-slate-600'}>{label}</span>
                  <span className={`text-xs font-medium ${enabled ? 'text-success' : 'text-slate-500'}`}>
                    {enabled ? '✓' : '—'}
                  </span>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>
      </div>

      {/* Plan card */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-brand-400" />
            <CardTitle>Plan</CardTitle>
          </div>
          <button
            onClick={() => navigate('/pricing')}
            className="text-xs text-brand-400 hover:text-brand-300 transition-colors"
          >
            View all plans →
          </button>
        </CardHeader>
        <CardBody>
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-base font-bold text-white">{PLAN_LABELS[plan]}</p>
              <p className="text-xs text-slate-500">${PLAN_PRICES[plan].toLocaleString()} / month</p>
            </div>
            {nextPlan && (
              <button
                onClick={() => navigate('/pricing')}
                className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600/20 hover:bg-brand-600/30 border border-brand-500/30 px-3 py-1.5 text-xs font-semibold text-brand-300 transition-colors"
              >
                Upgrade to {PLAN_LABELS[nextPlan]}
                <ArrowRight className="h-3 w-3" />
              </button>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            {[
              {
                label: 'Properties',
                limit: limits.properties === Infinity ? 'Unlimited' : limits.properties.toLocaleString(),
              },
              {
                label: 'Leases',
                limit: limits.leases === Infinity ? 'Unlimited' : limits.leases.toLocaleString(),
              },
            ].map(({ label, limit }) => (
              <div key={label} className="rounded-lg border border-surface-400/30 bg-surface-200/30 px-3 py-2.5">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-0.5">{label}</p>
                <p className="text-sm font-bold text-white">{limit}</p>
              </div>
            ))}
          </div>
        </CardBody>
      </Card>

      {/* Billing */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <CreditCard className="h-4 w-4 text-brand-400" />
            <CardTitle>Billing</CardTitle>
          </div>
        </CardHeader>
        <CardBody className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-semibold text-white">{PLAN_LABELS[plan]} plan</p>
            <p className="text-xs text-slate-500 mt-0.5">${PLAN_PRICES[plan].toLocaleString()} / month · manage invoices, payment method, and cancellation</p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {nextPlan && (
              <button
                onClick={() => navigate('/pricing')}
                className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600/20 hover:bg-brand-600/30 border border-brand-500/30 px-3 py-1.5 text-xs font-semibold text-brand-300 transition-colors"
              >
                Upgrade <ArrowRight className="h-3 w-3" />
              </button>
            )}
            <button
              onClick={openPortal}
              disabled={portalLoading}
              className="inline-flex items-center gap-1.5 rounded-lg border border-surface-400/40 bg-surface-200/50 hover:bg-surface-200 px-3 py-1.5 text-xs font-semibold text-slate-300 transition-colors disabled:opacity-60"
            >
              {portalLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CreditCard className="h-3.5 w-3.5" />}
              Manage Billing
            </button>
          </div>
        </CardBody>
      </Card>

      {/* Preferences */}
      <Card>
        <CardHeader>
          <CardTitle>Preferences</CardTitle>
        </CardHeader>
        <CardBody>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { icon: Moon, label: 'Theme', value: 'Dark', description: 'Interface color scheme' },
              { icon: Bell, label: 'Notifications', value: 'Enabled', description: 'Alert & system notifications' },
              { icon: Shield, label: 'Session', value: '15 min timeout', description: 'Access token expiry' },
            ].map(({ icon: Icon, label, value, description }) => (
              <div key={label} className="flex items-center gap-3 rounded-lg border border-surface-400/30 bg-surface-200/30 p-3.5">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface-300">
                  <Icon className="h-4 w-4 text-slate-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-300">{label}</p>
                  <p className="text-xs text-slate-500">{description}</p>
                  <p className="mt-0.5 text-xs font-semibold text-brand-400">{value}</p>
                </div>
              </div>
            ))}
          </div>
        </CardBody>
      </Card>
      {/* Data */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Trash2 className="h-4 w-4 text-danger" />
            <CardTitle>Portfolio Data</CardTitle>
          </div>
        </CardHeader>
        <CardBody>
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-white">Reset all portfolio data</p>
              <p className="text-xs text-slate-500 mt-0.5">
                Permanently deletes all properties, leases, tenants, financial records, alerts, and tasks.
                This cannot be undone.
              </p>
              {resetDone && (
                <p className="text-xs text-success mt-2">Portfolio data cleared successfully.</p>
              )}
            </div>
            <div className="shrink-0">
              {!resetConfirm ? (
                <button
                  onClick={() => setResetConfirm(true)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-danger/30 bg-danger/10 hover:bg-danger/20 px-3 py-1.5 text-xs font-semibold text-danger transition-colors"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  Reset data
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400">Are you sure?</span>
                  <button
                    onClick={resetPortfolio}
                    disabled={resetLoading}
                    className="inline-flex items-center gap-1 rounded-lg bg-danger hover:bg-danger/80 px-3 py-1.5 text-xs font-semibold text-white transition-colors disabled:opacity-60"
                  >
                    {resetLoading && <Loader2 className="h-3 w-3 animate-spin" />}
                    Confirm
                  </button>
                  <button
                    onClick={() => setResetConfirm(false)}
                    className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
