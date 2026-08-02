import { prisma } from '../infrastructure/database';

/*
 * One-time backfill for accounts that registered before register() started
 * granting ADMIN by default. Targets only real solo org owners left stuck at
 * ANALYST (Organization.ownerId === their own id) — invited teammates who are
 * legitimately ANALYST are untouched, since they don't own the org they're in.
 */
async function main() {
  const owners = await prisma.organization.findMany({
    where: { ownerId: { not: null } },
    select: { ownerId: true },
  });
  const ownerIds = owners.map((o) => o.ownerId).filter((id): id is string => !!id);

  const result = await prisma.user.updateMany({
    where: { id: { in: ownerIds }, role: 'ANALYST', isDemo: false },
    data: { role: 'ADMIN' },
  });

  console.log(`Backfill complete: promoted ${result.count} solo org owner(s) from ANALYST to ADMIN.`);
  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
