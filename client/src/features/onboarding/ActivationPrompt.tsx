import { Link } from 'react-router-dom';
import { AlertTriangle, ArrowRight } from 'lucide-react';

export function ActivationPrompt({ hasProperties, hasLeases }: { hasProperties: boolean; hasLeases: boolean }) {
  if (hasLeases) return null;

  const prompt = hasProperties
    ? {
        title: 'Complete your portfolio',
        body: 'Import your leases to unlock renewal forecasting and revenue-at-risk.',
        cta: 'Import leases',
      }
    : {
        title: 'Add your portfolio',
        body: 'Import properties and leases to start analyzing your portfolio.',
        cta: 'Import data',
      };

  return (
    <Link
      to="/import"
      className="group flex items-center gap-3 rounded-xl border border-warning/30 bg-warning/5 px-4 py-3 transition-colors hover:bg-warning/10"
    >
      <AlertTriangle className="h-4 w-4 shrink-0 text-warning" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-fg">{prompt.title}</p>
        <p className="text-xs text-slate-400">{prompt.body}</p>
      </div>
      <span className="flex shrink-0 items-center gap-1 text-xs font-medium text-warning">
        {prompt.cta}
        <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
      </span>
    </Link>
  );
}
