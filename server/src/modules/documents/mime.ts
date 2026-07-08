/*
 * Content-vs-claimed-MIME verification for uploads. The multipart mimetype is
 * attacker-controlled, so we confirm the bytes actually match for the binary
 * types we accept. Text types (plain/csv) have no reliable signature and are
 * allowed through (they can't be executed by the private, authenticated
 * download path anyway).
 */
const OLE = Buffer.from([0xd0, 0xcf, 0x11, 0xe0]);
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const SIGNATURES: Record<string, (b: Buffer) => boolean> = {
  'application/pdf': (b) => b.subarray(0, 5).toString('latin1') === '%PDF-',
  'image/png': (b) => b.subarray(0, 8).equals(PNG),
  'image/jpeg': (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  'image/webp': (b) => b.subarray(0, 4).toString('latin1') === 'RIFF' && b.subarray(8, 12).toString('latin1') === 'WEBP',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': (b) => b[0] === 0x50 && b[1] === 0x4b,
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': (b) => b[0] === 0x50 && b[1] === 0x4b,
  'application/msword': (b) => b.subarray(0, 4).equals(OLE),
  'application/vnd.ms-excel': (b) => b.subarray(0, 4).equals(OLE),
};

export function contentMatchesMime(buffer: Buffer, mimetype: string): boolean {
  const check = SIGNATURES[mimetype];
  if (!check) return true;
  return buffer.length >= 12 && check(buffer);
}
