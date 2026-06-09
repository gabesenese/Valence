import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import {
  User, Mail, Shield, Bell, Moon, ArrowRight, Zap, CreditCard,
  Trash2, Loader2, Lock, CheckCircle2, Eye, EyeOff,
  Smartphone, Monitor, X, HelpCircle, Bug, Lightbulb,
  MessageSquare, Paperclip, Send,
} from 'lucide-react';
import { cn } from '@/utils/cn';
import { useAuthStore } from '@/state/auth.store';
import { useUIStore, type AlertSeverityFilter } from '@/state/ui.store';
import { usePlan, PLAN_LABELS, PLAN_PRICES } from '@/hooks/usePlan';
import { Card, CardHeader, CardTitle, CardBody } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { PageHeader } from '@/components/ui/PageHeader';
import { Button } from '@/components/ui/Button';
import { billingService } from '@/services/billing.service';
import { demoService } from '@/services/demo.service';
import { usersService } from '@/services/users.service';
import { authService } from '@/services/auth.service';
import { supportService, type SupportCategory } from '@/services/support.service';

export default function SettingsPage() {
  const user = useAuthStore((s) => s.user);
  const updateUser = useAuthStore((s) => s.updateUser);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { plan, limits } = usePlan();
  const alertSeverityFilter = useUIStore((s) => s.alertSeverityFilter);
  const setAlertSeverityFilter = useUIStore((s) => s.setAlertSeverityFilter);

  // Portal / reset
  const [portalLoading, setPortalLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [resetConfirm, setResetConfirm] = useState(false);
  const [resetDone, setResetDone] = useState(false);

  // Profile form
  const [firstName, setFirstName] = useState(user?.firstName ?? '');
  const [lastName, setLastName] = useState(user?.lastName ?? '');
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState('');
  const [profileSaved, setProfileSaved] = useState(false);

  // Email form
  const [newEmail, setNewEmail] = useState('');
  const [emailPassword, setEmailPassword] = useState('');
  const [emailSaving, setEmailSaving] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [emailSaved, setEmailSaved] = useState(false);

  // Password form
  const [currentPw, setCurrentPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [pwSaving, setPwSaving] = useState(false);
  const [pwError, setPwError] = useState('');
  const [pwSaved, setPwSaved] = useState(false);

  // MFA
  const [mfaSetupData, setMfaSetupData] = useState<{ qrCode: string; secret: string } | null>(null);
  const [mfaTotp, setMfaTotp] = useState('');
  const [mfaLoading, setMfaLoading] = useState(false);
  const [mfaError, setMfaError] = useState('');
  const [mfaDone, setMfaDone] = useState(false);

  // Sessions
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [revokingAll, setRevokingAll] = useState(false);
  const { data: sessions, refetch: refetchSessions } = useQuery({
    queryKey: ['sessions'],
    queryFn: authService.listSessions,
  });

  const nextPlan = plan === 'ESSENTIALS' ? 'PROFESSIONAL' : plan === 'PROFESSIONAL' ? 'EXECUTIVE' : null;

  // Support form
  const [supportCategory, setSupportCategory] = useState<SupportCategory | null>(null);
  const [supportSubject, setSupportSubject] = useState('');
  const [supportMessage, setSupportMessage] = useState('');
  const [supportScreenshot, setSupportScreenshot] = useState<string | null>(null);
  const [supportScreenshotName, setSupportScreenshotName] = useState('');
  const screenshotInputRef = useRef<HTMLInputElement>(null);
  const supportMutation = useMutation({
    mutationFn: () => supportService.submitTicket({
      category:    supportCategory!,
      subject:     supportSubject,
      message:     supportMessage,
      screenshot:  supportScreenshot,
      pageUrl:     window.location.href,
      browserInfo: navigator.userAgent,
    }),
    onSuccess: () => {
      setTimeout(() => {
        setSupportCategory(null);
        setSupportSubject('');
        setSupportMessage('');
        setSupportScreenshot(null);
        setSupportScreenshotName('');
        supportMutation.reset();
      }, 3000);
    },
  });

  function openSupportForm(cat: SupportCategory) {
    setSupportCategory(cat);
    setSupportSubject('');
    setSupportMessage('');
    setSupportScreenshot(null);
    setSupportScreenshotName('');
    supportMutation.reset();
  }

  function handleScreenshotChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setSupportScreenshotName(file.name);
    const reader = new FileReader();
    reader.onload = () => setSupportScreenshot(reader.result as string);
    reader.readAsDataURL(file);
  }

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

  const saveProfile = async () => {
    setProfileError('');
    setProfileSaved(false);
    if (!firstName.trim() || !lastName.trim()) { setProfileError('First and last name are required.'); return; }
    setProfileSaving(true);
    try {
      const updated = await usersService.updateProfile(firstName, lastName);
      updateUser({ firstName: updated.firstName, lastName: updated.lastName });
      setProfileSaved(true);
      setTimeout(() => setProfileSaved(false), 3000);
    } catch (err: unknown) {
      setProfileError((err as Error).message || 'Failed to save.');
    } finally {
      setProfileSaving(false);
    }
  };

  const saveEmail = async () => {
    setEmailError('');
    setEmailSaved(false);
    if (!newEmail.trim()) { setEmailError('Email is required.'); return; }
    if (!emailPassword) { setEmailError('Current password is required.'); return; }
    setEmailSaving(true);
    try {
      const updated = await usersService.changeEmail(newEmail.trim(), emailPassword);
      updateUser({ email: updated.email });
      setNewEmail('');
      setEmailPassword('');
      setEmailSaved(true);
      setTimeout(() => setEmailSaved(false), 3000);
    } catch (err: unknown) {
      setEmailError((err as Error).message || 'Failed to update email.');
    } finally {
      setEmailSaving(false);
    }
  };

  const savePassword = async () => {
    setPwError('');
    setPwSaved(false);
    if (!currentPw) { setPwError('Current password is required.'); return; }
    if (newPw.length < 8) { setPwError('New password must be at least 8 characters.'); return; }
    if (newPw !== confirmPw) { setPwError('Passwords do not match.'); return; }
    setPwSaving(true);
    try {
      await usersService.changePassword(currentPw, newPw);
      setCurrentPw('');
      setNewPw('');
      setConfirmPw('');
      setPwSaved(true);
      setTimeout(() => setPwSaved(false), 3000);
    } catch (err: unknown) {
      setPwError((err as Error).message || 'Failed to change password.');
    } finally {
      setPwSaving(false);
    }
  };

  const startMfaSetup = async () => {
    setMfaLoading(true);
    setMfaError('');
    try {
      const data = await authService.setupMfa();
      setMfaSetupData({ qrCode: data.qrCode, secret: data.secret });
    } catch (err: unknown) {
      setMfaError((err as Error).message || 'Failed to initialize MFA.');
    } finally {
      setMfaLoading(false);
    }
  };

  const confirmMfaEnable = async () => {
    setMfaLoading(true);
    setMfaError('');
    try {
      const updated = await authService.enableMfa(mfaTotp);
      updateUser({ mfaEnabled: updated.mfaEnabled });
      setMfaSetupData(null);
      setMfaTotp('');
      setMfaDone(true);
      setTimeout(() => setMfaDone(false), 4000);
    } catch (err: unknown) {
      setMfaError((err as Error).message || 'Invalid code.');
    } finally {
      setMfaLoading(false);
    }
  };

  const disableMfa = async () => {
    const totp = window.prompt('Enter your authenticator code to disable MFA:');
    if (!totp) return;
    setMfaLoading(true);
    try {
      const updated = await authService.disableMfa(totp);
      updateUser({ mfaEnabled: updated.mfaEnabled });
    } catch (err: unknown) {
      alert((err as Error).message || 'Failed to disable MFA.');
    } finally {
      setMfaLoading(false);
    }
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

  const roleVariant: Record<string, 'brand' | 'success' | 'warning' | 'neutral'> = {
    ADMIN: 'brand',
    SUPER_ADMIN: 'danger' as never,
    ANALYST: 'success',
    VIEWER: 'neutral',
  };

  const profileDirty = firstName !== user?.firstName || lastName !== user?.lastName;

  return (
    <div className="flex flex-col gap-6 p-6 animate-fade-in">
      <PageHeader title="Settings" description="Account preferences & configuration" />

      {/* ── Two-column layout ── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">

        {/* ── Left column ── */}
        <div className="lg:col-span-2 flex flex-col gap-4">

        {/* Profile */}
        <Card>
          <CardHeader>
            <CardTitle>Profile</CardTitle>
          </CardHeader>
          <CardBody className="flex flex-col gap-5">
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

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium uppercase tracking-wider text-slate-400">First Name</label>
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => { setFirstName(e.target.value); setProfileSaved(false); }}
                  className="h-9 w-full rounded-lg border border-surface-400 bg-surface-200 px-3 text-sm text-slate-100 placeholder:text-slate-600 transition-colors focus:border-brand-500/60 focus:bg-surface-300 focus:outline-none focus:ring-1 focus:ring-brand-500/30"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-medium uppercase tracking-wider text-slate-400">Last Name</label>
                <input
                  type="text"
                  value={lastName}
                  onChange={(e) => { setLastName(e.target.value); setProfileSaved(false); }}
                  className="h-9 w-full rounded-lg border border-surface-400 bg-surface-200 px-3 text-sm text-slate-100 placeholder:text-slate-600 transition-colors focus:border-brand-500/60 focus:bg-surface-300 focus:outline-none focus:ring-1 focus:ring-brand-500/30"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="mb-1.5 block text-xs font-medium uppercase tracking-wider text-slate-400">Email</label>
                <div className="flex items-center gap-2 rounded-lg border border-surface-400/40 bg-surface-200/50 px-3 py-2.5">
                  <Mail className="h-4 w-4 text-slate-600 shrink-0" />
                  <span className="text-sm text-slate-400">{user?.email}</span>
                </div>
              </div>
            </div>

            {profileError && (
              <p className="text-xs text-danger">{profileError}</p>
            )}

            <div className="flex items-center gap-3">
              <Button
                size="sm"
                onClick={saveProfile}
                loading={profileSaving}
                disabled={!profileDirty}
              >
                Save name
              </Button>
              {profileSaved && (
                <span className="flex items-center gap-1 text-xs text-success">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Saved
                </span>
              )}
            </div>
          </CardBody>
        </Card>

        {/* Security */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Lock className="h-4 w-4 text-brand-400" />
              <CardTitle>Security</CardTitle>
            </div>
          </CardHeader>
          <CardBody className="flex flex-col gap-6">
            {/* Change email */}
            <div>
              <p className="text-sm font-semibold text-white mb-3">Change email</p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium uppercase tracking-wider text-slate-400">New email</label>
                  <input type="email" value={newEmail} onChange={(e) => { setNewEmail(e.target.value); setEmailSaved(false); }} placeholder={user?.email}
                    className="h-9 w-full rounded-lg border border-surface-400 bg-surface-200 px-3 text-sm text-slate-100 placeholder:text-slate-600 transition-colors focus:border-brand-500/60 focus:bg-surface-300 focus:outline-none focus:ring-1 focus:ring-brand-500/30" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium uppercase tracking-wider text-slate-400">Current password</label>
                  <input type="password" value={emailPassword} onChange={(e) => { setEmailPassword(e.target.value); setEmailSaved(false); }} placeholder="Confirm identity"
                    className="h-9 w-full rounded-lg border border-surface-400 bg-surface-200 px-3 text-sm text-slate-100 placeholder:text-slate-600 transition-colors focus:border-brand-500/60 focus:bg-surface-300 focus:outline-none focus:ring-1 focus:ring-brand-500/30" />
                </div>
              </div>
              {emailError && <p className="mt-2 text-xs text-danger">{emailError}</p>}
              <div className="mt-3 flex items-center gap-3">
                <Button size="sm" onClick={saveEmail} loading={emailSaving} disabled={!newEmail || !emailPassword}>Update email</Button>
                {emailSaved && <span className="flex items-center gap-1 text-xs text-success"><CheckCircle2 className="h-3.5 w-3.5" /> Email updated</span>}
              </div>
            </div>

            <div className="h-px bg-surface-400/30" />

            {/* Change password */}
            <div>
              <p className="text-sm font-semibold text-white mb-3">Change password</p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium uppercase tracking-wider text-slate-400">Current password</label>
                  <div className="relative">
                    <input type={showCurrentPw ? 'text' : 'password'} value={currentPw} onChange={(e) => { setCurrentPw(e.target.value); setPwSaved(false); }} placeholder="••••••••"
                      className="h-9 w-full rounded-lg border border-surface-400 bg-surface-200 px-3 pr-9 text-sm text-slate-100 placeholder:text-slate-600 transition-colors focus:border-brand-500/60 focus:bg-surface-300 focus:outline-none focus:ring-1 focus:ring-brand-500/30" />
                    <button type="button" onClick={() => setShowCurrentPw(!showCurrentPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
                      {showCurrentPw ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium uppercase tracking-wider text-slate-400">New password</label>
                  <div className="relative">
                    <input type={showNewPw ? 'text' : 'password'} value={newPw} onChange={(e) => { setNewPw(e.target.value); setPwSaved(false); }} placeholder="Min. 8 characters"
                      className="h-9 w-full rounded-lg border border-surface-400 bg-surface-200 px-3 pr-9 text-sm text-slate-100 placeholder:text-slate-600 transition-colors focus:border-brand-500/60 focus:bg-surface-300 focus:outline-none focus:ring-1 focus:ring-brand-500/30" />
                    <button type="button" onClick={() => setShowNewPw(!showNewPw)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300">
                      {showNewPw ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-medium uppercase tracking-wider text-slate-400">Confirm new password</label>
                  <input type="password" value={confirmPw} onChange={(e) => { setConfirmPw(e.target.value); setPwSaved(false); }} placeholder="••••••••"
                    className="h-9 w-full rounded-lg border border-surface-400 bg-surface-200 px-3 text-sm text-slate-100 placeholder:text-slate-600 transition-colors focus:border-brand-500/60 focus:bg-surface-300 focus:outline-none focus:ring-1 focus:ring-brand-500/30" />
                </div>
              </div>
              {newPw.length > 0 && newPw.length < 8 && <p className="mt-1 text-[11px] text-slate-600">{8 - newPw.length} more character{8 - newPw.length !== 1 ? 's' : ''} needed</p>}
              {confirmPw.length > 0 && newPw !== confirmPw && <p className="mt-1 text-[11px] text-danger">Passwords do not match</p>}
              {pwError && <p className="mt-2 text-xs text-danger">{pwError}</p>}
              <div className="mt-3 flex items-center gap-3">
                <Button size="sm" onClick={savePassword} loading={pwSaving} disabled={!currentPw || !newPw || !confirmPw}>Change password</Button>
                {pwSaved && <span className="flex items-center gap-1 text-xs text-success"><CheckCircle2 className="h-3.5 w-3.5" /> Password updated</span>}
              </div>
            </div>
          </CardBody>
        </Card>

        {/* Two-Factor Auth */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Smartphone className="h-4 w-4 text-brand-400" />
              <CardTitle>Two-Factor Authentication</CardTitle>
            </div>
          </CardHeader>
          <CardBody className="flex flex-col gap-4">
            {user?.mfaEnabled ? (
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <CheckCircle2 className="h-4 w-4 text-success" />
                    <span className="text-sm font-semibold text-white">MFA is enabled</span>
                  </div>
                  <p className="text-xs text-slate-500">Your account requires an authenticator code on sign in.</p>
                  {mfaDone && <p className="mt-1 text-xs text-success">MFA has been enabled successfully.</p>}
                </div>
                <Button size="sm" variant="danger" onClick={disableMfa} loading={mfaLoading}>Disable</Button>
              </div>
            ) : mfaSetupData ? (
              <div className="flex flex-col gap-4">
                <div>
                  <p className="text-sm font-medium text-white mb-1">Scan with your authenticator app</p>
                  <p className="text-xs text-slate-500 mb-3">Use Google Authenticator, Authy, or any TOTP app.</p>
                  <img src={mfaSetupData.qrCode} alt="QR Code" className="w-40 h-40 rounded-lg bg-white p-2" />
                  <p className="mt-2 text-xs text-slate-500">Or enter this code manually:</p>
                  <code className="mt-1 inline-block rounded bg-surface-300 px-2 py-1 text-xs text-slate-300 tracking-widest">{mfaSetupData.secret}</code>
                </div>
                <div className="flex flex-col gap-2">
                  <label className="text-xs font-medium uppercase tracking-wider text-slate-400">Verify 6-digit code</label>
                  <div className="flex gap-2">
                    <input type="text" inputMode="numeric" maxLength={6} value={mfaTotp} onChange={(e) => setMfaTotp(e.target.value.replace(/\D/g, ''))} placeholder="000000"
                      className="h-9 w-36 rounded-lg border border-surface-400 bg-surface-200 px-3 text-center text-lg tracking-widest text-slate-100 placeholder:text-slate-600 transition-colors focus:border-brand-500/60 focus:outline-none focus:ring-1 focus:ring-brand-500/30" />
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
                  <p className="text-xs text-slate-500">Use an authenticator app to generate a code at every sign in.</p>
                </div>
                <Button size="sm" onClick={startMfaSetup} loading={mfaLoading}>Set up MFA</Button>
              </div>
            )}
          </CardBody>
        </Card>

        </div>{/* /left column */}

        {/* ── Right column ── */}
        <div className="flex flex-col gap-4">

        {/* Plan + Billing */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-brand-400" />
              <CardTitle>Plan & Billing</CardTitle>
            </div>
            <button onClick={() => navigate('/pricing')} className="text-xs text-brand-400 hover:text-brand-300 transition-colors">
              All plans →
            </button>
          </CardHeader>
          <CardBody className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-base font-bold text-white">{PLAN_LABELS[plan]}</p>
                <p className="text-xs text-slate-500">${PLAN_PRICES[plan].toLocaleString()} / month</p>
              </div>
              {nextPlan && (
                <button onClick={() => navigate('/pricing')} className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600/20 hover:bg-brand-600/30 border border-brand-500/30 px-3 py-1.5 text-xs font-semibold text-brand-300 transition-colors">
                  Upgrade <ArrowRight className="h-3 w-3" />
                </button>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label: 'Properties', limit: limits.properties === Infinity ? 'Unlimited' : limits.properties.toLocaleString() },
                { label: 'Leases', limit: limits.leases === Infinity ? 'Unlimited' : limits.leases.toLocaleString() },
              ].map(({ label, limit }) => (
                <div key={label} className="rounded-lg border border-surface-400/30 bg-surface-200/30 px-3 py-2.5">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-0.5">{label}</p>
                  <p className="text-sm font-bold text-white">{limit}</p>
                </div>
              ))}
            </div>
            <div className="h-px bg-surface-400/30" />
            <button onClick={openPortal} disabled={portalLoading}
              className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-surface-400/40 bg-surface-200/50 hover:bg-surface-200 px-3 py-2 text-xs font-semibold text-slate-300 transition-colors disabled:opacity-60">
              {portalLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CreditCard className="h-3.5 w-3.5" />}
              Manage Billing
            </button>
          </CardBody>
        </Card>

        {/* Access */}
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
                  <span className={`text-xs font-medium ${enabled ? 'text-success' : 'text-slate-500'}`}>{enabled ? '✓' : '—'}</span>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>

        {/* Active Sessions */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Monitor className="h-4 w-4 text-brand-400" />
              <CardTitle>Active Sessions</CardTitle>
            </div>
            {sessions && sessions.length > 1 && (
              <button onClick={revokeAll} disabled={revokingAll} className="inline-flex items-center gap-1 text-xs text-danger hover:text-danger/80 transition-colors disabled:opacity-60">
                {revokingAll ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                Revoke all
              </button>
            )}
          </CardHeader>
          <CardBody>
            {!sessions || sessions.length === 0 ? (
              <p className="text-xs text-slate-500">No active sessions.</p>
            ) : (
              <div className="flex flex-col divide-y divide-surface-400/20">
                {sessions.map((s) => (
                  <div key={s.id} className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface-300/60">
                        <Monitor className="h-3.5 w-3.5 text-slate-400" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-slate-300 truncate">
                          {s.userAgent ? s.userAgent.replace(/\s*\(.*?\)\s*/g, ' ').trim().slice(0, 60) : 'Unknown device'}
                        </p>
                        <p className="text-[11px] text-slate-600 mt-0.5">
                          {s.ipAddress ?? 'Unknown IP'} · Started {new Date(s.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <button onClick={() => revokeSession(s.id)} disabled={revokingId === s.id}
                      className="shrink-0 text-slate-500 hover:text-danger transition-colors disabled:opacity-40" title="Revoke session">
                      {revokingId === s.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </CardBody>
        </Card>

        </div>{/* /right column */}

      </div>{/* /grid */}

      {/* ── Bottom grid: Help & Support (2/3) | Preferences + Portfolio Data (1/3) ── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">

        {/* Help & Support — left 2/3 */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center gap-2">
              <HelpCircle className="h-4 w-4 text-brand-400" />
              <CardTitle>Help & Support</CardTitle>
            </div>
          </CardHeader>
          <CardBody>
            <div className="grid grid-cols-3 gap-2 mb-5">
              {([
                { cat: 'General Support' as SupportCategory, icon: MessageSquare, label: 'Contact Support', color: 'text-blue-400', bg: 'bg-blue-500/10 border-blue-500/20 hover:bg-blue-500/20' },
                { cat: 'Bug Report'      as SupportCategory, icon: Bug,           label: 'Report a Bug',    color: 'text-danger',    bg: 'bg-danger/10 border-danger/20 hover:bg-danger/20' },
                { cat: 'Feature Request' as SupportCategory, icon: Lightbulb,     label: 'Request Feature', color: 'text-brand-400', bg: 'bg-brand-600/10 border-brand-500/20 hover:bg-brand-600/20' },
              ] as const).map(({ cat, icon: Icon, label, color, bg }) => (
                <button key={cat} onClick={() => openSupportForm(cat)}
                  className={cn('flex flex-col items-center gap-2 rounded-xl border px-3 py-3 text-center transition-colors', bg, supportCategory === cat && 'ring-1 ring-white/10')}>
                  <Icon className={cn('h-4 w-4', color)} />
                  <span className="text-[11px] font-medium text-slate-300">{label}</span>
                </button>
              ))}
            </div>
            {supportCategory && (
              <div className="rounded-xl border border-surface-400/30 bg-surface-200/30 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className={cn(
                    'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold border',
                    supportCategory === 'Bug Report'      && 'text-danger bg-danger/10 border-danger/20',
                    supportCategory === 'Feature Request' && 'text-brand-400 bg-brand-600/10 border-brand-500/20',
                    supportCategory === 'General Support' && 'text-blue-400 bg-blue-500/10 border-blue-500/20',
                  )}>
                    {supportCategory === 'Bug Report'      && <Bug className="h-3 w-3" />}
                    {supportCategory === 'Feature Request' && <Lightbulb className="h-3 w-3" />}
                    {supportCategory === 'General Support' && <MessageSquare className="h-3 w-3" />}
                    {supportCategory}
                  </span>
                  <button onClick={() => setSupportCategory(null)} className="text-slate-600 hover:text-slate-400 transition-colors">
                    <X className="h-4 w-4" />
                  </button>
                </div>
                {supportCategory === 'Bug Report' && (
                  <div className="rounded-lg bg-surface-300/40 border border-surface-400/20 px-3 py-2">
                    <p className="text-[11px] text-slate-500">Auto-included: your account, current page URL, browser info, and timestamp.</p>
                  </div>
                )}
                {supportMutation.isSuccess ? (
                  <div className="flex items-center gap-2 rounded-lg bg-success/10 border border-success/20 px-4 py-3">
                    <CheckCircle2 className="h-4 w-4 text-success shrink-0" />
                    <p className="text-sm text-success font-medium">Message sent — we will be in touch shortly.</p>
                  </div>
                ) : (
                  <>
                    <div>
                      <label className="text-[11px] font-medium text-slate-500 block mb-1.5">Subject</label>
                      <input type="text" value={supportSubject} onChange={e => setSupportSubject(e.target.value)}
                        placeholder={supportCategory === 'Bug Report' ? 'e.g. Dashboard not loading after login' : supportCategory === 'Feature Request' ? 'e.g. Export leases to CSV' : 'How can we help?'}
                        className="w-full rounded-lg border border-surface-400/50 bg-surface-200 px-3 py-2 text-sm text-white placeholder-slate-600 focus:border-brand-500 focus:outline-none" />
                    </div>
                    <div>
                      <label className="text-[11px] font-medium text-slate-500 block mb-1.5">Message</label>
                      <textarea rows={4} value={supportMessage} onChange={e => setSupportMessage(e.target.value)}
                        placeholder={supportCategory === 'Bug Report' ? 'Describe what happened and what you expected...' : supportCategory === 'Feature Request' ? 'Describe the feature and how it would help your workflow...' : 'Tell us what you need help with...'}
                        className="w-full rounded-lg border border-surface-400/50 bg-surface-200 px-3 py-2 text-sm text-white placeholder-slate-600 focus:border-brand-500 focus:outline-none resize-none" />
                    </div>
                    <div>
                      <label className="text-[11px] font-medium text-slate-500 block mb-1.5">Screenshot (optional)</label>
                      <input ref={screenshotInputRef} type="file" accept="image/*" className="hidden" onChange={handleScreenshotChange} />
                      <button type="button" onClick={() => screenshotInputRef.current?.click()}
                        className="flex items-center gap-2 rounded-lg border border-dashed border-surface-400/50 bg-surface-200/50 px-3 py-2 text-xs text-slate-500 hover:border-brand-500/50 hover:text-slate-400 transition-colors">
                        <Paperclip className="h-3.5 w-3.5" />
                        {supportScreenshotName || 'Attach a screenshot'}
                      </button>
                      {supportScreenshot && (
                        <button type="button" onClick={() => { setSupportScreenshot(null); setSupportScreenshotName(''); }}
                          className="mt-1 text-[11px] text-slate-600 hover:text-danger transition-colors">Remove</button>
                      )}
                    </div>
                    {supportMutation.isError && (
                      <p className="text-xs text-danger">{(supportMutation.error as Error)?.message ?? 'Failed to send. Please try again.'}</p>
                    )}
                    <div className="flex justify-end gap-2 pt-1">
                      <button onClick={() => setSupportCategory(null)} className="rounded-lg px-3 py-1.5 text-xs text-slate-500 hover:text-slate-300 transition-colors">Cancel</button>
                      <button onClick={() => supportMutation.mutate()}
                        disabled={supportMutation.isPending || !supportSubject.trim() || !supportMessage.trim()}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 hover:bg-brand-500 disabled:opacity-40 disabled:cursor-not-allowed px-4 py-1.5 text-xs font-semibold text-white transition-colors">
                        {supportMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
                        Send
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </CardBody>
        </Card>

        {/* Preferences + Portfolio Data — right 1/3 */}
        <div className="flex flex-col gap-4">

          {/* Preferences */}
          <Card>
            <CardHeader><CardTitle>Preferences</CardTitle></CardHeader>
            <CardBody className="flex flex-col gap-5">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface-300">
                    <Moon className="h-4 w-4 text-slate-400" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-300">Theme</p>
                    <p className="text-xs text-slate-500">Interface color scheme</p>
                  </div>
                </div>
                <span className="rounded-lg border border-surface-400/30 bg-surface-200/50 px-3 py-1.5 text-xs font-medium text-slate-400">Dark</span>
              </div>
              <div className="h-px bg-surface-400/30" />
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface-300">
                    <Bell className="h-4 w-4 text-slate-400" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-300">Alert bell</p>
                    <p className="text-xs text-slate-500">Min. severity shown</p>
                  </div>
                </div>
                <div className="flex rounded-lg border border-surface-400/30 bg-surface-200/30 p-0.5 shrink-0">
                  {(['all', 'warning', 'critical'] as AlertSeverityFilter[]).map((opt) => (
                    <button key={opt} onClick={() => setAlertSeverityFilter(opt)}
                      className={cn('rounded-md px-2.5 py-1 text-xs font-medium transition-colors capitalize',
                        alertSeverityFilter === opt && opt === 'all'      && 'bg-brand-600/30 text-brand-300 border border-brand-600/40',
                        alertSeverityFilter === opt && opt === 'warning'  && 'bg-danger/20 text-danger border border-danger/30',
                        alertSeverityFilter === opt && opt === 'critical' && 'bg-amber-500/20 text-amber-400 border border-amber-500/30',
                        alertSeverityFilter !== opt && 'text-slate-500 hover:text-slate-300',
                      )}>
                      {opt === 'all' ? 'All' : opt === 'warning' ? 'Warn+' : 'Crit'}
                    </button>
                  ))}
                </div>
              </div>
              <div className="h-px bg-surface-400/30" />
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface-300">
                    <Shield className="h-4 w-4 text-slate-400" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-300">Session</p>
                    <p className="text-xs text-slate-500">Stays signed in</p>
                  </div>
                </div>
                <span className="rounded-lg border border-surface-400/30 bg-surface-200/50 px-3 py-1.5 text-xs font-medium text-slate-400">30 days</span>
              </div>
            </CardBody>
          </Card>

          {/* Portfolio Data */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Trash2 className="h-4 w-4 text-danger" />
                <CardTitle>Portfolio Data</CardTitle>
              </div>
            </CardHeader>
            <CardBody>
              <p className="text-sm font-semibold text-white mb-1">Reset all portfolio data</p>
              <p className="text-xs text-slate-500 mb-4">Permanently deletes all properties, leases, tenants, financial records, alerts, and tasks. This cannot be undone.</p>
              {resetDone && <p className="text-xs text-success mb-3">Portfolio data cleared successfully.</p>}
              {!resetConfirm ? (
                <button onClick={() => setResetConfirm(true)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-danger/30 bg-danger/10 hover:bg-danger/20 px-3 py-1.5 text-xs font-semibold text-danger transition-colors">
                  <Trash2 className="h-3.5 w-3.5" /> Reset data
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400">Are you sure?</span>
                  <button onClick={resetPortfolio} disabled={resetLoading}
                    className="inline-flex items-center gap-1 rounded-lg bg-danger hover:bg-danger/80 px-3 py-1.5 text-xs font-semibold text-white transition-colors disabled:opacity-60">
                    {resetLoading && <Loader2 className="h-3 w-3 animate-spin" />} Confirm
                  </button>
                  <button onClick={() => setResetConfirm(false)} className="text-xs text-slate-500 hover:text-slate-300 transition-colors">Cancel</button>
                </div>
              )}
            </CardBody>
          </Card>

        </div>{/* /right col */}

      </div>{/* /bottom grid */}

    </div>
  );
}
