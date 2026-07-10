import { financeService, type Recommendation } from '@/services/finance.service';
import { leasesService } from '@/services/leases.service';
import { demoService } from '@/services/demo.service';
import { importService, parseCsvPreview } from '@/services/import.service';
import { detectEntity, toColumnMap, type ImportTab } from '@/features/import/import.mapping';
import { compactCurrency } from '@/utils/format';
import type {
  AnalysisResult,
  ActivationFinding,
  AnalysisStep,
  FindingSeverity,
  PortfolioAnalyzer,
} from './activation.types';

/*
 * The real "understanding" of a portfolio. Each step performs genuine work and
 * resolves with what it found; the console paces to that, not to a fake timer.
 * Everything reads the SAME engine the dashboard uses — getFinanceIntelligence,
 * the finance summary, the lease list — so onboarding and the dashboard can
 * never disagree. Nothing here is invented.
 */
const toSeverity = (s: 'HIGH' | 'MEDIUM' | 'LOW'): FindingSeverity =>
  s === 'HIGH' ? 'critical' : s === 'MEDIUM' ? 'warning' : 'info';

const recToFinding = (r: Recommendation): ActivationFinding => ({
  severity: toSeverity(r.severity),
  title: r.title,
  detail: r.description,
  value: r.impact ? compactCurrency(r.impact.value) : undefined,
});

const ACTION_CTA: Record<Recommendation['action'], string> = {
  RENEW_LEASE: 'Review renewal',
  COLLECT: 'Collect payment',
  REVIEW_BUDGET: 'Review budget',
  SET_LATE_FEE_POLICY: 'Configure policy',
};

type Lease = Awaited<ReturnType<typeof leasesService.getLeases>>['data'][number];
type Intel = Awaited<ReturnType<typeof financeService.getIntelligence>>;

export function createPortfolioAnalyzer(opts?: {
  prelude?: () => Promise<void>;
  leadStep?: AnalysisStep;
  /* Import paths must yield real leases — if the read comes back empty the file
   * didn't produce anything, and we surface why instead of proceeding to a
   * misleadingly healthy "good shape" insight. Demo paths leave this off. */
  requireLeases?: boolean;
  emptyLeasesMessage?: () => string;
}): PortfolioAnalyzer {
  let leases: Lease[] = [];
  let intel: Intel | null = null;

  const steps: AnalysisStep[] = [
    ...(opts?.leadStep ? [opts.leadStep] : []),
    {
      label: 'Reading leases',
      run: async () => {
        if (opts?.prelude) await opts.prelude();
        leases = (await leasesService.getLeases({ limit: 100 })).data;
        if (opts?.requireLeases && leases.length === 0) {
          throw new Error(opts.emptyLeasesMessage?.() ?? 'We couldn’t read any leases from that file.');
        }
        const props = new Set(leases.map((l) => l.property.code)).size;
        return { value: `${leases.length} found · ${props} propert${props === 1 ? 'y' : 'ies'}` };
      },
    },
    {
      label: 'Matching tenants',
      run: async () => {
        const n = new Set(leases.map((l) => l.tenant.id)).size;
        return { value: `${n} matched` };
      },
    },
    {
      label: 'Calculating annual revenue',
      run: async () => {
        const rents = leases.map((l) => Number(l.baseRent)).filter((n) => n > 0);
        const annualRevenue = Math.round(rents.reduce((a, b) => a + b, 0) * 12);
        return { value: `${compactCurrency(annualRevenue)}/yr`, bars: { rents, annualRevenue } };
      },
    },
    {
      label: 'Searching for operational risks',
      run: async () => {
        intel = await financeService.getIntelligence();
        const n = intel.recommendations.length;
        return { value: `${n} ${n === 1 ? 'opportunity' : 'opportunities'} found` };
      },
    },
  ];

  const soonestExpiryDays = (): number | null => {
    const now = Date.now();
    const days = leases
      .map((l) => Math.round((new Date(l.endDate).getTime() - now) / 86_400_000))
      .filter((d) => d >= 0);
    return days.length ? Math.min(...days) : null;
  };

  const finalize = (): AnalysisResult => {
    if (!intel) throw new Error('Analysis did not complete');
    const leaseRents = leases.map((l) => Number(l.baseRent)).filter((n) => n > 0);
    const monthlyRevenue = leaseRents.reduce((a, b) => a + b, 0);
    const annualRevenue = Math.round(monthlyRevenue * 12);
    const recs = [...intel.recommendations].sort((a, b) => a.priority - b.priority);

    let findings: ActivationFinding[];
    let directive: string | null;
    let directiveAction: string | null;
    let directiveDeepLink: string | null;
    let directiveImpact: AnalysisResult['directiveImpact'] = null;
    let directiveHorizonDays: number | null = null;
    if (recs.length > 0) {
      const top = recs[0];
      findings = recs.slice(0, 3).map(recToFinding);
      directive = top.description || top.title;
      directiveAction = ACTION_CTA[top.action] ?? null;
      directiveDeepLink = top.deepLink ?? null;
      if (top.impact) {
        directiveImpact = top.action === 'RENEW_LEASE'
          ? { amount: top.impact.value * 12, frame: 'annual' }
          : { amount: top.impact.value, frame: 'once' };
      }
      if (top.action === 'RENEW_LEASE') {
        // The horizon must belong to THIS renewal (the card says "this renewal was
        // N days from slipping"), not the portfolio's soonest expiry — those can differ
        // when the top lease is ranked by value rather than proximity.
        const topLeaseId = top.deepLink?.split('/leases/')[1];
        const topLease = topLeaseId ? leases.find((l) => l.id === topLeaseId) : undefined;
        const topDays = topLease ? Math.round((new Date(topLease.endDate).getTime() - Date.now()) / 86_400_000) : null;
        directiveHorizonDays = topDays != null && topDays >= 0 ? topDays : soonestExpiryDays();
      }
    } else {
      findings = [
        { severity: 'positive', title: 'No overdue rent detected', detail: 'Every active lease is current.' },
        { severity: 'positive', title: `All ${leases.length} lease${leases.length === 1 ? '' : 's'} active`, detail: 'Nothing expiring in the next 90 days.' },
        { severity: 'positive', title: 'Forecast ready', detail: `${compactCurrency(annualRevenue)}/yr in contracted revenue.` },
      ];
      directive = 'Your portfolio looks healthy — start by exploring your revenue forecast.';
      directiveAction = null;
      directiveDeepLink = null;
    }

    return {
      propertyCount: new Set(leases.map((l) => l.property.code)).size,
      leaseCount: leases.length,
      tenantCount: new Set(leases.map((l) => l.tenant.id)).size,
      monthlyRevenue,
      annualRevenue,
      leaseRents,
      opportunityCount: recs.length,
      findings,
      directive,
      directiveAction,
      directiveDeepLink,
      directiveImpact,
      directiveHorizonDays,
    };
  };

  return { steps, finalize };
}

