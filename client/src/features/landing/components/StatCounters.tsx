import { useEffect, useRef, useState } from 'react';
import { STATS } from '../landingContent';

const DURATION = 1400;

function easeOutExpo(t: number) {
  return t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
}

function useCountUp(target: number) {
  const ref = useRef<HTMLDivElement>(null);
  const [value, setValue] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setValue(target);
      return;
    }

    let frame = 0;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        observer.disconnect();
        const start = performance.now();
        const tick = (now: number) => {
          const progress = Math.min(1, (now - start) / DURATION);
          setValue(Math.round(target * easeOutExpo(progress)));
          if (progress < 1) frame = requestAnimationFrame(tick);
        };
        frame = requestAnimationFrame(tick);
      },
      { threshold: 0.4 },
    );

    observer.observe(el);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [target]);

  return { ref, value };
}

function Stat({ stat }: { stat: (typeof STATS)[number] }) {
  const { ref, value } = useCountUp(stat.value);

  return (
    <div
      ref={ref}
      className="border-t border-surface-400 px-1 pt-6 md:border-l md:border-t-0 md:px-8 md:pt-0 md:first:border-l-0 md:first:pl-0"
    >
      <p
        aria-hidden
        className="text-[clamp(2.5rem,4.5vw,3.5rem)] font-semibold leading-none tracking-[-0.03em] text-fg [font-variant-numeric:tabular-nums]"
      >
        {stat.display(value)}
      </p>
      <span className="sr-only">{stat.display(stat.value)}</span>
      <p className="mt-4 text-sm font-medium text-slate-300">{stat.label}</p>
      <p className="mt-1 font-mono text-[0.6875rem] uppercase tracking-[0.14em] text-slate-500">{stat.note}</p>
    </div>
  );
}

export function StatCounters() {
  return (
    <div className="grid gap-10 sm:grid-cols-2 md:grid-cols-4 md:gap-0">
      {STATS.map((s) => <Stat key={s.label} stat={s} />)}
    </div>
  );
}
