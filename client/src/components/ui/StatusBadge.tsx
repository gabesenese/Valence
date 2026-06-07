import { Badge } from '@/components/ui/Badge';

type BadgeVariant = 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'brand';

export interface StatusEntry {
  label: string;
  variant: BadgeVariant;
  dot?: boolean;
}

interface StatusBadgeProps {
  status: string;
  config: Record<string, StatusEntry>;
  className?: string;
}

export function StatusBadge({ status, config, className }: StatusBadgeProps) {
  const entry = config[status] ?? { label: status, variant: 'neutral' as BadgeVariant };
  return (
    <Badge variant={entry.variant} dot={entry.dot} className={className}>
      {entry.label}
    </Badge>
  );
}
