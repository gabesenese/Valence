import crypto from 'crypto';
import { env } from '../config/env';

/*
 * Application-layer encryption for sensitive fields at rest (tenant tax IDs and
 * credit scores, account MFA secrets). AES-256-GCM with a random IV per value
 * and an authentication tag, so a stolen database dump does not expose them.
 *
 * A dedicated PII_ENC_KEY is preferred; it falls back to the integrations key
 * and then JWT_SECRET so encryption is always active even before the dedicated
 * key is provisioned. The `enc:v1:` prefix makes an encrypted value
 * unambiguous, so reads pass legacy plaintext through untouched and the
 * backfill can skip already-encrypted rows.
 */

const PREFIX = 'enc:v1:';

function key(): Buffer {
  const source = env.PII_ENC_KEY || env.INTEGRATIONS_ENC_KEY || env.JWT_SECRET;
  return crypto.createHash('sha256').update(source).digest();
}

export function isEncrypted(value: string | null | undefined): boolean {
  return typeof value === 'string' && value.startsWith(PREFIX);
}

export function encryptField(plain: string | null | undefined): string | null {
  if (plain === null || plain === undefined || plain === '') return null;
  if (isEncrypted(plain)) return plain;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key(), iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return PREFIX + Buffer.concat([iv, tag, enc]).toString('base64');
}

export function decryptField(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  if (!isEncrypted(value)) return value;
  const buf = Buffer.from(value.slice(PREFIX.length), 'base64');
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const enc = buf.subarray(28);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8');
}

export function encryptNumber(value: number | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  return encryptField(String(value));
}

export function decryptNumber(value: string | null | undefined): number | null {
  const plain = decryptField(value);
  if (plain === null || plain === '') return null;
  const n = Number(plain);
  return Number.isFinite(n) ? n : null;
}
