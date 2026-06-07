import { Router } from 'express';
import * as controller from './properties.controller';
import { validate } from '../../middleware/validate';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import { createPropertySchema, updatePropertySchema, propertyQuerySchema } from './properties.schemas';

const router = Router();

router.use(authenticate);

router.get('/summary', controller.summary);
router.get('/', validate(propertyQuerySchema, 'query'), controller.list);
router.get('/:id', controller.show);
router.get('/:id/activity', controller.activity);
router.post('/', authorize('ADMIN'), validate(createPropertySchema), controller.create);
router.patch('/:id', authorize('ADMIN'), validate(updatePropertySchema), controller.update);
router.delete('/:id', authorize('ADMIN'), controller.remove);

export { router as propertiesRouter };
