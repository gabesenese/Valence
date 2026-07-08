import { describe, it, expect } from 'vitest';
import { contentMatchesMime } from '../modules/documents/mime';

const pdf = Buffer.concat([Buffer.from('%PDF-1.7'), Buffer.alloc(8)]);
const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const evil = Buffer.concat([Buffer.from('MZ\x90\x00'), Buffer.alloc(12)]);

describe('upload — content matches declared MIME', () => {
  it('accepts a real PDF declared as application/pdf', () => {
    expect(contentMatchesMime(pdf, 'application/pdf')).toBe(true);
  });
  it('rejects a non-PDF (e.g. an EXE) declared as application/pdf', () => {
    expect(contentMatchesMime(evil, 'application/pdf')).toBe(false);
  });
  it('rejects an EXE declared as image/png', () => {
    expect(contentMatchesMime(evil, 'image/png')).toBe(false);
    expect(contentMatchesMime(png, 'image/png')).toBe(true);
  });
  it('allows text types without a signature', () => {
    expect(contentMatchesMime(Buffer.from('a,b,c\n1,2,3'), 'text/csv')).toBe(true);
  });
});
