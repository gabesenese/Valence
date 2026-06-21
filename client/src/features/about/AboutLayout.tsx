import { useEffect } from 'react';
import { PublicHeader } from '@/components/public/PublicHeader';
import { PublicFooter } from '@/components/public/PublicFooter';

interface AboutLayoutProps {
  eyebrow: string;
  title: string;
  intro: string;
  updated?: string;
  children: React.ReactNode;
}

export function AboutLayout({ eyebrow, title, intro, updated, children }: AboutLayoutProps) {
  useEffect(() => { window.scrollTo(0, 0); }, []);

  return (
    <div className="min-h-screen bg-surface-0 text-fg">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-48 left-1/2 h-[600px] w-[600px] -translate-x-1/2 rounded-full bg-brand-600/8 blur-[120px]" />
      </div>

      <PublicHeader />

      <section className="relative z-10 mx-auto max-w-3xl px-6 pt-16 pb-10">
        <p className="text-xs font-semibold uppercase tracking-widest text-brand-400 mb-3">{eyebrow}</p>
        <h1 className="text-4xl font-bold tracking-tight text-fg md:text-5xl">{title}</h1>
        <p className="mt-5 text-lg leading-relaxed text-slate-400">{intro}</p>
        {updated && <p className="mt-4 text-xs text-slate-600">Last updated {updated}</p>}
      </section>

      <section className="relative z-10 mx-auto max-w-3xl px-6 pb-20">
        <div className="flex flex-col gap-10">{children}</div>
      </section>

      <PublicFooter />
    </div>
  );
}

export function Section({ heading, children }: { heading: string; children: React.ReactNode }) {
  return (
    <div>
      <h2 className="text-lg font-semibold text-fg">{heading}</h2>
      <div className="mt-3 flex flex-col gap-3 text-sm leading-relaxed text-slate-400">{children}</div>
    </div>
  );
}
