import { describe, it, expect } from 'vitest';
import {
  encryptField, decryptField, encryptNumber, decryptNumber, isEncrypted,
} from '../security/field-encryption';

describe('field encryption', () => {
  it('round-trips a string value', () => {
    const cipher = encryptField('123-45-6789');
    expect(cipher).not.toBe('123-45-6789');
    expect(isEncrypted(cipher)).toBe(true);
    expect(decryptField(cipher)).toBe('123-45-6789');
  });

  it('round-trips a numeric value', () => {
    const cipher = encryptNumber(820);
    expect(isEncrypted(cipher)).toBe(true);
    expect(decryptNumber(cipher)).toBe(820);
  });

  it('passes legacy plaintext through on read', () => {
    expect(isEncrypted('820')).toBe(false);
    expect(decryptField('820')).toBe('820');
    expect(decryptNumber('820')).toBe(820);
  });

  it('is idempotent: encrypting an already-encrypted value is a no-op', () => {
    const once = encryptField('secret');
    expect(encryptField(once)).toBe(once);
  });

  it('uses a random IV so identical inputs yield distinct ciphertext', () => {
    expect(encryptField('x')).not.toBe(encryptField('x'));
  });

  it('normalizes null and empty to null', () => {
    expect(encryptField(null)).toBeNull();
    expect(encryptField('')).toBeNull();
    expect(decryptField(null)).toBeNull();
    expect(decryptNumber(null)).toBeNull();
  });

  it('rejects tampered ciphertext (authenticated encryption)', () => {
    const cipher = encryptField('secret')!;
    const body = cipher.slice('enc:v1:'.length);
    const flipped = (body[10] === 'A' ? 'B' : 'A');
    const tampered = 'enc:v1:' + body.slice(0, 10) + flipped + body.slice(11);
    expect(() => decryptField(tampered)).toThrow();
  });
});
