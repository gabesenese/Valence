import { Sparkles, X } from 'lucide-react';

export function ActivationArrival({ seconds, actions, onDismiss }: { seconds: number; actions?: number; onDismiss: () => void }) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-brand-500/30 bg-brand-600/10 px-5 py-4 animate-fade-in">
      <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-brand-600/20">
        <Sparkles className="h-4 w-4 text-brand-400" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-fg">Here’s what Valence found</p>
        <p className="mt-0.5 text-sm text-slate-300 leading-relaxed">
          {actions && actions > 0 ? (
            <>
              Your portfolio is analyzed —{' '}
              <span className="font-semibold text-fg">{actions} action{actions !== 1 ? 's' : ''}</span>{' '}
              need{actions === 1 ? 's' : ''} your attention below.
            </>
          ) : (
            <>Your portfolio is analyzed — here’s what needs your attention below.</>
          )}{' '}
          <span className="text-slate-500">Analyzed in {seconds}s.</span>
        </p>
      </div>
      <button
        type="button"
        onClick={onDismiss}
        className="shrink-0 rounded-md p-1 text-slate-500 transition-colors hover:text-slate-300"
        aria-label="Dismiss"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
