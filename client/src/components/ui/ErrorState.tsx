import { AlertTriangle, RefreshCw } from 'lucide-react';
import { Button } from './Button';

interface Props {
  title?: string;
  description?: string;
  onRetry?: () => void;
  retrying?: boolean;
}

export function ErrorState({
  title = "Couldn't load this",
  description = 'Something interrupted the request. Check your connection and try again.',
  onRetry,
  retrying,
}: Props) {
  return (
    <div className="flex min-h-[300px] flex-col items-center justify-center py-16 text-center">
      <AlertTriangle className="mb-3 h-8 w-8 text-slate-600" />
      <p className="text-sm font-medium text-slate-400">{title}</p>
      <p className="mt-1 max-w-sm text-xs text-slate-600">{description}</p>
      {onRetry && (
        <Button variant="outline" size="sm" className="mt-4" onClick={onRetry} loading={retrying}>
          <RefreshCw className="h-3.5 w-3.5" />
          Try again
        </Button>
      )}
    </div>
  );
}