/* Demo path: load the sample portfolio first, then analyze it with the real engine. */
export function createDemoAnalyzer(): PortfolioAnalyzer {
  return createPortfolioAnalyzer({ prelude: async () => { await demoService.loadDemo(); } });
}

/*
 * Import path: recognize each dropped file (properties vs leases vs expenses)
 * with the importer's own alias tables, import properties before leases so
 * codes resolve, then analyze the result with the same engine. A lease file
 * whose property codes don't exist yet still lands — the server auto-creates a
 * stub property per unmatched code — so a single rent roll is enough to start.
 */
export function createImportAnalyzer(files: File[]): PortfolioAnalyzer {
  let firstError: string | null = null;
  const leadStep: AnalysisStep = {
    label: 'Importing your portfolio',
    run: async () => {
      const classified = await Promise.all(
        files.map(async (file) => {
          const { headers } = await parseCsvPreview(file);
          return { file, headers, tab: detectEntity(headers) };
        }),
      );
      const recognized = classified.filter((c): c is typeof c & { tab: ImportTab } => c.tab !== null);
      if (recognized.length === 0) {
        throw new Error('We couldn’t recognize a properties or leases file — make sure it has a header row.');
      }

      const totals = { created: 0, updated: 0, skipped: 0 };
      for (const tab of ['properties', 'leases', 'expenses'] as ImportTab[]) {
        const match = recognized.find((c) => c.tab === tab);
        if (!match) continue;
        const res = await importService[tab](match.file, toColumnMap(match.headers, tab));
        totals.created += res.created;
        totals.updated += res.updated;
        totals.skipped += res.skipped;
        if (!firstError && res.errors.length) firstError = res.errors[0].message;
      }

      // Only a genuinely empty/unreadable file is a failure. Rows that were
      // skipped because they already exist mean the portfolio is already on
      // file — a re-import — so we proceed to analyze what's there rather than
      // treating "nothing new" as an error.
      if (totals.created === 0 && totals.updated === 0 && totals.skipped === 0) {
        throw new Error(firstError ?? 'Nothing could be imported from that file.');
      }

      const parts = [
        totals.created ? `${totals.created} imported` : null,
        totals.updated ? `${totals.updated} updated` : null,
        totals.skipped ? `${totals.skipped} already on file` : null,
      ].filter(Boolean);
      return { value: parts.join(' · ') };
    },
  };
  return createPortfolioAnalyzer({
    leadStep,
    // A re-import of data already on file leaves leases in place, so the read
    // still finds them and we proceed. This only fires when the file produced
    // nothing readable — then we surface the first row error rather than a
    // falsely healthy insight.
    requireLeases: true,
    emptyLeasesMessage: () =>
      firstError
        ? `We read the file but couldn’t create any leases. First issue: ${firstError}`
        : 'We couldn’t create any leases from that file. Check that it has property code, tenant, lease number, start and end dates, and rent.',
  });
}
