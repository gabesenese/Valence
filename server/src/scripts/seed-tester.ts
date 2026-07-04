import bcrypt from 'bcryptjs';
import { TESTER_EMAILS } from '../config/testers';
import { prisma } from '../infrastructure/database';

const EMAIL = TESTER_EMAILS[0];
const PASSWORD = process.env.TESTER_PASSWORD ?? 'ValenceTester!2026';

async function main() {
  const passwordHash = await bcrypt.hash(PASSWORD, 12);
  const user = await prisma.user.upsert({
    where: { email: EMAIL },
    update: { role: 'ADMIN', plan: 'EXECUTIVE', isActive: true, emailVerifiedAt: new Date(), passwordHash },
    create: {
      email: EMAIL,
      passwordHash,
      firstName: 'Tester',
      lastName: 'Account',
      role: 'ADMIN',
      plan: 'EXECUTIVE',
      emailVerifiedAt: new Date(),
    },
  });
  console.log(`Tester ready: ${user.email} (plan ${user.plan}, role ${user.role}, id ${user.id})`);
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect().catch(() => {});
  process.exit(1);
});
