import { Router } from 'express';
import * as controller from './properties.controller';
import { validate } from '../../middleware/validate';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import { requireOwner } from '../../middleware/ownership';
import { createPropertySchema, updatePropertySchema, propertyQuerySchema } from './properties.schemas';

const router = Router();

router.use(authenticate);

router.get('/summary', controller.summary);
router.get('/', validate(propertyQuerySchema, 'query'), controller.list);
router.get('/:id', requireOwner('property'), controller.show);
router.get('/:id/activity', requireOwner('property'), controller.activity);
router.post('/', authorize('ADMIN'), validate(createPropertySchema), controller.create);
router.patch('/:id', authorize('ADMIN'), requireOwner('property'), validate(updatePropertySchema), controller.update);
router.delete('/:id', requireOwner('property'), controller.remove);

export { router as propertiesRouter };
