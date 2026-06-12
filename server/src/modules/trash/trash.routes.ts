import { Router } from 'express';
import * as controller from './trash.controller';
import { authenticate } from '../../middleware/authenticate';

const router = Router();

router.use(authenticate);

router.get('/', controller.list);
router.post('/:type/:id/restore', controller.restore);
router.delete('/empty', controller.empty);
router.delete('/:type/:id', controller.purge);

export { router as trashRouter };
