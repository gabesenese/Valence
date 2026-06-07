import { useState } from 'react';
import { MailWarning, X, Loader2, CheckCircle2 } from 'lucide-react';
import { useAuthStore } from '@/state/auth.store';
import { authService } from '@/services/auth.service';

export function EmailVerificationBanner() {
  const user = useAuthStore((s) => s.user);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  if (!user || user.emailVerifiedAt || dismissed) return null;

  const handleResend = async () => {
    setSending(true);
    try {
      await authService.resendVerification();
      setSent(true);
    } catch {
      // silent — user can retry
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex items-center justify-between gap-4 border-b border-amber-500/20 bg-amber-500/10 px-6 py-2.5">
      <div className="flex items-center gap-2 text-xs text-amber-300">
        <MailWarning className="h-3.5 w-3.5 shrink-0" />
        {sent ? (
          <span className="flex items-center gap-1.5">
            <CheckCircle2 className="h-3.5 w-3.5 text-success" />
            <span className="text-success">Verification email sent — check your inbox.</span>
          </span>
        ) : (
          <>
            <span className="font-medium">Verify your email address</span>
            <span className="text-amber-400/70">to keep your account secure.</span>
            <button
              onClick={handleResend}
              disabled={sending}
              className="ml-1 inline-flex items-center gap-1 rounded-md border border-amber-500/30 bg-amber-500/20 hover:bg-amber-500/30 px-2 py-0.5 font-semibold transition-colors disabled:opacity-60"
            >
              {sending && <Loader2 className="h-3 w-3 animate-spin" />}
              Resend email
            </button>
          </>
        )}
      </div>
      <button onClick={() => setDismissed(true)} className="text-amber-500/60 hover:text-amber-300 transition-colors">
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
