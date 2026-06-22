import { defineConfig } from 'prisma/config';
import 'dotenv/config';

export default defineConfig({
  datasource: {
    // Migrations (CLI) prefer a direct connection when available; poolers
    // (pgbouncer/Neon) break `migrate deploy`. Falls back to DATABASE_URL.
    url: process.env.DIRECT_URL ?? process.env.DATABASE_URL!,
  },
});
