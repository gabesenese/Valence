import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Zap, Database, ArrowRight } from 'lucide-react';
import { useAuthStore } from '@/state/auth.store';
import { eventService } from '@/services/event.service';
import { AnalyzeConsole } from './AnalyzeConsole';
import { InsightScreen } from './InsightScreen';
import { ActivationShell } from './ActivationShell';
import { createDemoAnalyzer, createImportAnalyzer, createPortfolioAnalyzer } from './activation.service';
import type { AnalysisResult, PortfolioAnalyzer } from './activation.types';

type Choice = 'choose' | 'demo' | 'import';

function Chooser({ first, onDemo, onImport }: { first?: string; onDemo: () => void; onImport: () => void }) {
  return (
    <ActivationShell status="ready">
      <div className="px-9 pb-10 pt-8">
        <p className="font-mono text-[10.5px] uppercase tracking-[0.22em] text-slate-500/70 mb-4">Let’s begin</p>
        <h1 className="text-[32px] leading-[1.08] font-semibold tracking-[-0.025em] text-fg mb-3">
          {first ? `Welcome, ${first}.` : 'Welcome to Valence.'}
        </h1>
        <p className="text-[15px] text-slate-400/90 leading-relaxed mb-8 max-w-[46ch]">
          In under a minute, Valence will read a portfolio and show you the one thing worth your attention today.
        </p>

        <div className="grid gap-3.5">
          <button
            type="button"
            onClick={onImport}
            className="group flex items-center gap-4 rounded-2xl bg-white/[0.03] p-5 text-left ring-1 ring-white/[0.06] transition-all hover:bg-white/[0.05] hover:ring-white/10"
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-600/15">
              <Database className="h-5 w-5 text-brand-400" strokeWidth={1.75} />
            </span>
            <span className="flex-1">
              <span className="block text-[15px] font-semibold text-fg">Bring in my portfolio</span>
              <span className="block text-[13px] text-slate-500">Drop a rent roll or lease list — one file is enough.</span>
            </span>
            <ArrowRight className="h-4 w-4 text-slate-600 transition-transform group-hover:translate-x-0.5 group-hover:text-slate-300" />
          </button>

          <button
            type="button"
            onClick={onDemo}
            className="group flex items-center gap-4 rounded-2xl bg-white/[0.02] p-5 text-left ring-1 ring-white/[0.05] transition-all hover:bg-white/[0.035] hover:ring-white/10"
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-surface-300/50">
              <Zap className="h-5 w-5 text-slate-400" strokeWidth={1.75} />
            </span>
            <span className="flex-1">
              <span className="block text-[15px] font-semibold text-fg">Explore a sample portfolio</span>
              <span className="block text-[13px] text-slate-500">See how it works with realistic demo data first.</span>
            </span>
            <ArrowRight className="h-4 w-4 text-slate-600 transition-transform group-hover:translate-x-0.5 group-hover:text-slate-300" />
          </button>
        </div>
      </div>
    </ActivationShell>
  );
}

export default function ActivationPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const first = useAuthStore((s) => s.user?.firstName?.trim());
  const [choice, setChoice] = useState<Choice>('choose');
  const [result, setResult] = useState<AnalysisResult | null>(null);

  const finish = (path: string) => {
    qc.invalidateQueries();
    navigate(path);
  };

  if (result) {
    return <InsightScreen result={result} onNavigate={finish} />;
  }

  if (choice === 'choose') {
    return <Chooser first={first} onDemo={() => setChoice('demo')} onImport={() => setChoice('import')} />;
  }

  const makeAnalyzer = (files?: File[]): PortfolioAnalyzer =>
    choice === 'demo'
      ? createDemoAnalyzer()
      : files && files.length
      ? createImportAnalyzer(files)
      : createPortfolioAnalyzer();

  return (
    <AnalyzeConsole
      mode={choice === 'demo' ? 'demo' : 'import'}
      makeAnalyzer={makeAnalyzer}
      onComplete={(r) => {
        eventService.track('setup_complete', { path: choice });
        setResult(r);
      }}
      onError={() => { /* AnalyzeConsole shows an inline retry; nothing to do here */ }}
    />
  );
}
