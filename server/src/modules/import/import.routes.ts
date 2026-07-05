import { Router } from 'express';
import multer from 'multer';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import { uploadLimiter } from '../../middleware/rateLimits';
import { importPropertiesHandler, importTenantsHandler, importLeasesHandler, importExpensesHandler } from './import.controller';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: (_req, file, cb) => {
    const name = file.originalname.toLowerCase();
    if (/\.(csv|txt|tsv|xlsx)$/.test(name) || file.mimetype === 'text/csv') {
      cb(null, true);
    } else {
      cb(new Error('Only CSV, TXT, or Excel (.xlsx) files are accepted'));
    }
  },
});

export const importRouter = Router();

importRouter.use(authenticate);
importRouter.use(uploadLimiter);

importRouter.post('/properties', authorize('ANALYST'), upload.single('csv'), importPropertiesHandler);
importRouter.post('/tenants',    authorize('ANALYST'), upload.single('csv'), importTenantsHandler);
importRouter.post('/leases',     authorize('ANALYST'), upload.single('csv'), importLeasesHandler);
importRouter.post('/expenses',   authorize('ANALYST'), upload.single('csv'), importExpensesHandler);
