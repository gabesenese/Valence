import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import { requireOwner } from '../../middleware/ownership';
import { uploadLimiter } from '../../middleware/rateLimits';
import { assertPropertyOwner, assertLeaseOwner, assertTenantOwner } from '../../utils/ownership';
import { sendSuccess } from '../../utils/response';
import {
  createDocument,
  getDocuments,
  getDocument,
  getDocumentFile,
  deleteDocument,
} from './documents.service';
import { putDocument, readDocument } from './storage';
import type { DocumentType } from '@prisma/client';


const storage = multer.memoryStorage();

const MAX_FILE_BYTES = 25 * 1024 * 1024;

const ALLOWED_MIME = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
  'text/csv',
  'image/png',
  'image/jpeg',
  'image/webp',
]);

const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_BYTES },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME.has(file.mimetype)) cb(null, true);
    else cb(new Error(`Unsupported file type "${file.mimetype}". Allowed: PDF, Word, Excel, CSV, text, or images.`));
  },
});

function uploadSingle(req: Request, res: Response, next: NextFunction): void {
  upload.single('file')(req, res, (err: unknown) => {
    if (err instanceof multer.MulterError) {
      const message = err.code === 'LIMIT_FILE_SIZE' ? 'File exceeds the 25 MB limit.' : 'Upload failed.';
      res.status(400).json({ success: false, message });
      return;
    }
    if (err) {
      res.status(400).json({ success: false, message: (err as Error).message });
      return;
    }
    next();
  });
}


const router = Router();
router.use(authenticate);

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { propertyId, leaseId, tenantId, type } = req.query as Record<string, string | undefined>;
    const docs = await getDocuments({
      propertyId,
      leaseId,
      tenantId,
      type: type as DocumentType | undefined,
    }, req.user!.id);
    sendSuccess(res, docs);
  } catch (e) { next(e); }
});

router.post(
  '/',
  uploadLimiter,
  authorize('ANALYST'),
  uploadSingle,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.file) {
        res.status(400).json({ success: false, message: 'No file uploaded' });
        return;
      }

      const { type, propertyId, leaseId, tenantId, name } = req.body as {
        type?: DocumentType;
        propertyId?: string;
        leaseId?: string;
        tenantId?: string;
        name?: string;
      };

      if (propertyId) await assertPropertyOwner(propertyId, req.user!.id);
      if (leaseId) await assertLeaseOwner(leaseId, req.user!.id);
      if (tenantId) await assertTenantOwner(tenantId, req.user!.id);

      const validTypes: DocumentType[] = [
        'LEASE', 'INSURANCE', 'INSPECTION', 'PERMIT',
        'AMENDMENT', 'NOTICE', 'FINANCIAL', 'OTHER',
      ];
      const docType = validTypes.includes(type as DocumentType) ? (type as DocumentType) : 'OTHER';

      const ref = await putDocument(req.file.originalname, req.file.buffer, req.file.mimetype);

      const doc = await createDocument({
        name: name?.trim() || req.file.originalname,
        originalName: req.file.originalname,
        type: docType,
        mimeType: req.file.mimetype,
        size: req.file.size,
        path: ref,
        propertyId,
        leaseId,
        tenantId,
        uploadedById: req.user!.id,
      });

      res.status(201).json({ success: true, data: doc });
    } catch (e) { next(e); }
  },
);

router.get('/:id', requireOwner('document'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const doc = await getDocument(req.params.id);
    sendSuccess(res, doc);
  } catch (e) { next(e); }
});

router.get('/:id/download', requireOwner('document'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const file = await getDocumentFile(req.params.id);
    const { stream, contentType } = await readDocument(file.path);
    res.setHeader('Content-Type', contentType ?? file.mimeType);
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(file.originalName)}"`);
    stream.on('error', next);
    stream.pipe(res);
  } catch (e) { next(e); }
});

router.delete('/:id', authorize('ANALYST'), requireOwner('document'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await deleteDocument(req.params.id);
    sendSuccess(res, result);
  } catch (e) { next(e); }
});

export { router as documentsRouter };
