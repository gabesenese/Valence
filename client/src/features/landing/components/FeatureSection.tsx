import { ArrowRight, Loader2 } from 'lucide-react';
import { cn } from '@/utils/cn';
import type { Feature } from '../landingContent';
import { ProductFrame } from './ProductFrame';
import { Reveal } from './Reveal';

interface FeatureSectionProps {
  feature: Feature;
  flip: boolean;
  onOpenDemo: (path: string) => void;
  demoLoading: string | null;
  demoError: string | null;
}

export function FeatureSection({ feature, flip, onOpenDemo, demoLoading, demoError }: FeatureSectionProps) {
  const loading = demoLoading === feature.demoPath;

  return (
    <section
      id={feature.id}
      className={cn(
        'mx-auto grid max-w-[70rem] scroll-mt-24 items-center gap-12 px-6 py-24 md:gap-14 md:py-32',
        flip
          ? 'md:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]'
          : 'md:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]',
      )}
    >
      <Reveal className={cn('min-w-0', flip && 'md:order-2')}>
        <p className="landing-eyebrow text-brand-400">{feature.eyebrow}</p>
        <h2 className="landing-display-3 mt-4 text-fg">{feature.headline}</h2>
        <p className="landing-body mt-5 max-w-lg text-slate-400">{feature.body}</p>

        <ul className="mt-8 flex flex-col gap-3.5 border-t border-surface-400 pt-8">
          {feature.bullets.map((b) => (
            <li key={b} className="flex items-start gap-3">
              <span aria-hidden className="mt-[0.5625rem] h-px w-4 shrink-0 bg-brand-500" />
              <span className="text-[0.9375rem] leading-6 text-slate-300">{b}</span>
            </li>
          ))}
        </ul>

        <button
          type="button"
          onClick={() => onOpenDemo(feature.demoPath)}
          disabled={loading}
          className="group mt-8 inline-flex items-center gap-2 text-sm font-medium text-brand-400 transition-colors duration-200 hover:text-brand-300 disabled:opacity-60"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {feature.linkLabel}
          {!loading && (
            <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
          )}
        </button>

        {demoError && (
          <p role="alert" className="mt-4 max-w-sm text-sm leading-6 text-danger">{demoError}</p>
        )}
      </Reveal>

      <Reveal delay={80} className={cn('min-w-0', flip && 'md:order-1')}>
        <ProductFrame shot={feature.shot} alt={feature.alt} path={feature.demoPath} />
      </Reveal>
    </section>
  );
}
