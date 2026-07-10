import { useEffect, useRef, useState, useCallback } from 'react';
import { Check, Loader2, UploadCloud } from 'lucide-react';
import { compactCurrency } from '@/utils/format';
import { ActivationShell } from './ActivationShell';
import type { AnalysisResult, PortfolioAnalyzer } from './activation.types';

type Phase = 'awaiting' | 'running' | 'complete';

/* The one honest concession: a step shows for at least this long so a fast
 * response is still readable. Real work slower than this paces the step itself. */
const FLOOR_MS = 480;
const SETTLE_MS = 800;

export function AnalyzeConsole({
  mode,
  makeAnalyzer,
  onComplete,
  onError,
}: {
  mode: 'demo' | 'import';
  makeAnalyzer: (files?: File[]) => PortfolioAnalyzer;
  onComplete: (result: AnalysisResult) => void;
  onError: (err: unknown) => void;
}) {
  const [phase, setPhase] = useState<Phase>(mode === 'import' ? 'awaiting' : 'running');
  const [errored, setErrored] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [labels, setLabels] = useState<string[]>([]);
  const [values, setValues] = useState<string[]>([]);
  const [active, setActive] = useState(0);
  const [done, setDone] = useState(0);
  const [bars, setBars] = useState<number[]>([]);
  const [rent, setRent] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);
  const cbRef = useRef({ onComplete, onError });
  cbRef.current = { onComplete, onError };
  const startedRef = useRef(false);

  const animateBars = useCallback((rents: number[], annual: number) => {
    const list = (rents.length ? rents : [annual]).slice(0, 16);
    const max = Math.max(...list, 1);
    setBars([]);
    list.forEach((v, k) => setTimeout(() => setBars((b) => [...b, 24 + (v / max) * 34]), 70 * k));
    const t0 = performance.now();
    const tick = () => {
      const p = Math.min(1, (performance.now() - t0) / 900);
      setRent(Math.round(annual * (1 - Math.pow(1 - p, 3))));
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, []);

  const start = useCallback((files?: File[]) => {
    if (startedRef.current) return;
    startedRef.current = true;
    setPhase('running');
    setErrored(false);
    setErrorMsg(null);
    setActive(0); setDone(0); setBars([]); setRent(0); setValues([]);

    const analyzer = makeAnalyzer(files);
    setLabels(analyzer.steps.map((s) => s.label));
    const collected: string[] = [];

    (async () => {
      const wait = (ms: number) => new Promise((res) => setTimeout(res, ms));
      try {
        for (let i = 0; i < analyzer.steps.length; i++) {
          setActive(i);
          const [outcome] = await Promise.all([analyzer.steps[i].run(), wait(FLOOR_MS)]);
          collected[i] = outcome.value;
          setValues([...collected]);
          if (outcome.bars) animateBars(outcome.bars.rents, outcome.bars.annualRevenue);
          setDone(i + 1);
        }
        const result = analyzer.finalize();
        await wait(SETTLE_MS);
        setPhase('complete');
        cbRef.current.onComplete(result);
      } catch (e) {
        startedRef.current = false;
        setErrorMsg(e instanceof Error ? e.message : null);
        setErrored(true);
        cbRef.current.onError(e);
      }
    })();
  }, [makeAnalyzer, animateBars]);

  useEffect(() => {
    if (mode === 'demo') start();
  }, [mode, start]);

  const pickFiles = (files: FileList | null) => {
    if (!files || !files.length) return;
    start(Array.from(files));
  };

  const stepCount = labels.length || 4;
  const status = phase === 'awaiting' ? 'awaiting input' : phase === 'complete' ? 'analysis complete' : 'analyzing…';
  const statusTone = phase === 'complete' ? 'text-success' : phase === 'running' ? 'text-warning' : 'text-brand-400';

  return (
    <ActivationShell status={status} statusTone={statusTone} pulseLogo={phase === 'complete'}>
      {/* progress rail */}
      <div className="flex gap-1.5 px-8 pt-6">
        {Array.from({ length: stepCount }).map((_, i) => (
          <span key={i} className={`h-[3px] flex-1 rounded-full transition-colors duration-500 ${i < done ? 'bg-brand-500' : i === active && phase === 'running' ? 'bg-brand-500/40' : 'bg-white/[0.06]'}`} />
        ))}
      </div>

      <div className="px-9 pb-10 pt-7 min-h-[380px]">
        {phase === 'awaiting' ? (
          <div className="motion-safe:animate-fade-in">
            <p className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-slate-500/70 mb-4">Your leases</p>
            <h1 className="text-[32px] leading-[1.08] font-semibold tracking-[-0.025em] text-fg mb-3">Bring in your portfolio.</h1>
            <p className="text-[15px] text-slate-400/90 leading-relaxed mb-8 max-w-[46ch]">Drop a rent roll or a lease list — CSV or Excel. Add a properties file too if you have one. We read it the moment it lands.</p>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => { e.preventDefault(); setDragging(false); pickFiles(e.dataTransfer.files); }}
              className={`w-full rounded-2xl px-6 py-14 text-center transition-all duration-300 ${dragging ? 'bg-brand-600/10 ring-1 ring-brand-500/60' : 'bg-white/[0.02] ring-1 ring-white/[0.05] hover:bg-white/[0.035] hover:ring-white/10'}`}
            >
              <UploadCloud className="mx-auto h-7 w-7 text-slate-500 mb-3" strokeWidth={1.5} />
              <p className="text-sm font-medium text-fg">Drop your leases here</p>
              <p className="mt-1 text-xs text-slate-500">or click to choose a file</p>
            </button>
            <input ref={fileRef} type="file" accept=".csv,.tsv,.txt,.xlsx" multiple className="hidden" onChange={(e) => pickFiles(e.target.files)} />
          </div>
        ) : errored ? (
          <div className="motion-safe:animate-fade-in py-8">
            <p className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-danger mb-4">Analysis interrupted</p>
            <h1 className="text-[28px] leading-[1.1] font-semibold tracking-[-0.025em] text-fg mb-2">We couldn’t read your portfolio.</h1>
            <p className="text-[15px] text-slate-400/90 leading-relaxed mb-7 max-w-[44ch]">{errorMsg ?? 'The connection dropped or the request failed. Nothing was lost — try again.'}</p>
            <button
              type="button"
              onClick={() => { if (mode === 'import') { setErrored(false); setPhase('awaiting'); } else { start(); } }}
              className="rounded-xl bg-white px-5 py-3 text-sm font-semibold text-surface-0 transition-transform hover:-translate-y-0.5"
            >
              Try again
            </button>
          </div>
        ) : (
          <div className="motion-safe:animate-fade-in">
            <p className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-slate-500/70 mb-6">
              {phase === 'complete' ? 'Portfolio understood' : 'Building your portfolio intelligence'}
            </p>
            <div className="font-mono text-[13px]">
              {labels.map((label, i) => {
                const isDone = i < done;
                const isRunning = i === active && !isDone && phase === 'running';
                const shown = i <= active;
                return (
                  <div key={label} className={`flex items-center gap-4 py-3.5 transition-all duration-500 ${shown ? 'opacity-100' : 'opacity-20'} ${i === labels.length - 1 ? '' : 'border-b border-white/[0.04]'}`}>
                    <span className="w-4 shrink-0">
                      {isDone ? <Check className="h-4 w-4 text-success" strokeWidth={2} /> : isRunning ? <Loader2 className="h-3.5 w-3.5 animate-spin text-brand-400" /> : <span className="text-slate-600">◇</span>}
                    </span>
                    <span className="flex-1 text-slate-300">{label}</span>
                    <span className={`text-slate-400 transition-opacity duration-500 ${isDone && values[i] ? 'opacity-100' : 'opacity-0'}`}>{values[i] ?? ''}</span>
                  </div>
                );
              })}
            </div>

            {/* signature: the rent roll assembling as revenue counts up */}
            {bars.length > 0 && (
              <div className="mt-8 pt-6 border-t border-white/[0.05] motion-safe:animate-fade-in">
                <div className="flex items-end gap-1.5 h-14">
                  {bars.map((h, i) => (
                    <div key={i} className="flex-1 rounded-t bg-gradient-to-t from-brand-600/20 to-brand-500 transition-[height] duration-700 ease-out" style={{ height: `${h}px` }} />
                  ))}
                </div>
                <div className="mt-3.5 flex items-center justify-between font-mono text-[11.5px] text-slate-500">
                  <span>Rent roll assembled</span>
                  <span className="font-medium text-fg tabular-nums">{compactCurrency(rent)}/yr</span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </ActivationShell>
  );
}
