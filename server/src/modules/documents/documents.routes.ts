import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import path from 'path';
import { v4 as uuid } from 'uuid';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import { sendSuccess } from '../../utils/response';
import {
  createDocument,
  getDocuments,
  getDocument,
  deleteDocument,
} from './documents.service';
import type { DocumentType } from '@prisma/client';


const UPLOAD_DIR = path.resolve('uploads/documents');

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuid()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 }, // 25 MB
});


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
    });
    sendSuccess(res, docs);
  } catch (e) { next(e); }
});

router.post(
  '/',
  authorize('ANALYST'),
  upload.single('file'),
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

      const validTypes: DocumentType[] = [
        'LEASE', 'INSURANCE', 'INSPECTION', 'PERMIT',
        'AMENDMENT', 'NOTICE', 'FINANCIAL', 'OTHER',
      ];
      const docType = validTypes.includes(type as DocumentType) ? (type as DocumentType) : 'OTHER';

      const doc = await createDocument({
        name: name?.trim() || req.file.originalname,
        originalName: req.file.originalname,
        type: docType,
        mimeType: req.file.mimetype,
        size: req.file.size,
        path: req.file.path,
        propertyId,
        leaseId,
        tenantId,
        uploadedById: req.user!.id,
      });

      res.status(201).json({ success: true, data: doc });
    } catch (e) { next(e); }
  },
);

router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const doc = await getDocument(req.params.id);
    sendSuccess(res, doc);
  } catch (e) { next(e); }
});

router.delete('/:id', authorize('ADMIN'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await deleteDocument(req.params.id);
    sendSuccess(res, result);
  } catch (e) { next(e); }
});

export { router as documentsRouter };
