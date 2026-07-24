import { useEffect, useState } from 'react';
import { formatMoneyString } from '@/components/ui/MoneyInput';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, ArrowRight, Check } from 'lucide-react';
import { EXPENSE_CATEGORIES, categoryLabel } from '@valence/shared';
import { financeService, type BudgetVarianceItem } from '@/services/finance.service';
import { Card, CardHeader, CardTitle, CardBody } from '@/components/ui/Card';
import { compactCurrency } from '@/utils/format';

type RowState = { tone: 'under' | 'near' | 'over'; cls: string; label: string };

function budgetState(item: BudgetVarianceItem): RowState | null {
  if (item.budget <= 0 || item.actual <= 0) return null;
  if (item.actual > item.budget) return { tone: 'over', cls: 'bg-danger/10 text-danger', label: 'Over budget' };
  if (item.actual / item.budget >= 0.85) return { tone: 'near', cls: 'bg-warning/10 text-warning', label: 'Near budget' };
  return { tone: 'under', cls: 'bg-success/10 text-success', label: 'Under budget' };
}

function BudgetRow({
  category, item, onSave, onClear, onReview,
}: {
  category: string;
  item?: BudgetVarianceItem;
  onSave: (amount: number) => void;
  onClear: () => void;
  onReview: () => void;
}) {
  const [value, setValue] = useState(item ? formatMoneyString(String(Math.round(item.budget))) : '');
  const [justSaved, setJustSaved] = useState(false);
  const actual = item?.actual ?? 0;

  useEffect(() => {
    if (!justSaved) return;
    const t = setTimeout(() => setJustSaved(false), 1800);
    return () => clearTimeout(t);
  }, [justSaved]);

  const commit = () => {
    const amount = parseFloat(value.replace(/,/g, ''));
    if (!value.trim() || !Number.isFinite(amount) || amount <= 0) {
      if (item) onClear();
      return;
    }
    if (!item || amount !== item.budget) { onSave(amount); setJustSaved(true); }
  };

  const pctUsed = item && item.budget > 0 ? Math.round((item.actual / item.budget) * 100) : 0;
  const state = item ? budgetState(item) : null;
  const flagged = state?.tone === 'over' || state?.tone === 'near';

  return (
    <div className="flex items-center gap-3">
      <span className="w-36 shrink-0 text-xs text-slate-300">{categoryLabel(category)}</span>
      <div className="relative">
        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-slate-600">$</span>
        <input
          value={value}
          inputMode="numeric"
          onChange={(e) => setValue(formatMoneyString(e.target.value.replace(/[^0-9]/g, '')))}
          onBlur={commit}
          onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
          placeholder="—"
          aria-label={`Monthly budget for ${categoryLabel(category)}`}
          className="w-24 rounded-lg border border-surface-400/40 bg-surface-200 pl-5 pr-2 py-1 text-xs text-slate-200 tabular-nums outline-none focus:border-brand-500/50"
        />
      </div>
      <span className={`flex w-14 shrink-0 items-center gap-1 text-[11px] font-medium text-success transition-opacity duration-200 ${justSaved ? 'opacity-100' : 'opacity-0'}`}>
        <Check className="h-3 w-3" />Saved
      </span>
      <div className="flex flex-1 items-center justify-end gap-3 text-xs tabular-nums">
        {item ? (
          <>
            <span className="text-slate-500">{compactCurrency(actual)} · {pctUsed}% used</span>
            {state && (
              <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${state.cls}`}>
                {state.tone === 'under' ? <Check className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
                {state.label}
              </span>
            )}
            {flagged && (
              <button
                type="button"
                onClick={onReview}
                className="group inline-flex shrink-0 items-center gap-1 font-medium text-slate-400 transition-colors hover:text-brand-300"
              >
                Review spending<ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
              </button>
            )}
          </>
        ) : (
          <span className="text-slate-600">Not set</span>
        )}
      </div>
    </div>
  );
}

export function BudgetCard() {
  const qc = useQueryClient();
  const navigate = useNavigate();
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
  const total = EXPENSE_CATEGORIES.length;
  const configured = byCategory.size;
  const subtitle =
    configured === 0
      ? 'No limits set yet · set a monthly budget per category'
      : `${configured} of ${total} set · applies every month`;

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-0.5">
          <CardTitle>Monthly Budgets</CardTitle>
          <span className="text-[10px] text-slate-600">{subtitle}</span>
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
            onReview={() => navigate(`/finance?tab=ledger&category=${encodeURIComponent(c.value)}`)}
          />
        ))}
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-surface-400/30 pt-2.5 text-[10px] leading-relaxed text-slate-600">
          <span>Actuals compared to {data?.month ?? 'this month'} expenses.</span>
          <button
            type="button"
            onClick={() => navigate('/finance?tab=expenses')}
            className="group inline-flex items-center gap-1 font-medium text-slate-500 transition-colors hover:text-brand-300"
          >
            View spending analysis<ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" />
          </button>
        </div>
      </CardBody>
    </Card>
  );
}
