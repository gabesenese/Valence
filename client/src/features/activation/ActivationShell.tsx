import type { ReactNode } from 'react';
import { Logo } from '@/components/ui/Logo';

/*
 * The luxury surface every activation screen shares: a near-black radial field
 * with a single card floating on elevation — no borders, just a soft ring, a
 * deep shadow, and a 1px top highlight. Scoped `dark` so the flow stays the
 * premium console even if the product's default theme is light.
 */
export function ActivationShell({
  status,
  statusTone = 'text-brand-400',
  pulseLogo = false,
  children,
}: {
  status: string;
  statusTone?: string;
  pulseLogo?: boolean;
  children: ReactNode;
}) {
  return (
    <div
      className="dark min-h-screen w-full flex items-center justify-center px-5 py-12"
      style={{ background: 'radial-gradient(130% 95% at 50% -12%, #17172c 0%, #0c0c14 46%, #09090b 100%)' }}
    >
      <div className="relative w-full max-w-[600px] overflow-hidden rounded-[24px] bg-surface-100/95 backdrop-blur-xl ring-1 ring-white/[0.06] shadow-[0_40px_120px_-28px_rgba(0,0,0,0.9)] motion-safe:animate-rise-in">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent" />
        <div className="flex items-center gap-2.5 px-8 pt-6">
          <Logo className={`h-6 w-4 ${pulseLogo ? 'motion-safe:animate-logo-pulse' : ''}`} />
          <span className="text-[13px] font-semibold text-fg tracking-tight">Valence</span>
          <span className="ml-auto font-mono text-[10.5px] tracking-wide text-slate-500">
            system · <span className={statusTone}>{status}</span>
          </span>
        </div>
        {children}
      </div>
    </div>
  );
}
