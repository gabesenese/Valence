import { User, Mail, Shield, Bell, Moon } from 'lucide-react';
import { useAuthStore } from '@/state/auth.store';
import { Card, CardHeader, CardTitle, CardBody } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';

export default function SettingsPage() {
  const user = useAuthStore((s) => s.user);

  const roleVariant: Record<string, 'brand' | 'success' | 'warning' | 'neutral'> = {
    ADMIN: 'brand',
    SUPER_ADMIN: 'danger' as never,
    ANALYST: 'success',
    VIEWER: 'neutral',
  };

  return (
    <div className="flex flex-col gap-6 p-6 animate-fade-in">
      <div>
        <h1 className="text-xl font-bold text-white tracking-tight">Settings</h1>
        <p className="mt-0.5 text-sm text-slate-500">Account preferences & configuration</p>
      </div>

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
                <p className="mb-1.5 text-2xs font-medium uppercase tracking-wider text-slate-600">First Name</p>
                <div className="rounded-lg border border-surface-400/40 bg-surface-200/50 px-3 py-2.5 text-sm text-slate-300">
                  {user?.firstName}
                </div>
              </div>
              <div>
                <p className="mb-1.5 text-2xs font-medium uppercase tracking-wider text-slate-600">Last Name</p>
                <div className="rounded-lg border border-surface-400/40 bg-surface-200/50 px-3 py-2.5 text-sm text-slate-300">
                  {user?.lastName}
                </div>
              </div>
              <div className="sm:col-span-2">
                <p className="mb-1.5 text-2xs font-medium uppercase tracking-wider text-slate-600">Email</p>
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
                <p className="text-2xs text-slate-500">{user?.role}</p>
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
                  <span className={`text-2xs font-medium ${enabled ? 'text-success' : 'text-slate-600'}`}>
                    {enabled ? '✓' : '—'}
                  </span>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>
      </div>

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
                  <p className="text-2xs text-slate-600">{description}</p>
                  <p className="mt-0.5 text-xs font-semibold text-brand-400">{value}</p>
                </div>
              </div>
            ))}
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
