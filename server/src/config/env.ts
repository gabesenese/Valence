import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3001),
  CLIENT_URL: z.string().url().default('http://localhost:5173'),
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_ACCESS_EXPIRES_IN: z.string().default('1h'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('30d'),
  BCRYPT_ROUNDS: z.coerce.number().int().min(10).max(14).default(12),
  AI_PROVIDER: z.enum(['mock', 'groq', 'anthropic']).default('groq'),
  GROQ_API_KEY: z.string().optional(),
  ANTHROPIC_API_KEY: z.string().optional(),
  AI_GATEWAY_API_KEY: z.string().optional(),
  AI_GATEWAY_BASE_URL: z.string().url().optional(),
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  STRIPE_PRICE_ESSENTIALS: z.string().optional(),
  STRIPE_PRICE_PROFESSIONAL: z.string().optional(),
  STRIPE_PRICE_EXECUTIVE: z.string().optional(),
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(900000),
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().default(1000),
  RATE_LIMIT_AUTHED_MAX: z.coerce.number().default(3000),
  BLOB_READ_WRITE_TOKEN: z.string().optional(),
  RESEND_API_KEY: z.string().optional(),
  FROM_EMAIL: z.string().email().default('noreply@valenceos.ca'),
  APP_URL: z.string().url().default('http://localhost:5173'),
  PLATFORM_ADMIN_SECRET: z.string().optional(),
  OWNER_EMAIL: z.string().email().optional(),
  // Integrations: AES-256-GCM key (32-byte hex/base64) for encrypting stored tokens.
  INTEGRATIONS_ENC_KEY: z.string().optional(),
  // QuickBooks Online (Intuit) — use Development (sandbox) keys first.
  QBO_CLIENT_ID: z.string().optional(),
  QBO_CLIENT_SECRET: z.string().optional(),
  QBO_REDIRECT_URI: z.string().optional(),
  QBO_ENVIRONMENT: z.enum(['sandbox', 'production']).default('sandbox'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment configuration:');
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
export type Env = typeof env;
