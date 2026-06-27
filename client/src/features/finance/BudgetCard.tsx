import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { EXPENSE_CATEGORIES, categoryLabel } from '@valence/shared';
import { financeService, type BudgetVarianceItem } from '@/services/finance.service';
import { Card, CardHeader, CardTitle, CardBody } from '@/components/ui/Card';
import { compactCurrency } from '@/utils/format';

function BudgetRow({
  category, item, onSave, onClear,
}: {
  category: string;
  item?: BudgetVarianceItem;
  onSave: (amount: number) => void;
  onClear: () => void;
}) {
  const [value, setValue] = useState(item ? String(item.budget) : '');
  const actual = item?.actual ?? 0;

  const commit = () => {
    const amount = parseFloat(value);
    if (!value.trim() || !Number.isFinite(amount) || amount <= 0) {
      if (item) onClear();
      return;
    }
    if (!item || amount !== item.budget) onSave(amount);
  };

  const statusColor = item?.status === 'over' ? 'text-danger' : item?.status === 'under' ? 'text-success' : 'text-slate-400';
  const statusLabel = item?.status === 'over' ? 'over' : item?.status === 'under' ? 'under' : 'on track';

  return (
    <div className="flex items-center gap-3">
      <span className="w-36 shrink-0 text-xs text-slate-300">{categoryLabel(category)}</span>
      <div className="relative">
        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-slate-600">$</span>
        <input
          value={value}
          onChange={(e) => setValue(e.target.value.replace(/[^0-9.]/g, ''))}
          onBlur={commit}
          onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
          placeholder="—"
          aria-label={`Monthly budget for ${categoryLabel(category)}`}
          className="w-24 rounded-lg border border-surface-400/40 bg-surface-200 pl-5 pr-2 py-1 text-xs text-slate-200 tabular-nums outline-none focus:border-brand-500/50"
        />
      </div>
      <div className="flex-1 text-right text-xs tabular-nums">
        <span className="text-slate-500">{compactCurrency(actual)} actual</span>
        {item && (
          <span className={`ml-2 font-semibold ${statusColor}`}>
            {item.variance > 0 ? '+' : ''}{compactCurrency(item.variance)} {statusLabel}
          </span>
        )}
      </div>
    </div>
  );
}

export function BudgetCard() {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ['finance', 'budgets'], queryFn: () => financeService.getBudgets() });

  const invalidate = () => qc.invalidateQueries({ queryKey: ['finance', 'budgets'] });
  const save = useMutation({
    mutationFn: (input: { category: string; monthlyAmount: number }) => financeService.upsertBudget(input),
    onSuccess: invalidate,
  });
  const remove = useMutation({
    mutationFn: (id: string) => financeService.deleteBudget(id),
    onSuccess: invalidate,
  });

  const byCategory = new Map((data?.items ?? []).map((i) => [i.category, i]));

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-0.5">
          <CardTitle>Budget vs Actual</CardTitle>
          <span className="text-[10px] text-slate-600">Set a monthly budget per category · compared to {data?.month ?? 'this month'} expenses</span>
        </div>
      </CardHeader>
      <CardBody className="flex flex-col gap-2 pb-3">
        {EXPENSE_CATEGORIES.map((c) => (
          <BudgetRow
            key={c.value}
            category={c.value}
            item={byCategory.get(c.value)}
            onSave={(amount) => save.mutate({ category: c.value, monthlyAmount: amount })}
            onClear={() => { const it = byCategory.get(c.value); if (it) remove.mutate(it.id); }}
          />
        ))}
      </CardBody>
    </Card>
  );
}
