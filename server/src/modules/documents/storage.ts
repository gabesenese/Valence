import { createReadStream } from 'fs';
import { mkdir, unlink, writeFile } from 'fs/promises';
import path from 'path';
import { Readable } from 'stream';
import { v4 as uuid } from 'uuid';
import { env } from '../../config/env';
import { logger } from '../../utils/logger';

const useBlob = Boolean(env.BLOB_READ_WRITE_TOKEN);
const DISK_DIR = path.resolve('uploads/documents');

// Fail loud, not silent: on a production (serverless) deploy the local disk is
// ephemeral, so without a Blob token every uploaded document is lost on the next
// cold start or redeploy. Warn at load so a missing token is a visible
// misconfiguration instead of silent data loss. See issue #163.
if (!useBlob && env.NODE_ENV === 'production') {
  logger.error(
    'Document storage: BLOB_READ_WRITE_TOKEN is not set in production — uploads fall back to ephemeral local disk and WILL be lost on redeploy/cold start. Provision a Vercel Blob store and set BLOB_READ_WRITE_TOKEN.',
  );
}

function isRemote(ref: string): boolean {
  return /^https?:\/\//i.test(ref);
}

export async function putDocument(originalName: string, buffer: Buffer, contentType: string): Promise<string> {
  const ext = path.extname(originalName);
  if (useBlob) {
    const { put } = await import('@vercel/blob');
    const { url } = await put(`documents/${uuid()}${ext}`, buffer, {
      access: 'public',
      contentType,
      addRandomSuffix: false,
      token: env.BLOB_READ_WRITE_TOKEN,
    });
    return url;
  }
  await mkdir(DISK_DIR, { recursive: true });
  const filePath = path.join(DISK_DIR, `${uuid()}${ext}`);
  await writeFile(filePath, buffer);
  return filePath;
}

export async function removeDocument(ref: string): Promise<void> {
  try {
    if (isRemote(ref)) {
      const { del } = await import('@vercel/blob');
      await del(ref, { token: env.BLOB_READ_WRITE_TOKEN });
    } else {
      await unlink(path.resolve(ref));
    }
  } catch { /* already gone */ }
}

export async function readDocument(ref: string): Promise<{ stream: Readable; contentType?: string }> {
  if (isRemote(ref)) {
    const res = await fetch(ref);
    if (!res.ok || !res.body) throw new Error('File not found in storage');
    return {
      stream: Readable.fromWeb(res.body as Parameters<typeof Readable.fromWeb>[0]),
      contentType: res.headers.get('content-type') ?? undefined,
    };
  }
  return { stream: createReadStream(path.resolve(ref)) };
}
