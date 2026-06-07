import { Inbox } from 'lucide-react';

interface Props {
  icon?: React.ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export function EmptyState({ icon: Icon = Inbox, title, description, action }: Props) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <Icon className="mx-auto mb-3 h-8 w-8 text-slate-600" />
      <p className="text-sm font-medium text-slate-400">{title}</p>
      {description && <p className="mt-1 text-xs text-slate-600">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
