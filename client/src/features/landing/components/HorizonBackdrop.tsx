import { cn } from '@/utils/cn';

const FADE_UP = 'linear-gradient(to top, rgba(0,0,0,1) 0%, rgba(0,0,0,0.55) 42%, rgba(0,0,0,0) 100%)';

/*
 * The hero backdrop is the product's mental model kept to a whisper: sparse marks
 * drifting toward a fixed "now" line. The marks are neutral rather than branded so
 * they stay atmosphere in both themes, and the accent is spent only on the line.
 */
export function HorizonBackdrop({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn('pointer-events-none absolute inset-x-0 overflow-hidden', className ?? 'inset-y-0')}
      style={{
        maskImage: 'linear-gradient(to right, transparent, black 12%, black 88%, transparent)',
        WebkitMaskImage: 'linear-gradient(to right, transparent, black 12%, black 88%, transparent)',
      }}
    >
      <div
        className="absolute left-1/2 top-[-18rem] h-[46rem] w-[76rem] -translate-x-1/2 rounded-full"
        style={{
          background:
            'radial-gradient(closest-side, rgb(var(--brand-400) / 0.20), rgb(var(--brand-400) / 0.06) 55%, transparent 100%)',
          filter: 'blur(30px)',
        }}
      />
      <div
        className="absolute right-[-14rem] top-[16rem] h-[28rem] w-[28rem] rounded-full"
        style={{
          background: 'radial-gradient(closest-side, rgb(var(--brand-600) / 0.16), transparent 100%)',
          filter: 'blur(40px)',
        }}
      />

      <div
        className="landing-horizon-major absolute bottom-0 left-0 h-[16rem] w-[calc(100%+240px)]"
        style={{
          backgroundImage:
            'repeating-linear-gradient(90deg, rgb(var(--fg) / 0.07) 0 1px, transparent 1px 120px)',
          maskImage: FADE_UP,
          WebkitMaskImage: FADE_UP,
        }}
      />

      <div
        className="landing-scanline absolute bottom-0 left-1/2 h-[26rem] w-px -translate-x-1/2"
        style={{
          background:
            'linear-gradient(to top, rgb(var(--brand-400) / 0.85), rgb(var(--brand-400) / 0.15) 55%, transparent)',
          boxShadow: '0 0 24px 2px rgb(var(--brand-400) / 0.35)',
        }}
      />

      <div className="absolute inset-x-0 bottom-0 h-px bg-surface-400" />
    </div>
  );
}
