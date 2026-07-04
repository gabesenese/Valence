import { useEffect, useRef, useState } from 'react';
import { Check, Loader2 } from 'lucide-react';
import { Logo } from '@/components/ui/Logo';

const STEP_CADENCE_MS = 750;
const SETTLE_MS = 900;

export function ActivationSequence<T>({
  title,
  steps,
  run,
  onComplete,
  onError,
}: {
  title: string;
  steps: string[];
  run: () => Promise<T>;
  onComplete: (result: T, elapsedMs: number) => void;
  onError: (err: unknown) => void;
}) {
  const [revealed, setRevealed] = useState(1);
  const [finished, setFinished] = useState(false);

  const runRef = useRef(run);
  const onCompleteRef = useRef(onComplete);
  const onErrorRef = useRef(onError);
  runRef.current = run;
  onCompleteRef.current = onComplete;
  onErrorRef.current = onError;
  const workRef = useRef<Promise<T> | null>(null);
  const startRef = useRef<number | null>(null);

  useEffect(() => {
    if (!workRef.current) {
      startRef.current = performance.now();
      workRef.current = runRef.current();
    }

    let cancelled = false;
    let step = 1;
    const interval = setInterval(() => {
      step += 1;
      setRevealed((r) => Math.min(steps.length, Math.max(r, step)));
      if (step >= steps.length) clearInterval(interval);
    }, STEP_CADENCE_MS);

    const minVisible = new Promise<void>((res) => setTimeout(res, steps.length * STEP_CADENCE_MS));

    Promise.allSettled([workRef.current, minVisible]).then((results) => {
      if (cancelled) return;
      clearInterval(interval);
      const outcome = results[0];
      if (outcome.status === 'rejected') {
        onErrorRef.current(outcome.reason);
        return;
      }
      setRevealed(steps.length);
      setFinished(true);
      const elapsed = performance.now() - (startRef.current ?? performance.now());
      setTimeout(() => {
        if (!cancelled) onCompleteRef.current((outcome as PromiseFulfilledResult<T>).value, elapsed);
      }, SETTLE_MS);
    });

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [steps]);

  return (
    <div className="min-h-screen bg-surface-0 flex flex-col items-center justify-center px-4 animate-fade-in">
      <div className="flex items-center gap-2.5 mb-10">
        <Logo className="h-9 w-5" />
        <span className="text-lg font-bold text-fg tracking-tight">Valence</span>
      </div>

      <div className="w-full max-w-sm">
        <h1 className="mb-8 text-center text-lg font-semibold text-fg tracking-tight">
          {finished ? 'Taking you to your first insights…' : title}
        </h1>

        <div className="flex flex-col gap-3">
          {steps.slice(0, revealed).map((label, i) => {
            const done = finished || i < revealed - 1;
            return (
              <div key={label} className="flex items-center gap-3 animate-fade-in">
                <span
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full transition-colors ${
                    done ? 'bg-success/15 text-success' : 'text-brand-400'
                  }`}
                >
                  {done ? <Check className="h-3.5 w-3.5" /> : <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                </span>
                <span className={`text-sm transition-colors ${done ? 'text-slate-300' : 'text-fg'}`}>{label}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
