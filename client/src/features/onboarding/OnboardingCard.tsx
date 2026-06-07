import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, Circle, ChevronRight, X } from 'lucide-react';
import { onboardingService } from '@/services/onboarding.service';
import { Card, CardBody } from '@/components/ui/Card';

const DISMISS_KEY = 'valence-onboarding-dismissed';

export function OnboardingCard() {
  const navigate = useNavigate();
  const [dismissed, setDismissed] = useState(() => localStorage.getItem(DISMISS_KEY) === '1');

  const { data } = useQuery({
    queryKey: ['onboarding', 'progress'],
    queryFn: onboardingService.getProgress,
    staleTime: 30_000,
  });

  if (dismissed || !data || data.allDone) return null;

  return (
    <Card>
      <CardBody className="p-5">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold text-white">Portfolio Setup</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              {data.completed} of {data.total} steps complete · {data.percent}%
            </p>
          </div>
          <button
            onClick={() => { localStorage.setItem(DISMISS_KEY, '1'); setDismissed(true); }}
            className="text-slate-600 hover:text-slate-400 transition-colors mt-0.5"
            title="Dismiss"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Progress bar */}
        <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-surface-400/40 mb-5">
          <div
            className="absolute inset-y-0 left-0 rounded-full bg-brand-500 transition-all duration-700"
            style={{ width: `${data.percent}%` }}
          />
        </div>

        {/* Milestones */}
        <div className="flex flex-col gap-1">
          {data.milestones.map((m) => (
            <div
              key={m.id}
              role={!m.done && m.href ? 'button' : undefined}
              tabIndex={!m.done && m.href ? 0 : undefined}
              onClick={() => !m.done && m.href && navigate(m.href)}
              onKeyDown={(e) => e.key === 'Enter' && !m.done && m.href && navigate(m.href)}
              className={[
                'flex items-center gap-3 rounded-lg px-3 py-2 transition-colors',
                !m.done && m.href ? 'cursor-pointer hover:bg-surface-200/60 group' : '',
                m.done ? 'opacity-55' : '',
              ].join(' ')}
            >
              {m.done
                ? <CheckCircle2 className="h-4 w-4 shrink-0 text-success" />
                : <Circle className="h-4 w-4 shrink-0 text-slate-600" />
              }
              <div className="flex-1 min-w-0">
                <p className={`text-xs font-medium leading-snug ${m.done ? 'line-through text-slate-500' : 'text-slate-200'}`}>
                  {m.label}
                </p>
                {!m.done && (
                  <p className="text-[11px] text-slate-600 mt-0.5 leading-snug">{m.description}</p>
                )}
              </div>
              {!m.done && m.cta && (
                <span className="shrink-0 flex items-center gap-0.5 text-[11px] font-semibold text-brand-400 group-hover:text-brand-300 transition-colors">
                  {m.cta}
                  <ChevronRight className="h-3 w-3" />
                </span>
              )}
            </div>
          ))}
        </div>
      </CardBody>
    </Card>
  );
}
