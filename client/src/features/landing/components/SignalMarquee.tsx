import { SIGNALS } from '../landingContent';

function Row({ hidden = false }: { hidden?: boolean }) {
  return (
    <ul aria-hidden={hidden || undefined} className="flex shrink-0 items-center">
      {SIGNALS.map((s) => (
        <li key={s.label} className="flex shrink-0 items-center">
          <span className="flex items-center gap-2.5 px-8">
            <s.icon className="h-4 w-4 text-slate-600" />
            <span className="font-mono text-xs uppercase tracking-[0.16em] text-slate-500">{s.label}</span>
          </span>
          <span className="h-4 w-px bg-surface-400" />
        </li>
      ))}
    </ul>
  );
}

export function SignalMarquee() {
  return (
    <div
      className="overflow-hidden py-1"
      style={{
        maskImage: 'linear-gradient(to right, transparent, black 8%, black 92%, transparent)',
        WebkitMaskImage: 'linear-gradient(to right, transparent, black 8%, black 92%, transparent)',
      }}
    >
      <div className="landing-marquee-track flex w-max hover:[animation-play-state:paused]">
        <Row />
        <Row hidden />
      </div>
    </div>
  );
}
