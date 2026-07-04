import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { RefreshCw, ArrowRight, CornerDownLeft, Loader2, AlertTriangle, Sparkles, CheckCircle2 } from 'lucide-react';
import { WorkspaceShell } from '@/components/ui/WorkspaceShell';
import { copilotService, type CopilotResponse, type CopilotObservation, type ObservationSeverity } from '@/services/copilot.service';

type Mode = 'analysis' | 'observations' | 'ask';

const HEADINGS: Record<Mode, { title: string; subtitle: string; tab: string }> = {
  analysis: { title: 'Portfolio analysis', subtitle: 'Why your numbers look the way they do', tab: 'Analysis' },
  observations: { title: 'Patterns worth noticing', subtitle: 'Cross-tab signals no single view surfaces', tab: 'Patterns' },
  ask: { title: 'Ask Valence', subtitle: 'Answers drawn only from your Finance data', tab: 'Ask' },
};

const SUGGESTIONS = [
  'Why is that the top priority?',
  'How is my health trending?',
  'Where am I over budget?',
];

function friendlyError(message: string): string {
  if (!message || /status code \d+|network error|timeout/i.test(message)) {
    return "That didn't go through — the Copilot had a brief hiccup. Try again in a moment.";
  }
  return message;
}

function Sources({ items }: { items: CopilotResponse['evidence'] }) {
  const [open, setOpen] = useState(false);
  if (!items.length) return null;
  return (
    <div>
      <button
        onClick={() => setOpen((o) => !o)}
        className="text-[11px] font-medium text-slate-500 transition-colors hover:text-slate-300"
      >
        {open ? 'Hide sources' : `Sources · ${items.length} figure${items.length === 1 ? '' : 's'}`}
      </button>
      {open && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {items.map((e) => (
            <span
              key={e.factId}
              title={`${e.source}${e.confidence !== 'HIGH' ? ` · ${e.confidence.toLowerCase()} confidence` : ''}`}
              className="inline-flex items-center gap-1 rounded-md border border-surface-400/40 bg-surface-200/50 px-2 py-0.5 text-[10px] font-medium text-slate-400"
            >
              <span className="text-slate-500">{e.label}</span>
              <span className="text-slate-300">{e.value}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function ActionList({ items, label, onNavigate }: { items: CopilotResponse['actions']; label: string; onNavigate: (to: string) => void }) {
  if (!items.length) return null;
  return (
    <div>
      <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wider text-slate-500">{label}</p>
      <div className="flex flex-col gap-1">
        {items.map((a) => (
          <button
            key={a.deepLink + a.label}
            onClick={() => onNavigate(a.deepLink)}
            className="group flex items-center justify-between gap-2 rounded-lg border border-surface-400/50 bg-surface-100 px-3 py-2 text-left transition-colors hover:border-brand-600/40"
          >
            <span className="truncate text-xs font-medium text-slate-300 group-hover:text-brand-200">{a.label}</span>
            <ArrowRight className="h-3.5 w-3.5 shrink-0 text-slate-500 transition-colors group-hover:text-brand-300" />
          </button>
        ))}
      </div>
    </div>
  );
}

export function CopilotWorkspace({ open, onClose, initialMode }: { open: boolean; onClose: () => void; initialMode: Mode }) {
  const navigate = useNavigate();
  const [tab, setTab] = useState<Mode>(initialMode);

  useEffect(() => {
    if (open) setTab(initialMode);
  }, [open, initialMode]);

  return (
    <WorkspaceShell
      open={open}
      onClose={onClose}
      eyebrow="Valence Copilot"
      title={HEADINGS[tab].title}
      subtitle={HEADINGS[tab].subtitle}
    >
      <div className="flex gap-1 rounded-lg border border-surface-400/40 bg-surface-200/40 p-0.5">
        {(['analysis', 'observations', 'ask'] as Mode[]).map((m) => (
          <button
            key={m}
            onClick={() => setTab(m)}
            className={`flex-1 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
              tab === m ? 'bg-surface-0 text-fg shadow-sm' : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            {HEADINGS[m].tab}
          </button>
        ))}
      </div>

      {tab === 'analysis' && <AnalysisView onNavigate={(to) => { onClose(); navigate(to); }} />}
      {tab === 'observations' && <ObservationsView onNavigate={(to) => { onClose(); navigate(to); }} />}
      {tab === 'ask' && <AskView onNavigate={(to) => { onClose(); navigate(to); }} />}
    </WorkspaceShell>
  );
}

function AnalysisView({ onNavigate }: { onNavigate: (to: string) => void }) {
  const brief = useQuery({
    queryKey: ['copilot', 'brief'],
    queryFn: copilotService.getBrief,
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    retry: 1,
  });

  if (brief.isLoading) {
    return (
      <div className="space-y-2 animate-pulse">
        <div className="h-3.5 w-11/12 rounded bg-surface-400/40" />
        <div className="h-3.5 w-full rounded bg-surface-400/30" />
        <div className="h-3.5 w-3/4 rounded bg-surface-400/30" />
      </div>
    );
  }

  if (brief.error) {
    return (
      <div className="flex items-start gap-2 text-sm text-slate-400">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
        <span>Couldn't generate an analysis. <button onClick={() => brief.refetch()} className="text-brand-400 hover:text-brand-300">Try again</button></span>
      </div>
    );
  }

  if (!brief.data) return null;

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm leading-relaxed text-slate-200">{brief.data.answer}</p>
      <ActionList items={brief.data.actions} label="Where to act" onNavigate={onNavigate} />
      <Sources items={brief.data.evidence} />
      <div className="flex items-center justify-between border-t border-surface-400/30 pt-3">
        <p className="text-[10px] text-slate-600">
          {brief.data.degraded ? 'Deterministic read — every figure computed by Valence.' : 'Explains figures computed by Valence.'}
        </p>
        <button
          onClick={() => brief.refetch()}
          disabled={brief.isFetching}
          className="flex items-center gap-1 text-[11px] text-slate-500 transition-colors hover:text-slate-300 disabled:opacity-40"
        >
          <RefreshCw className={`h-3 w-3 ${brief.isFetching ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>
    </div>
  );
}

const SEVERITY: Record<ObservationSeverity, { dot: string; label: string; text: string }> = {
  HIGH: { dot: 'bg-danger', label: 'High', text: 'text-danger' },
  MEDIUM: { dot: 'bg-warning', label: 'Medium', text: 'text-warning' },
  LOW: { dot: 'bg-info', label: 'Low', text: 'text-info' },
  INFO: { dot: 'bg-slate-500', label: 'Note', text: 'text-slate-400' },
};

function ObservationCard({ obs, onNavigate }: { obs: CopilotObservation; onNavigate: (to: string) => void }) {
  const sev = SEVERITY[obs.severity];
  return (
    <div className="flex flex-col gap-2.5 rounded-xl border border-surface-400/50 bg-surface-100 p-4">
      <div className="flex items-center gap-2">
        <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${sev.dot}`} />
        <h4 className="flex-1 text-sm font-semibold text-fg">{obs.title}</h4>
        <span className={`text-[10px] font-semibold uppercase tracking-wider ${sev.text}`}>{sev.label}</span>
      </div>
      <p className="text-[13px] leading-relaxed text-slate-300">{obs.detail}</p>
      <Sources items={obs.evidence} />
      {obs.action && (
        <button
          onClick={() => onNavigate(obs.action!.deepLink)}
          className="group mt-0.5 inline-flex w-fit items-center gap-1.5 text-xs font-medium text-brand-400 transition-colors hover:text-brand-300"
        >
          {obs.action.label}
          <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
        </button>
      )}
    </div>
  );
}

function ObservationsView({ onNavigate }: { onNavigate: (to: string) => void }) {
  const obs = useQuery({
    queryKey: ['copilot', 'observations'],
    queryFn: copilotService.getObservations,
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    retry: 1,
  });

  if (obs.isLoading) {
    return (
      <div className="space-y-3">
        {[0, 1].map((i) => (
          <div key={i} className="animate-pulse space-y-2 rounded-xl border border-surface-400/40 bg-surface-100 p-4">
            <div className="h-3.5 w-2/3 rounded bg-surface-400/40" />
            <div className="h-3 w-full rounded bg-surface-400/30" />
            <div className="h-3 w-4/5 rounded bg-surface-400/30" />
          </div>
        ))}
      </div>
    );
  }

  if (obs.error) {
    return (
      <div className="flex items-start gap-2 text-sm text-slate-400">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
        <span>Couldn't scan for patterns. <button onClick={() => obs.refetch()} className="text-brand-400 hover:text-brand-300">Try again</button></span>
      </div>
    );
  }

  const items = obs.data?.observations ?? [];

  if (!items.length) {
    return (
      <div className="flex flex-col items-center gap-2 py-8 text-center">
        <CheckCircle2 className="h-6 w-6 text-success" />
        <p className="text-sm font-medium text-slate-300">Nothing stands out</p>
        <p className="max-w-xs text-xs text-slate-500">No cross-tab risks right now — revenue, expenses, renewals, and your rent roll are all in balance.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {items.map((o) => <ObservationCard key={o.id} obs={o} onNavigate={onNavigate} />)}
      <p className="pt-1 text-[10px] text-slate-600">Patterns computed by Valence across your Finance tabs — every figure is real.</p>
    </div>
  );
}

function AskView({ onNavigate }: { onNavigate: (to: string) => void }) {
  const [question, setQuestion] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const ask = useMutation<CopilotResponse, Error, string>({ mutationFn: copilotService.ask });

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  function submit(q: string) {
    const trimmed = q.trim();
    if (!trimmed || ask.isPending) return;
    setQuestion(trimmed);
    ask.mutate(trimmed);
  }

  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={(e) => { e.preventDefault(); submit(question); }} className="flex items-center gap-2">
        <input
          ref={inputRef}
          value={question}
          onChange={(e) => { setQuestion(e.target.value); if (ask.data || ask.error) ask.reset(); }}
          maxLength={500}
          placeholder="Ask about your Finance data…"
          className="flex-1 rounded-xl border border-surface-400/50 bg-surface-0 px-3.5 py-2 text-sm text-fg placeholder:text-slate-600 focus:border-brand-500/50 focus:outline-none"
        />
        <button
          type="submit"
          disabled={!question.trim() || ask.isPending}
          className="inline-flex items-center justify-center rounded-xl bg-brand-600 px-3 py-2 text-white transition-colors hover:bg-brand-500 disabled:opacity-50"
        >
          {ask.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CornerDownLeft className="h-4 w-4" />}
        </button>
      </form>

      {!ask.data && !ask.error && !ask.isPending && (
        <div className="flex flex-col gap-2">
          <p className="text-[11px] font-medium uppercase tracking-wider text-slate-500">Try asking</p>
          <div className="flex flex-col gap-1.5">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                onClick={() => submit(s)}
                className="group flex items-center gap-2 rounded-lg border border-surface-400/40 bg-surface-100 px-3 py-2 text-left text-xs text-slate-400 transition-colors hover:border-brand-600/40 hover:text-brand-200"
              >
                <Sparkles className="h-3 w-3 shrink-0 text-brand-400/70" />
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {ask.error && (
        <div className="flex items-start gap-2 text-sm text-slate-400">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
          <span>
            {friendlyError(ask.error.message)}{' '}
            <button onClick={() => submit(question)} className="font-medium text-brand-400 hover:text-brand-300">Try again</button>
          </span>
        </div>
      )}

      {ask.data && (
        <div className="flex flex-col gap-4 border-t border-surface-400/30 pt-4">
          <p className="text-sm leading-relaxed text-slate-200">{ask.data.answer}</p>
          <ActionList items={ask.data.actions} label="Where to act" onNavigate={onNavigate} />
          <Sources items={ask.data.evidence} />
        </div>
      )}
    </div>
  );
}
