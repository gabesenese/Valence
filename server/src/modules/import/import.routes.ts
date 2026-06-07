import { Router } from 'express';
import multer from 'multer';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import { importPropertiesHandler, importTenantsHandler, importLeasesHandler } from './import.controller';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are accepted'));
    }
  },
});

export const importRouter = Router();

importRouter.use(authenticate);

importRouter.post('/properties', authorize('ANALYST'), upload.single('csv'), importPropertiesHandler);
importRouter.post('/tenants',    authorize('ANALYST'), upload.single('csv'), importTenantsHandler);
importRouter.post('/leases',     authorize('ANALYST'), upload.single('csv'), importLeasesHandler);
