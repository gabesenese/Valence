import { AlertTriangle, CheckCircle2, Check, ChevronRight } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardBody } from '@/components/ui/Card';

export type WorkItemTone = 'danger' | 'warning' | 'info';

export interface WorkItem {
  key: string;
  tone: WorkItemTone;
  title: string;
  detail: string;
  action: string;
  onClick: () => void;
}

const TONE_DOT: Record<WorkItemTone, string> = {
  danger: 'bg-danger',
  warning: 'bg-warning',
  info: 'bg-brand-500',
};

interface TodaysWorkProps {
  items: WorkItem[];
  title?: string;
  emptyTitle?: string;
  emptyMessage?: string;
}

export function TodaysWork({
  items,
  title = "Today's Work",
  emptyTitle = 'Everything looks good',
  emptyMessage = 'Nothing needs your attention right now.',
}: TodaysWorkProps) {
  if (items.length === 0) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-success" />
            <CardTitle>{title}</CardTitle>
          </div>
        </CardHeader>
        <CardBody className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-success/20 bg-success/10">
            <Check className="h-4 w-4 text-success" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-200">{emptyTitle}</p>
            <p className="mt-0.5 text-xs text-slate-500">{emptyMessage}</p>
          </div>
        </CardBody>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-warning" />
          <CardTitle>{title}</CardTitle>
          <span className="text-xs text-slate-600">{items.length} {items.length === 1 ? 'item' : 'items'}</span>
        </div>
      </CardHeader>
      <div>
        {items.map((it) => (
          <button
            key={it.key}
            onClick={it.onClick}
            className="group flex w-full items-start gap-3 border-b border-surface-400/20 px-5 py-4 text-left transition-all duration-150 last:border-0 hover:bg-surface-200/40"
          >
            <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${TONE_DOT[it.tone]}`} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-slate-200">{it.title}</p>
              <p className="mt-1 text-xs leading-relaxed text-slate-500">{it.detail}</p>
              <span className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-brand-400 transition-colors group-hover:text-brand-300">
                {it.action}
                <ChevronRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
              </span>
            </div>
          </button>
        ))}
      </div>
    </Card>
  );
}
