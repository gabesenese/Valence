/*
 * Audit document storage refs for non-durable (ephemeral disk) paths.
 *
 * Before BLOB_READ_WRITE_TOKEN was set in prod, uploads fell back to the
 * serverless local disk. Those `documents.path` values are not `http(s)` URLs
 * and no longer resolve after a redeploy/cold start — the file is already gone.
 * This finds them so they can be purged (and the file re-uploaded by hand).
 *
 * Safe by default: previews the offending rows and writes NOTHING.
 * Pass --purge to delete the dead document rows. Intended to run against Neon.
 */
import { prisma } from '../infrastructure/database';

async function main() {
  const purge = process.argv.includes('--purge');

  const docs = await prisma.document.findMany({
    select: { id: true, name: true, path: true, createdAt: true, uploadedBy: { select: { email: true } } },
    orderBy: { createdAt: 'asc' },
  });

  const dead = docs.filter((d) => !/^https?:\/\//i.test(d.path));

  if (dead.length === 0) {
    console.log('✓ All documents point at durable https:// Blob refs. Nothing to do.');
    return;
  }

  console.log(`Found ${dead.length} document(s) with non-durable (disk) refs:`);
  for (const d of dead) {
    console.log(`  - ${d.id}  "${d.name}"  by ${d.uploadedBy?.email ?? 'unknown'}  ->  ${d.path}`);
  }

  if (!purge) {
    console.log('\n[dry-run] These files were lost with the ephemeral disk and must be re-uploaded manually.');
    console.log('Re-run with --purge to delete these dead rows.');
    return;
  }

  const result = await prisma.document.deleteMany({ where: { id: { in: dead.map((d) => d.id) } } });
  console.log(`\n✓ Purged ${result.count} dead document row(s). Ask affected users to re-upload.`);
}

main()
  .catch((err) => { console.error('Audit failed:', err); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
