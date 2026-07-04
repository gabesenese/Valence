import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Zap, Database, ArrowRight } from 'lucide-react';
import { useAuthStore } from '@/state/auth.store';
import { Logo } from '@/components/ui/Logo';
import { demoService } from '@/services/demo.service';
import { eventService } from '@/services/event.service';
import { ActivationSequence } from './ActivationSequence';

type Mode = 'welcome' | 'activating';

const DEMO_STEPS = [
  'Loading sample portfolio',
  'Analyzing leases',
  'Finding revenue at risk',
  'Generating your work queue',
];

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

export default function SetupPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const qc = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const autoDemo = (location.state as { autoStart?: string } | null)?.autoStart === 'demo';
  const [mode, setMode] = useState<Mode>(autoDemo ? 'activating' : 'welcome');
  const [error, setError] = useState('');

  function exploreDemo() {
    setError('');
    setMode('activating');
  }

  function connectPortfolio() {
    navigate('/import');
  }

  if (mode === 'activating') {
    return (
      <ActivationSequence
        title="Setting up your portfolio…"
        steps={DEMO_STEPS}
        run={demoService.loadDemo}
        onComplete={(result, elapsedMs) => {
          eventService.track('setup_complete', { path: 'demo' });
          qc.invalidateQueries();
          navigate('/dashboard', {
            state: {
              activation: {
                seconds: Math.max(1, Math.round(elapsedMs / 1000)),
                properties: result.properties,
                leases: result.leases,
              },
            },
          });
        }}
        onError={() => {
          setError('That didn’t go through — please try again.');
          setMode('welcome');
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-surface-0 flex flex-col items-center justify-center px-4 py-16 animate-fade-in">
      <div className="flex items-center gap-2.5 mb-12">
        <Logo className="h-10 w-6" />
        <span className="text-lg font-bold text-fg tracking-tight">Valence</span>
      </div>

      <div className="text-center mb-10 max-w-lg">
        <h1 className="text-2xl font-bold text-fg tracking-tight">
          {getGreeting()}, {user?.firstName}.
        </h1>
        <p className="mt-2 text-slate-400">What would you like to do?</p>
      </div>

      {error && <p className="mb-6 text-xs text-danger text-center">{error}</p>}

      <div className="w-full max-w-lg grid gap-4 sm:grid-cols-2">
        <button
          onClick={exploreDemo}
          className="group flex flex-col gap-4 rounded-2xl border border-brand-500/40 bg-brand-600/5 p-6 text-left transition-all hover:border-brand-500/70 hover:bg-brand-600/10"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-600/20">
            <Zap className="h-5 w-5 text-brand-400" />
          </div>
          <div>
            <p className="text-sm font-semibold text-fg">Explore a sample portfolio</p>
            <p className="mt-1 text-xs leading-relaxed text-slate-500">
              See how Valence works in under two minutes.
            </p>
          </div>
          <div className="mt-auto flex items-center gap-1.5 text-xs font-medium text-brand-400 group-hover:text-brand-300 transition-colors">
            Show me <ArrowRight className="h-3.5 w-3.5" />
          </div>
        </button>

        <button
          onClick={connectPortfolio}
          className="group flex flex-col gap-4 rounded-2xl border border-surface-400/40 bg-surface-100 p-6 text-left transition-all hover:border-surface-500 hover:bg-surface-200/60"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface-300/60">
            <Database className="h-5 w-5 text-slate-400" />
          </div>
          <div>
            <p className="text-sm font-semibold text-fg">Connect my portfolio</p>
            <p className="mt-1 text-xs leading-relaxed text-slate-500">
              Import your real data and start analyzing it.
            </p>
          </div>
          <div className="mt-auto flex items-center gap-1.5 text-xs font-medium text-slate-400 group-hover:text-slate-300 transition-colors">
            Import data <ArrowRight className="h-3.5 w-3.5" />
          </div>
        </button>
      </div>
    </div>
  );
}
