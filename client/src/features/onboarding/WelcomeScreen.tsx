import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Building2, FileText, TrendingUp, AlertTriangle, Loader2, Play, Upload } from 'lucide-react';
import { demoService } from '@/services/demo.service';

const HIGHLIGHTS = [
  { icon: Building2,     label: 'Portfolio Health',  description: 'Real-time risk scoring'        },
  { icon: FileText,      label: 'Lease Intelligence', description: 'Renewal tracking & alerts'     },
  { icon: TrendingUp,    label: 'Revenue Analytics',  description: 'Financial performance insights' },
  { icon: AlertTriangle, label: 'Proactive Alerts',   description: 'Never miss a critical event'   },
] as const;

export function WelcomeScreen() {
  const navigate = useNavigate();
  const qc = useQueryClient();

  const load = useMutation({
    mutationFn: demoService.loadDemo,
    onSuccess: () => void qc.invalidateQueries(),
  });

  return (
    <div className="flex flex-col items-center justify-center min-h-[62vh] px-6 py-12 text-center animate-fade-in">
      <div className="mb-8">
        <h2 className="text-3xl font-bold tracking-tight text-fg">Welcome to Valence</h2>
        <p className="mt-2 text-slate-400">Your portfolio intelligence platform. See everything, miss nothing.</p>
      </div>

      <div className="mb-10 grid grid-cols-2 gap-3 sm:grid-cols-4 w-full max-w-2xl">
        {HIGHLIGHTS.map(({ icon: Icon, label, description }) => (
          <div
            key={label}
            className="flex flex-col items-center gap-2 rounded-xl border border-surface-400/30 bg-surface-200/40 px-3 py-4"
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600/20">
              <Icon className="h-4 w-4 text-brand-400" />
            </div>
            <p className="text-xs font-semibold text-slate-200">{label}</p>
            <p className="text-[11px] text-slate-500 leading-snug">{description}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row items-center gap-3">
        <button
          onClick={() => load.mutate()}
          disabled={load.isPending}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-brand-600 hover:bg-brand-500 disabled:opacity-50 px-7 py-3 text-sm font-semibold text-white transition-colors min-w-[210px]"
        >
          {load.isPending
            ? <><Loader2 className="h-4 w-4 animate-spin" /> Loading demo…</>
            : <><Play className="h-4 w-4" /> Load Demo Portfolio</>}
        </button>
        <button
          onClick={() => navigate('/import')}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-surface-400/40 bg-surface-200/50 hover:bg-surface-200 px-7 py-3 text-sm font-semibold text-slate-300 transition-colors min-w-[210px]"
        >
          <Upload className="h-4 w-4" />
          Import My Data
        </button>
      </div>

      {load.isError && (
        <p className="mt-4 text-xs text-danger">Failed to load demo portfolio. Please try again.</p>
      )}

      <p className="mt-6 text-xs text-slate-600">
        Demo data can be reset at any time · 3 properties · 15 leases · 10 tenants
      </p>
    </div>
  );
}
