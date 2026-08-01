import { prisma } from './infrastructure/database';

const BASE = 'http://localhost:3001/api';
const email = `qa-smoke-${Date.now()}@example.com`;
const pass = 'QaSmoke!2026';
let token = '';

const results: { step: string; status: number | string }[] = [];

async function call(method: string, path: string, body?: unknown, auth = true) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (auth && token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(BASE + path, { method, headers, body: body ? JSON.stringify(body) : undefined });
  let json: any = null;
  try { json = await res.json(); } catch { /* non-json */ }
  return { status: res.status, json };
}

function note(step: string, status: number | string, extra: string) {
  results.push({ step, status });
  console.log(`  ${String(status).padEnd(5)} ${step.padEnd(32)} ${extra}`);
}

function shape(j: any): string {
  const d = j?.data ?? j;
  if (Array.isArray(d)) return `${d.length} items`;
  if (d && typeof d === 'object') return Object.keys(d).slice(0, 7).join(',');
  return String(typeof d);
}

async function main() {
  console.log(`\n=== /try activation funnel smoke — ${email} ===\n`);

  const reg = await call('POST', '/auth/register', { email, password: pass, firstName: 'QA', lastName: 'Smoke' }, false);
  token = reg.json?.data?.tokens?.accessToken ?? reg.json?.data?.accessToken ?? '';
  const plan0 = reg.json?.data?.user?.plan ?? '?';
  note('register (/try)', reg.status, token ? `token ok, plan=${plan0}` : `NO TOKEN: ${JSON.stringify(reg.json).slice(0,140)}`);
  if (!token) { await cleanup(); return; }

  const claim = await call('POST', '/auth/claim-trial', {});
  note('claim-trial', claim.status, claim.json?.data?.trialEndsAt ? `trial to ${String(claim.json.data.trialEndsAt).slice(0,10)}` : shape(claim.json));

  const me = await call('GET', '/auth/me');
  note('auth/me', me.status, `plan=${me.json?.data?.plan ?? '?'} trialEndsAt=${String(me.json?.data?.trialEndsAt ?? 'null').slice(0,10)}`);

  const demo = await call('POST', '/demo/load', {});
  note('demo/load (Explore sample)', demo.status, shape(demo.json));

  const reads: [string, string][] = [
    ['work queue (home)', '/work-queue'],
    ['finance summary', '/finance/summary'],
    ['finance pulse', '/finance/pulse'],
    ['finance intelligence', '/finance/intelligence'],
    ['finance at-risk', '/finance/at-risk'],
    ['properties', '/properties'],
    ['leases', '/leases'],
    ['tenants', '/tenants'],
    ['automation rules', '/automation/rules'],
    ['impact: simulate options', '/ai/simulate/options'],
  ];
  for (const [label, path] of reads) {
    const r = await call('GET', path);
    note(label, r.status, r.status >= 400 ? JSON.stringify(r.json).slice(0, 100) : shape(r.json));
  }

  const sim = await call('POST', '/ai/simulate', { scenario: 'occupancy_drop', params: { percentageDrop: 5 } });
  note('impact: run simulation', sim.status, sim.status >= 400 ? JSON.stringify(sim.json).slice(0, 100) : (sim.json?.data?.impact ? 'impact computed' : shape(sim.json)));

  await cleanup();

  const fails = results.filter(r => typeof r.status === 'number' && (r.status as number) >= 400 && r.step !== 'cleanup');
  const total = results.filter(r => r.step !== 'cleanup').length;
  console.log(`\n=== SUMMARY: ${total - fails.length}/${total} funnel steps 2xx/3xx; ${fails.length} non-2xx ===`);
  if (fails.length) console.log('Non-2xx:', fails.map(f => `${f.step}=${f.status}`).join(', '));
}

async function cleanup() {
  try {
    const u = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (!u) { note('cleanup', 'skip', 'user not found'); return; }
    const id = u.id;
    if (token) await call('POST', '/demo/reset', {}).catch(() => {});
    await prisma.automationRule.deleteMany({ where: { createdById: id } }).catch(() => {});
    await prisma.refreshToken.deleteMany({ where: { userId: id } }).catch(() => {});
    for (const t of ['funnelEvent', 'auditLog', 'insight'] as const) {
      try { await (prisma as any)[t]?.deleteMany?.({ where: { userId: id } }); } catch { /* no userId col */ }
    }
    await prisma.user.delete({ where: { id } });
    note('cleanup', 'ok', `deleted test user ${id}`);
  } catch (e: any) {
    note('cleanup', 'ERR', `MANUAL CLEANUP NEEDED for ${email}: ${e?.message?.slice(0,160)}`);
  }
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(async () => { await prisma.$disconnect(); });
