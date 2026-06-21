import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Mail, Shield, Bell, Moon, ArrowRight, Zap, CreditCard,
  Trash2, Loader2, Lock, CheckCircle2, Eye, EyeOff,
  Smartphone, Monitor, X, Download, AlertTriangle,
} from 'lucide-react';
import { cn } from '@/utils/cn';
import { useAuthStore } from '@/state/auth.store';
import { useUIStore, type AlertSeverityFilter } from '@/state/ui.store';
import { usePlan, PLAN_LABELS, PLAN_PRICES } from '@/hooks/usePlan';
import { Card, CardHeader, CardTitle, CardBody } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { billingService } from '@/services/billing.service';
import { demoService } from '@/services/demo.service';
import { usersService } from '@/services/users.service';
import { authService } from '@/services/auth.service';
import { organizationService } from '@/services/organization.service';

// ─── Types ────────────────────────────────────────────────────────────────────

type Tab = 'account' | 'security' | 'billing' | 'sessions' | 'preferences' | 'danger';

const TABS: { id: Tab; label: string }[] = [
  { id: 'account',     label: 'Account'     },
  { id: 'security',    label: 'Security'    },
  { id: 'billing',     label: 'Billing'     },
  { id: 'sessions',    label: 'Sessions'    },
  { id: 'preferences', label: 'Preferences' },
  { id: 'danger',      label: 'Danger Zone' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseDevice(ua: string | null): string {
  if (!ua) return 'Unknown device';
  const browser = ua.includes('Firefox') ? 'Firefox'
    : ua.includes('Edg/') ? 'Edge'
    : ua.includes('Chrome') ? 'Chrome'
    : ua.includes('Safari') ? 'Safari'
    : 'Browser';
  const os = /iPhone/.test(ua) ? 'iPhone'
    : /iPad/.test(ua) ? 'iPad'
    : /Android/.test(ua) ? 'Android'
    : /Macintosh|Mac OS X/.test(ua) ? 'Mac'
    : /Windows/.test(ua) ? 'Windows'
    : /Linux/.test(ua) ? 'Linux'
    : 'Device';
  return `${browser} on ${os}`;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const user        = useAuthStore((s) => s.user);
  const updateUser  = useAuthStore((s) => s.updateUser);
  const navigate    = useNavigate();
  const qc          = useQueryClient();
  const { plan, limits, daysLeft, trialActive, label: planLabel } = usePlan();
  const alertSeverityFilter    = useUIStore((s) => s.alertSeverityFilter);
  const setAlertSeverityFilter = useUIStore((s) => s.setAlertSeverityFilter);
  const theme                  = useUIStore((s) => s.theme);
  const setTheme               = useUIStore((s) => s.setTheme);

  const [activeTab, setActiveTab] = useState<Tab>('account');

  const { data: org } = useQuery({
    queryKey: ['organization'],
    queryFn: organizationService.getOrganization,
    staleTime: 5 * 60_000,
  });

  const [revokingId, setRevokingId]   = useState<string | null>(null);
  const [revokingAll, setRevokingAll] = useState(false);
  const { data: sessions, refetch: refetchSessions } = useQuery({
    queryKey: ['sessions'],
    queryFn: authService.listSessions,
    enabled: activeTab === 'sessions',
  });

  const [portalLoading, setPortalLoading] = useState(false);
  const [resetConfirm,  setResetConfirm]  = useState(false);
  const [resetLoading,  setResetLoading]  = useState(false);
  const [resetDone,     setResetDone]     = useState(false);

  const [firstName,     setFirstName]     = useState(user?.firstName ?? '');
  const [lastName,      setLastName]      = useState(user?.lastName  ?? '');
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError,  setProfileError]  = useState('');
  const [profileSaved,  setProfileSaved]  = useState(false);

  const [newEmail,      setNewEmail]      = useState('');
  const [emailPassword, setEmailPassword] = useState('');
  const [emailSaving,   setEmailSaving]   = useState(false);
  const [emailError,    setEmailError]    = useState('');
  const [emailSaved,    setEmailSaved]    = useState(false);

  const [currentPw,     setCurrentPw]     = useState('');
  const [newPw,         setNewPw]         = useState('');
  const [confirmPw,     setConfirmPw]     = useState('');
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw,     setShowNewPw]     = useState(false);
  const [pwSaving,      setPwSaving]      = useState(false);
  const [pwError,       setPwError]       = useState('');
  const [pwSaved,       setPwSaved]       = useState(false);

  const [mfaSetupData, setMfaSetupData] = useState<{ qrCode: string; secret: string } | null>(null);
  const [mfaTotp,      setMfaTotp]      = useState('');
  const [mfaLoading,   setMfaLoading]   = useState(false);
  const [mfaError,     setMfaError]     = useState('');
  const [mfaDone,      setMfaDone]      = useState(false);

  const profileDirty = firstName !== user?.firstName || lastName !== user?.lastName;
  const nextPlan = plan === 'ESSENTIALS' ? 'PROFESSIONAL' : plan === 'PROFESSIONAL' ? 'EXECUTIVE' : null;

  const inputCls = 'h-9 w-full rounded-lg border border-surface-400 bg-surface-200 px-3 text-sm text-slate-100 placeholder:text-slate-600 transition-colors focus:border-brand-500/60 focus:bg-surface-300 focus:outline-none focus:ring-1 focus:ring-brand-500/30';

  // ── Handlers ──────────────────────────────────────────────────────────────

  const openPortal = async () => {
    setPortalLoading(true);
    try { window.location.href = await billingService.createPortal(); }
    finally { setPortalLoading(false); }
  };

  const resetPortfolio = async () => {
    setResetLoading(true);
    try { await demoService.resetDemo(); await qc.invalidateQueries(); setResetDone(true); setResetConfirm(false); }
    finally { setResetLoading(false); }
  };

  const saveProfile = async () => {
    setProfileError(''); setProfileSaved(false);
    if (!firstName.trim() || !lastName.trim()) { setProfileError('First and last name are required.'); return; }
    setProfileSaving(true);
    try {
      const updated = await usersService.updateProfile(firstName.trim(), lastName.trim());
      updateUser({ firstName: updated.firstName, lastName: updated.lastName });
      setProfileSaved(true);
    } catch (err: unknown) { setProfileError((err as Error).message || 'Failed to save.'); }
    finally { setProfileSaving(false); }
  };

  const saveEmail = async () => {
    setEmailError(''); setEmailSaved(false); setEmailSaving(true);
    try { await usersService.changeEmail(newEmail, emailPassword); setEmailSaved(true); setNewEmail(''); setEmailPassword(''); }
    catch (err: unknown) { setEmailError((err as Error).message || 'Failed to update email.'); }
    finally { setEmailSaving(false); }
  };

  const savePassword = async () => {
    setPwError(''); setPwSaved(false);
    if (newPw !== confirmPw) { setPwError('Passwords do not match.'); return; }
    if (newPw.length < 8)   { setPwError('Password must be at least 8 characters.'); return; }
    setPwSaving(true);
    try { await usersService.changePassword(currentPw, newPw); setPwSaved(true); setCurrentPw(''); setNewPw(''); setConfirmPw(''); }
    catch (err: unknown) { setPwError((err as Error).message || 'Failed to change password.'); }
    finally { setPwSaving(false); }
  };

  const startMfaSetup = async () => {
    setMfaLoading(true); setMfaError('');
    try { setMfaSetupData(await authService.setupMfa()); }
    catch (err: unknown) { setMfaError((err as Error).message || 'Failed to initialize MFA.'); }
    finally { setMfaLoading(false); }
  };

  const confirmMfaEnable = async () => {
    setMfaLoading(true); setMfaError('');
    try {
      const updated = await authService.enableMfa(mfaTotp);
      updateUser({ mfaEnabled: updated.mfaEnabled });
      setMfaSetupData(null); setMfaTotp(''); setMfaDone(true);
      setTimeout(() => setMfaDone(false), 4000);
    } catch (err: unknown) { setMfaError((err as Error).message || 'Invalid code.'); }
    finally { setMfaLoading(false); }
  };

  const disableMfa = async () => {
    const totp = window.prompt('Enter your authenticator code to disable MFA:');
    if (!totp) return;
    setMfaLoading(true);
    try { const u = await authService.disableMfa(totp); updateUser({ mfaEnabled: u.mfaEnabled }); }
    catch (err: unknown) { alert((err as Error).message || 'Failed to disable MFA.'); }
    finally { setMfaLoading(false); }
  };

  const revokeSession = async (id: string) => {
    setRevokingId(id);
    try { await authService.revokeSession(id); await refetchSessions(); }
    finally { setRevokingId(null); }
  };

  const revokeAll = async () => {
    setRevokingAll(true);
    try { await authService.revokeAllSessions(); await refetchSessions(); }
    finally { setRevokingAll(false); }
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full animate-fade-in">

      {/* ── Header ── */}
      <div className="flex items-center gap-4 px-4 pt-4 pb-4 border-b border-surface-400/30 sm:px-6 sm:pt-6 sm:pb-5">
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-brand-600/20 border border-brand-600/30 select-none">
          <span className="text-lg font-bold text-brand-400">{user?.firstName?.[0]}{user?.lastName?.[0]}</span>
        </div>
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-fg truncate">{user?.firstName} {user?.lastName}</h1>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <span className="text-xs text-slate-500">{user?.role}</span>
            {org?.name && <><span className="text-slate-700">·</span><span className="text-xs text-slate-500 truncate">{org.name}</span></>}
            <span className="text-slate-700">·</span>
            <span className="text-xs font-semibold text-brand-400">{planLabel} Plan</span>
            {trialActive && daysLeft > 0 && (
              <><span className="text-slate-700">·</span><span className="text-xs font-medium text-warning">{daysLeft} days remaining in trial</span></>
            )}
          </div>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="flex border-b border-surface-400/30 px-4 overflow-x-auto sm:px-6">
        {TABS.map(({ id, label }) => (
          <button key={id} onClick={() => setActiveTab(id)}
            className={cn(
              'shrink-0 px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap',
              activeTab === id
                ? id === 'danger' ? 'border-danger text-danger' : 'border-brand-400 text-brand-300'
                : id === 'danger' ? 'border-transparent text-danger/50 hover:text-danger' : 'border-transparent text-slate-500 hover:text-slate-300',
            )}>
            {label}
          </button>
        ))}
      </div>

      {/* ── Content ── */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6">

        {/* ACCOUNT */}
        {activeTab === 'account' && (
          <div className="max-w-xl flex flex-col gap-4">
            <Card>
              <CardHeader><CardTitle>Profile</CardTitle></CardHeader>
              <CardBody className="flex flex-col gap-4">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-medium uppercase tracking-wider text-slate-400">First Name</label>
                    <input type="text" value={firstName} onChange={(e) => { setFirstName(e.target.value); setProfileSaved(false); }} className={inputCls} />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-medium uppercase tracking-wider text-slate-400">Last Name</label>
                    <input type="text" value={lastName} onChange={(e) => { setLastName(e.target.value); setProfileSaved(false); }} className={inputCls} />
                  </div>
                  <div className="col-span-2 flex flex-col gap-1.5">
                    <label className="text-xs font-medium uppercase tracking-wider text-slate-400">Email</label>
                    <div className="flex items-center gap-2 rounded-lg border border-surface-400/40 bg-surface-200/50 px-3 h-9">
                      <Mail className="h-4 w-4 text-slate-600 shrink-0" />
                      <span className="text-sm text-slate-400">{user?.email}</span>
                    </div>
                  </div>
                </div>
                {profileError && <p className="text-xs text-danger">{profileError}</p>}
                <div className="flex items-center gap-3">
                  <Button size="sm" onClick={saveProfile} loading={profileSaving} disabled={!profileDirty}>Save changes</Button>
                  {profileSaved && <span className="flex items-center gap-1 text-xs text-success"><CheckCircle2 className="h-3.5 w-3.5" /> Saved</span>}
                </div>
              </CardBody>
            </Card>

            <button onClick={() => navigate('/organization')}
              className="flex items-center justify-between rounded-xl border border-surface-400/30 bg-surface-100 px-4 py-3.5 text-left hover:bg-surface-200/50 transition-colors group">
              <div>
                <p className="text-sm font-semibold text-fg">Organization Settings</p>
                <p className="text-xs text-slate-500 mt-0.5">Profile, team members, roles, and currency</p>
              </div>
              <ArrowRight className="h-4 w-4 text-slate-600 group-hover:text-slate-400 transition-colors shrink-0" />
            </button>
          </div>
        )}

        {/* SECURITY */}
        {activeTab === 'security' && (
          <div className="max-w-xl flex flex-col gap-4">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2"><Mail className="h-4 w-4 text-brand-400" /><CardTitle>Change Email</CardTitle></div>
              </CardHeader>
              <CardBody className="flex flex-col gap-3">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-medium uppercase tracking-wider text-slate-400">New email</label>
                    <input type="email" value={newEmail} placeholder={user?.email} onChange={(e) => { setNewEmail(e.target.value); setEmailSaved(false); }} className={inputCls} />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-medium uppercase tracking-wider text-slate-400">Current password</label>
                    <input type="password" value={emailPassword} placeholder="Confirm identity" onChange={(e) => { setEmailPassword(e.target.value); setEmailSaved(false); }} className={inputCls} />
                  </div>
                </div>
                {emailError && <p className="text-xs text-danger">{emailError}</p>}
                <div className="flex items-center gap-3">
                  <Button size="sm" onClick={saveEmail} loading={emailSaving} disabled={!newEmail || !emailPassword}>Update email</Button>
                  {emailSaved && <span className="flex items-center gap-1 text-xs text-success"><CheckCircle2 className="h-3.5 w-3.5" /> Updated</span>}
                </div>
              </CardBody>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center gap-2"><Lock className="h-4 w-4 text-brand-400" /><CardTitle>Change Password</CardTitle></div>
              </CardHeader>
              <CardBody className="flex flex-col gap-3">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  {([
                    { label: 'Current password', val: currentPw, set: setCurrentPw, show: showCurrentPw, toggle: () => setShowCurrentPw(v => !v), ph: '••••••••' },
                    { label: 'New password',     val: newPw,     set: setNewPw,     show: showNewPw,     toggle: () => setShowNewPw(v => !v),     ph: 'Min. 8 chars' },
                  ] as const).map(({ label, val, set, show, toggle, ph }) => (
                    <div key={label} className="flex flex-col gap-1.5">
                      <label className="text-xs font-medium uppercase tracking-wider text-slate-400">{label}</label>
                      <div className="relative">
                        <input type={show ? 'text' : 'password'} value={val} placeholder={ph}
                          onChange={(e) => { (set as (v: string) => void)(e.target.value); setPwSaved(false); }}
                          className={cn(inputCls, 'pr-9')} />
                        <button type="button" onClick={toggle} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
                          {show ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                        </button>
                      </div>
                    </div>
                  ))}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-medium uppercase tracking-wider text-slate-400">Confirm new password</label>
                    <input type="password" value={confirmPw} placeholder="••••••••" onChange={(e) => { setConfirmPw(e.target.value); setPwSaved(false); }} className={inputCls} />
                  </div>
                </div>
                {newPw.length > 0 && newPw.length < 8 && <p className="text-[11px] text-slate-600">{8 - newPw.length} more character{8 - newPw.length !== 1 ? 's' : ''} needed</p>}
                {confirmPw.length > 0 && newPw !== confirmPw && <p className="text-[11px] text-danger">Passwords do not match</p>}
                {pwError && <p className="text-xs text-danger">{pwError}</p>}
                <div className="flex items-center gap-3">
                  <Button size="sm" onClick={savePassword} loading={pwSaving} disabled={!currentPw || !newPw || !confirmPw}>Change password</Button>
                  {pwSaved && <span className="flex items-center gap-1 text-xs text-success"><CheckCircle2 className="h-3.5 w-3.5" /> Updated</span>}
                </div>
              </CardBody>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center gap-2"><Smartphone className="h-4 w-4 text-brand-400" /><CardTitle>Two-Factor Authentication</CardTitle></div>
              </CardHeader>
              <CardBody>
                {user?.mfaEnabled ? (
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2 mb-1"><CheckCircle2 className="h-4 w-4 text-success" /><span className="text-sm font-semibold text-fg">MFA is enabled</span></div>
                      <p className="text-xs text-slate-500">Your account requires an authenticator code on every sign in.</p>
                      {mfaDone && <p className="mt-1 text-xs text-success">MFA enabled successfully.</p>}
                    </div>
                    <Button size="sm" variant="danger" onClick={disableMfa} loading={mfaLoading}>Disable</Button>
                  </div>
                ) : mfaSetupData ? (
                  <div className="flex flex-col gap-4">
                    <div>
                      <p className="text-sm font-medium text-fg mb-1">Scan with your authenticator app</p>
                      <p className="text-xs text-slate-500 mb-3">Use Google Authenticator, Authy, or any TOTP app.</p>
                      <img src={mfaSetupData.qrCode} alt="QR Code" className="w-40 h-40 rounded-lg bg-white p-2" />
                      <p className="mt-2 text-xs text-slate-500">Or enter manually:</p>
                      <code className="mt-1 inline-block rounded bg-surface-300 px-2 py-1 text-xs text-slate-300 tracking-widest">{mfaSetupData.secret}</code>
                    </div>
                    <div className="flex flex-col gap-2">
                      <label className="text-xs font-medium uppercase tracking-wider text-slate-400">Verify 6-digit code</label>
                      <div className="flex gap-2">
                        <input type="text" inputMode="numeric" maxLength={6} value={mfaTotp} placeholder="000000"
                          onChange={(e) => setMfaTotp(e.target.value.replace(/\D/g, ''))}
                          className="h-9 w-32 rounded-lg border border-surface-400 bg-surface-200 px-3 text-center text-lg tracking-widest text-slate-100 placeholder:text-slate-600 focus:border-brand-500/60 focus:outline-none" />
                        <Button size="sm" onClick={confirmMfaEnable} loading={mfaLoading} disabled={mfaTotp.length !== 6}>Enable MFA</Button>
                        <button onClick={() => { setMfaSetupData(null); setMfaTotp(''); setMfaError(''); }} className="text-xs text-slate-500 hover:text-slate-300">Cancel</button>
                      </div>
                      {mfaError && <p className="text-xs text-danger">{mfaError}</p>}
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-medium text-slate-300 mb-0.5">Add a second layer of security</p>
                      <p className="text-xs text-slate-500">Require an authenticator code at every sign in.</p>
                    </div>
                    <Button size="sm" onClick={startMfaSetup} loading={mfaLoading}>Set up MFA</Button>
                  </div>
                )}
              </CardBody>
            </Card>
          </div>
        )}

        {/* BILLING */}
        {activeTab === 'billing' && (
          <div className="max-w-xl flex flex-col gap-4">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2"><Zap className="h-4 w-4 text-brand-400" /><CardTitle>{PLAN_LABELS[plan]} Plan</CardTitle></div>
                <button onClick={() => navigate('/pricing')} className="text-xs text-brand-400 hover:text-brand-300 transition-colors">View all plans →</button>
              </CardHeader>
              <CardBody className="flex flex-col gap-5">
                <div className="flex items-end justify-between">
                  <div>
                    <p className="text-3xl font-bold text-fg">
                      ${PLAN_PRICES[plan].toLocaleString()}
                      <span className="text-base font-normal text-slate-500">/month</span>
                    </p>
                    <p className="text-xs text-slate-500 mt-1">Managed via Stripe</p>
                  </div>
                  {nextPlan && (
                    <button onClick={() => navigate('/pricing')}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600/20 hover:bg-brand-600/30 border border-brand-500/30 px-4 py-2 text-sm font-semibold text-brand-300 transition-colors">
                      Upgrade to {PLAN_LABELS[nextPlan]} <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: 'Properties', value: limits.properties === Infinity ? 'Unlimited' : limits.properties.toLocaleString() },
                    { label: 'Leases',     value: limits.leases     === Infinity ? 'Unlimited' : limits.leases.toLocaleString()     },
                  ].map(({ label, value }) => (
                    <div key={label} className="rounded-xl border border-surface-400/30 bg-surface-200/30 px-4 py-3">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-0.5">{label}</p>
                      <p className="text-lg font-bold text-fg">{value}</p>
                    </div>
                  ))}
                </div>
                <div className="h-px bg-surface-400/30" />
                <button onClick={openPortal} disabled={portalLoading}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-surface-400/40 bg-surface-200/50 hover:bg-surface-200 px-4 py-2.5 text-sm font-semibold text-slate-300 transition-colors disabled:opacity-60">
                  {portalLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
                  Manage Billing
                </button>
              </CardBody>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center gap-2"><Shield className="h-4 w-4 text-brand-400" /><CardTitle>Access</CardTitle></div>
              </CardHeader>
              <CardBody className="flex flex-col gap-3">
                <div className="flex items-center gap-3 rounded-lg bg-surface-300/50 p-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600/20">
                    <Shield className="h-4 w-4 text-brand-400" />
                  </div>
                  <div>
                    <p className="text-xs font-medium text-slate-300">Role</p>
                    <p className="text-xs text-slate-500">{user?.role}</p>
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  {[
                    { label: 'View dashboard & analytics',  ok: true },
                    { label: 'Manage leases & properties',  ok: ['ADMIN','SUPER_ADMIN','ANALYST'].includes(user?.role ?? '') },
                    { label: 'Manage finance records',       ok: ['ADMIN','SUPER_ADMIN','ANALYST'].includes(user?.role ?? '') },
                    { label: 'Admin controls',              ok: ['ADMIN','SUPER_ADMIN'].includes(user?.role ?? '') },
                  ].map(({ label, ok }) => (
                    <div key={label} className="flex items-center justify-between text-xs">
                      <span className={ok ? 'text-slate-400' : 'text-slate-600'}>{label}</span>
                      <span className={ok ? 'font-semibold text-success' : 'text-slate-600'}>{ok ? '✓' : '—'}</span>
                    </div>
                  ))}
                </div>
              </CardBody>
            </Card>
          </div>
        )}

        {/* SESSIONS */}
        {activeTab === 'sessions' && (
          <div className="max-w-xl flex flex-col gap-4">
            {!sessions || sessions.length === 0 ? (
              <p className="text-sm text-slate-500">No active sessions found.</p>
            ) : (() => {
              const [current, ...others] = sessions;
              return (
                <>
                  <Card>
                    <CardHeader>
                      <div className="flex items-center gap-2"><Monitor className="h-4 w-4 text-brand-400" /><CardTitle>Current Session</CardTitle></div>
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-success/10 border border-success/20 px-2.5 py-0.5 text-[11px] font-semibold text-success">
                        <span className="h-1.5 w-1.5 rounded-full bg-success animate-pulse" /> Active Now
                      </span>
                    </CardHeader>
                    <CardBody>
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-surface-300/60">
                          <Monitor className="h-4 w-4 text-slate-400" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-slate-200">{parseDevice(current.userAgent)}</p>
                          <p className="text-xs text-slate-600 mt-0.5">Since {new Date(current.createdAt).toLocaleDateString('en-CA', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
                        </div>
                      </div>
                    </CardBody>
                  </Card>

                  {others.length > 0 && (
                    <Card>
                      <CardHeader>
                        <div className="flex items-center gap-2">
                          <Monitor className="h-4 w-4 text-slate-400" />
                          <CardTitle>Other Sessions ({others.length})</CardTitle>
                        </div>
                        <button onClick={revokeAll} disabled={revokingAll}
                          className="flex items-center gap-1 text-xs text-danger hover:text-danger/80 transition-colors disabled:opacity-60">
                          {revokingAll && <Loader2 className="h-3 w-3 animate-spin" />} Revoke all
                        </button>
                      </CardHeader>
                      <CardBody>
                        <div className="flex flex-col divide-y divide-surface-400/20">
                          {others.map((s) => (
                            <div key={s.id} className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
                              <div className="flex items-center gap-3 min-w-0">
                                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface-300/40">
                                  <Monitor className="h-3.5 w-3.5 text-slate-500" />
                                </div>
                                <div className="min-w-0">
                                  <p className="text-sm font-medium text-slate-300">{parseDevice(s.userAgent)}</p>
                                  <p className="text-[11px] text-slate-600 mt-0.5">Since {new Date(s.createdAt).toLocaleDateString('en-CA', { month: 'short', day: 'numeric' })}</p>
                                </div>
                              </div>
                              <button onClick={() => revokeSession(s.id)} disabled={revokingId === s.id}
                                className="shrink-0 text-slate-600 hover:text-danger transition-colors disabled:opacity-40">
                                {revokingId === s.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />}
                              </button>
                            </div>
                          ))}
                        </div>
                      </CardBody>
                    </Card>
                  )}
                </>
              );
            })()}
          </div>
        )}

        {/* PREFERENCES */}
        {activeTab === 'preferences' && (
          <div className="max-w-md flex flex-col gap-4">
            <Card>
              <CardHeader><CardTitle>Preferences</CardTitle></CardHeader>
              <CardBody className="flex flex-col gap-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface-300"><Moon className="h-4 w-4 text-slate-400" /></div>
                    <div><p className="text-sm font-medium text-slate-300">Theme</p><p className="text-xs text-slate-500">Interface color scheme</p></div>
                  </div>
                  <div className="flex rounded-lg border border-surface-400/30 bg-surface-200/30 p-0.5 shrink-0">
                    {(['light', 'dark', 'system'] as const).map((opt) => (
                      <button key={opt} type="button" onClick={() => setTheme(opt)}
                        className={cn('rounded-md px-3 py-1 text-xs font-medium capitalize transition-colors',
                          theme === opt
                            ? 'bg-brand-600/30 text-brand-300 border border-brand-600/40'
                            : 'border border-transparent text-slate-500 hover:text-slate-300',
                        )}>
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="h-px bg-surface-400/30" />

                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface-300"><Bell className="h-4 w-4 text-slate-400" /></div>
                    <div><p className="text-sm font-medium text-slate-300">Alert bell</p><p className="text-xs text-slate-500">Minimum severity shown</p></div>
                  </div>
                  <div className="flex rounded-lg border border-surface-400/30 bg-surface-200/30 p-0.5 shrink-0">
                    {(['all', 'warning', 'critical'] as AlertSeverityFilter[]).map((opt) => (
                      <button key={opt} onClick={() => setAlertSeverityFilter(opt)}
                        className={cn('rounded-md px-3 py-1 text-xs font-medium transition-colors',
                          alertSeverityFilter === opt && opt === 'all'      && 'bg-brand-600/30 text-brand-300 border border-brand-600/40',
                          alertSeverityFilter === opt && opt === 'warning'  && 'bg-danger/20 text-danger border border-danger/30',
                          alertSeverityFilter === opt && opt === 'critical' && 'bg-amber-500/20 text-amber-400 border border-amber-500/30',
                          alertSeverityFilter !== opt && 'text-slate-500 hover:text-slate-300',
                        )}>
                        {opt === 'all' ? 'All' : opt === 'warning' ? 'Warning+' : 'Critical'}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="h-px bg-surface-400/30" />

                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface-300"><Shield className="h-4 w-4 text-slate-400" /></div>
                    <div><p className="text-sm font-medium text-slate-300">Session duration</p><p className="text-xs text-slate-500">Stay signed in for up to 30 days</p></div>
                  </div>
                  <span className="rounded-lg border border-surface-400/30 bg-surface-200/50 px-3 py-1.5 text-xs font-medium text-slate-400">30 days</span>
                </div>
              </CardBody>
            </Card>
          </div>
        )}

        {/* DANGER ZONE */}
        {activeTab === 'danger' && (
          <div className="max-w-xl flex flex-col gap-4">
            <div className="flex items-center gap-2 mb-1">
              <AlertTriangle className="h-4 w-4 text-danger" />
              <p className="text-sm font-semibold text-danger">Danger Zone</p>
            </div>

            <Card>
              <CardBody>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-fg">Export Organization Data</p>
                    <p className="text-xs text-slate-500 mt-0.5">Download a full export of your portfolio data as CSV.</p>
                  </div>
                  <button onClick={() => navigate('/export')}
                    className="shrink-0 inline-flex items-center gap-1.5 rounded-lg border border-surface-400/40 bg-surface-200/50 hover:bg-surface-200 px-3 py-1.5 text-xs font-semibold text-slate-300 transition-colors">
                    <Download className="h-3.5 w-3.5" /> Export
                  </button>
                </div>
              </CardBody>
            </Card>

            <Card>
              <CardBody>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-fg">Reset Demo Portfolio</p>
                    <p className="text-xs text-slate-500 mt-0.5">Permanently deletes all properties, leases, tenants, financials, alerts, and tasks. Cannot be undone.</p>
                    {resetDone && <p className="text-xs text-success mt-2">Portfolio data cleared successfully.</p>}
                  </div>
                  <div className="shrink-0">
                    {!resetConfirm ? (
                      <button onClick={() => setResetConfirm(true)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-danger/30 bg-danger/10 hover:bg-danger/20 px-3 py-1.5 text-xs font-semibold text-danger transition-colors">
                        <Trash2 className="h-3.5 w-3.5" /> Reset data
                      </button>
                    ) : (
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs text-slate-400">Are you sure?</span>
                        <button onClick={resetPortfolio} disabled={resetLoading}
                          className="inline-flex items-center gap-1 rounded-lg bg-danger hover:bg-danger/80 px-3 py-1.5 text-xs font-semibold text-white transition-colors disabled:opacity-60">
                          {resetLoading && <Loader2 className="h-3 w-3 animate-spin" />} Confirm
                        </button>
                        <button onClick={() => setResetConfirm(false)} className="text-xs text-slate-500 hover:text-slate-300 transition-colors">Cancel</button>
                      </div>
                    )}
                  </div>
                </div>
              </CardBody>
            </Card>

            <Card className="opacity-60">
              <CardBody>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="text-sm font-semibold text-fg">Delete Organization</p>
                      <span className="rounded-full bg-surface-300 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">Coming Soon</span>
                    </div>
                    <p className="text-xs text-slate-500">Permanently removes your organization, all data, and cancels billing.</p>
                  </div>
                  <button disabled className="shrink-0 inline-flex items-center gap-1.5 rounded-lg border border-danger/20 px-3 py-1.5 text-xs font-semibold text-danger/40 cursor-not-allowed">
                    <Trash2 className="h-3.5 w-3.5" /> Delete
                  </button>
                </div>
              </CardBody>
            </Card>
          </div>
        )}

      </div>
    </div>
  );
}
