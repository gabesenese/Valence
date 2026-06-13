import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import * as controller from './backup.controller';

const router = Router();
router.use(authenticate);

router.get('/', controller.list);
router.post('/', controller.create);
router.get('/:id/download', controller.download);
router.post('/:id/restore', controller.restore);
router.delete('/:id', controller.remove);

export { router as backupRouter };
