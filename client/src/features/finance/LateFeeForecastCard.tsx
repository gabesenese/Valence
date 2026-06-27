import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { financeService } from '@/services/finance.service';
import { Card, CardHeader, CardTitle, CardBody } from '@/components/ui/Card';
import { formatCurrency, compactCurrency } from '@/utils/format';

export function LateFeeForecastCard() {
  const navigate = useNavigate();
  const { data, isLoading } = useQuery({
    queryKey: ['finance', 'late-fee-forecast'],
    queryFn: () => financeService.getLateFeeForecast(),
  });

  if (isLoading || !data) return null;
  if (data.overdueCount === 0) return null;

  const stats = [
    { label: 'Overdue balance', value: compactCurrency(data.overdueBalance), color: 'text-slate-300' },
    { label: 'Chargeable now', value: String(data.chargeableCount), color: data.chargeableCount > 0 ? 'text-warning' : 'text-slate-300' },
    { label: 'Within grace', value: String(data.withinGraceCount), color: 'text-slate-300' },
    { label: 'Of which interest', value: compactCurrency(data.interestAccrued), color: 'text-slate-300' },
  ];

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-0.5">
          <CardTitle>Late Fee Forecast</CardTitle>
          <span className="text-[10px] text-slate-600">Collectible late fees on rent that is past due</span>
        </div>
        <div className="text-right">
          <p className="text-lg font-bold tabular-nums text-warning">{compactCurrency(data.expectedLateFees)}</p>
          <p className="text-[10px] uppercase tracking-wider text-slate-600">Expected late fees</p>
        </div>
      </CardHeader>
      <CardBody className="flex flex-col gap-3 pb-3">
        <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 sm:grid-cols-4">
          {stats.map((s) => (
            <div key={s.label}>
              <p className={`text-sm font-semibold tabular-nums ${s.color}`}>{s.value}</p>
              <p className="text-[10px] text-slate-600">{s.label}</p>
            </div>
          ))}
        </div>

        {data.unconfiguredCount > 0 && (
          <p className="rounded-lg border border-surface-400/30 bg-surface-200/40 px-3 py-2 text-[11px] text-slate-500">
            {data.unconfiguredCount} overdue lease{data.unconfiguredCount !== 1 ? 's have' : ' has'} no late-fee policy — set one on the lease to start capturing this revenue.
          </p>
        )}

        <div className="flex flex-col divide-y divide-surface-400/20">
          {data.items.map((item) => (
            <button
              key={item.leaseId}
              onClick={() => navigate(`/leases/${item.leaseId}`)}
              className="flex items-center justify-between gap-3 py-2 text-left transition-colors hover:bg-surface-200/40"
            >
              <div className="min-w-0">
                <p className="truncate text-xs font-medium text-slate-200">{item.tenantName}</p>
                <p className="truncate text-[11px] text-slate-500">
                  {item.propertyName} · {formatCurrency(item.overdueAmount)} overdue · {item.daysLate}d late
                </p>
              </div>
              <div className="shrink-0 text-right">
                {item.chargeable ? (
                  <p className="text-xs font-semibold tabular-nums text-warning">+{formatCurrency(item.fee)}</p>
                ) : (
                  <p className="text-[11px] text-slate-600">in grace</p>
                )}
                <p className="text-[10px] text-slate-600">{item.feeType === 'FLAT' ? 'flat' : '% of balance'}</p>
              </div>
            </button>
          ))}
        </div>
      </CardBody>
    </Card>
  );
}
