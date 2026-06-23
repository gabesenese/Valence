import { Router } from 'express';
import * as controller from './changes.controller';
import { authenticate } from '../../middleware/authenticate';

const router = Router();

router.use(authenticate);

router.get('/since', controller.since);
router.post('/seen', controller.seen);

export { router as changesRouter };
