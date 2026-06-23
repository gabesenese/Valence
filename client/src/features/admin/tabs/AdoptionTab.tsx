import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { adminService, type AdoptionAccount } from '@/services/admin.service';

function usedPill(active: boolean, label: string) {
  return active
    ? <span className="rounded-full bg-success/10 px-2 py-0.5 text-[11px] font-semibold text-success">{label}</span>
    : <span className="rounded-full bg-surface-300 px-2 py-0.5 text-[11px] font-medium text-slate-500">None</span>;
}

export function AdoptionTab({ secret }: { secret: string }) {
  const { data } = useQuery({
    queryKey: ['admin', 'adoption', secret],
    queryFn: () => adminService.getAdoption(secret),
    staleTime: 60_000,
  });

  if (!data) {
    return <div className="flex items-center justify-center py-24 text-xs text-slate-500"><Loader2 className="h-4 w-4 animate-spin mr-2" />Loading adoption…</div>;
  }

  const cells = (a: AdoptionAccount) => [
    usedPill(a.import, 'Imported'),
    usedPill(a.finance > 0, `${a.finance}`),
    usedPill(a.workQueue > 0, `${a.workQueue}`),
    usedPill(a.automation > 0, `${a.automation}`),
    usedPill(a.ai > 0, `${a.ai}`),
  ];

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {[
          { label: 'Import', value: data.summary.import },
          { label: 'Finance', value: data.summary.finance },
          { label: 'Work Queue', value: data.summary.workQueue },
          { label: 'Automation', value: data.summary.automation },
          { label: 'AI', value: data.summary.ai },
        ].map((k) => (
          <div key={k.label} className="rounded-xl border border-surface-400/40 bg-surface-100 p-4">
            <p className="text-lg font-bold tabular-nums text-fg">{k.value}%</p>
            <p className="mt-0.5 text-[11px] text-slate-500">use {k.label}</p>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-surface-400/40 bg-surface-100 overflow-hidden">
        <div className="flex items-center justify-between border-b border-surface-400/30 px-4 py-2.5">
          <span className="text-sm font-semibold text-fg">Adoption by account</span>
          <span className="text-xs text-slate-500">{data.summary.total} accounts</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-surface-400/30">
                {['Account', 'Import', 'Finance', 'Work Queue', 'Automation', 'AI'].map((h) => (
                  <th key={h} className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-surface-400/20">
              {data.accounts.map((a) => (
                <tr key={a.id} className="hover:bg-surface-200/40">
                  <td className="px-4 py-2.5">
                    <div className="text-slate-300">{a.name || a.email}</div>
                    <div className="text-[11px] text-slate-500">{a.email} · {a.plan}</div>
                  </td>
                  {cells(a).map((c, i) => <td key={i} className="px-4 py-2.5">{c}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
          {data.accounts.length === 0 && <p className="px-4 py-8 text-center text-xs text-slate-500">No accounts.</p>}
        </div>
        <p className="border-t border-surface-400/30 px-4 py-2 text-[11px] text-slate-600">Finance/Work Queue/Automation/AI show record counts; Work Queue is a task-count proxy until usage events land.</p>
      </div>
    </div>
  );
}
