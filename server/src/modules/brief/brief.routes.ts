import { Router } from 'express';
import * as controller from './brief.controller';
import { authenticate } from '../../middleware/authenticate';

const router = Router();

router.use(authenticate);

router.get('/today', controller.today);

export { router as briefRouter };
