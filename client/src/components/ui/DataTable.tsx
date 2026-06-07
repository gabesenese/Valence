import { Search, ChevronUp, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { PageLoader } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { Card } from '@/components/ui/Card';
import { cn } from '@/utils/cn';

export interface Column<T> {
  key: string;
  header: string;
  width?: string;
  className?: string;
  sortable?: boolean;
  render: (row: T) => React.ReactNode;
}

export interface DataTablePagination {
  page: number;
  pages: number;
  total: number;
  label?: string;
  onPageChange: (page: number) => void;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyExtractor: (row: T) => string;
  loading?: boolean;
  // Empty state
  emptyIcon?: React.ComponentType<{ className?: string }>;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: React.ReactNode;
  // Sorting (controlled)
  sortKey?: string;
  sortDir?: 'asc' | 'desc';
  onSort?: (key: string, dir: 'asc' | 'desc') => void;
  // Pagination (controlled)
  pagination?: DataTablePagination;
  // Row interaction
  onRowClick?: (row: T) => void;
  rowClassName?: (row: T) => string;
  // Toolbar
  search?: string;
  onSearch?: (s: string) => void;
  searchPlaceholder?: string;
  filters?: React.ReactNode;
  actions?: React.ReactNode;
}

export function DataTable<T>({
  columns,
  data,
  keyExtractor,
  loading,
  emptyIcon,
  emptyTitle = 'No data found',
  emptyDescription,
  emptyAction,
  sortKey,
  sortDir,
  onSort,
  pagination,
  onRowClick,
  rowClassName,
  search,
  onSearch,
  searchPlaceholder = 'Search…',
  filters,
  actions,
}: DataTableProps<T>) {
  const hasToolbar = onSearch || filters || actions;

  function handleSort(key: string) {
    if (!onSort) return;
    if (sortKey === key) {
      onSort(key, sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      onSort(key, 'asc');
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {hasToolbar && (
        <div className="flex flex-wrap items-center gap-3">
          {onSearch && (
            <div className="relative min-w-[180px] flex-1 max-w-xs">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-600" />
              <input
                type="text"
                placeholder={searchPlaceholder}
                value={search ?? ''}
                onChange={(e) => onSearch(e.target.value)}
                className="h-9 w-full rounded-lg border border-surface-400 bg-surface-200 pl-9 pr-3 text-sm text-slate-100 placeholder:text-slate-600 focus:border-brand-500/60 focus:outline-none focus:ring-1 focus:ring-brand-500/30"
              />
            </div>
          )}
          {filters && <div className="flex items-center gap-2">{filters}</div>}
          {actions && <div className="ml-auto flex items-center gap-2">{actions}</div>}
        </div>
      )}

      <Card>
        {loading ? (
          <PageLoader />
        ) : data.length === 0 ? (
          <EmptyState
            icon={emptyIcon}
            title={emptyTitle}
            description={emptyDescription}
            action={emptyAction}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-surface-400/40">
                  {columns.map((col) => (
                    <th
                      key={col.key}
                      style={col.width ? { width: col.width } : undefined}
                      onClick={col.sortable && onSort ? () => handleSort(col.key) : undefined}
                      className={cn(
                        'px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500',
                        col.sortable && onSort && 'cursor-pointer select-none hover:text-slate-300',
                        col.className,
                      )}
                    >
                      <span className="inline-flex items-center gap-1">
                        {col.header}
                        {col.sortable && onSort && (
                          sortKey === col.key ? (
                            sortDir === 'asc'
                              ? <ChevronUp className="h-3 w-3" />
                              : <ChevronDown className="h-3 w-3" />
                          ) : (
                            <ChevronUp className="h-3 w-3 opacity-25" />
                          )
                        )}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.map((row) => (
                  <tr
                    key={keyExtractor(row)}
                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                    className={cn(
                      'border-b border-surface-400/30 transition-colors last:border-0',
                      onRowClick
                        ? 'cursor-pointer hover:bg-surface-200/40'
                        : 'hover:bg-surface-200/20',
                      rowClassName?.(row),
                    )}
                  >
                    {columns.map((col) => (
                      <td key={col.key} className={cn('px-4 py-3', col.className)}>
                        {col.render(row)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!loading && data.length > 0 && pagination && pagination.pages > 1 && (
          <div className="flex items-center justify-between border-t border-surface-400/40 px-4 py-3">
            <p className="text-xs text-slate-600">
              {pagination.total} {pagination.label ?? 'items'}
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => pagination.onPageChange(pagination.page - 1)}
                disabled={pagination.page <= 1}
                className="flex h-7 w-7 items-center justify-center rounded-lg border border-surface-400/40 text-slate-400 transition-colors hover:border-brand-500/40 hover:text-brand-400 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </button>
              <span className="min-w-[60px] text-center text-xs text-slate-500">
                {pagination.page} / {pagination.pages}
              </span>
              <button
                onClick={() => pagination.onPageChange(pagination.page + 1)}
                disabled={pagination.page >= pagination.pages}
                className="flex h-7 w-7 items-center justify-center rounded-lg border border-surface-400/40 text-slate-400 transition-colors hover:border-brand-500/40 hover:text-brand-400 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
