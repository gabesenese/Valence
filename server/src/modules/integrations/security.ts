import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { env } from '../../config/env';

// AES-256-GCM at-rest encryption for stored OAuth tokens / API keys. The key is
// derived from INTEGRATIONS_ENC_KEY so any sufficiently-random secret works.
function encKey(): Buffer {
  if (!env.INTEGRATIONS_ENC_KEY) throw new Error('INTEGRATIONS_ENC_KEY is not configured');
  return crypto.createHash('sha256').update(env.INTEGRATIONS_ENC_KEY).digest();
}

export function encryptSecret(plaintext: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', encKey(), iv);
  const enc = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString('base64');
}

export function decryptSecret(payload: string): string {
  const buf = Buffer.from(payload, 'base64');
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const enc = buf.subarray(28);
  const decipher = crypto.createDecipheriv('aes-256-gcm', encKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8');
}

// Signed, short-lived state so the (unauthenticated) OAuth callback can recover
// which owner started the flow without trusting the redirect.
export function signOAuthState(ownerId: string, provider: string): string {
  return jwt.sign({ ownerId, provider }, env.JWT_SECRET, { expiresIn: '10m' });
}

export function verifyOAuthState(state: string): { ownerId: string; provider: string } {
  return jwt.verify(state, env.JWT_SECRET) as { ownerId: string; provider: string };
}
