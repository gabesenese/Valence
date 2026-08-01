import { prisma } from '../infrastructure/database';
import { encryptField, isEncrypted } from '../security/field-encryption';

/*
 * One-time backfill that encrypts sensitive fields left as plaintext before the
 * at-rest encryption rollout: tenant taxId + creditScore and user mfaSecret.
 * Idempotent: rows already carrying the `enc:v1:` prefix are skipped, so it is
 * safe to run more than once.
 */
async function main() {
  const tenants = await prisma.tenant.findMany({
    where: { OR: [{ taxId: { not: null } }, { creditScore: { not: null } }] },
    select: { id: true, taxId: true, creditScore: true },
  });
  let tenantsUpdated = 0;
  for (const t of tenants) {
    const data: { taxId?: string | null; creditScore?: string | null } = {};
    if (t.taxId && !isEncrypted(t.taxId)) data.taxId = encryptField(t.taxId);
    if (t.creditScore && !isEncrypted(t.creditScore)) data.creditScore = encryptField(t.creditScore);
    if (Object.keys(data).length > 0) {
      await prisma.tenant.update({ where: { id: t.id }, data });
      tenantsUpdated++;
    }
  }

  const users = await prisma.user.findMany({
    where: { mfaSecret: { not: null } },
    select: { id: true, mfaSecret: true },
  });
  let secretsUpdated = 0;
  for (const u of users) {
    if (u.mfaSecret && !isEncrypted(u.mfaSecret)) {
      await prisma.user.update({ where: { id: u.id }, data: { mfaSecret: encryptField(u.mfaSecret) } });
      secretsUpdated++;
    }
  }

  console.log(`Backfill complete: encrypted ${tenantsUpdated} tenant row(s), ${secretsUpdated} mfa secret(s).`);
  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
