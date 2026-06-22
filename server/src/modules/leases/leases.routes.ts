import { Router } from 'express';
import * as controller from './leases.controller';
import { validate } from '../../middleware/validate';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import { requireOwner } from '../../middleware/ownership';
import {
  createLeaseSchema, updateLeaseSchema, leaseQuerySchema,
  setRenewalDateSchema, assignOwnerSchema, snoozeSchema,
  advanceStageSchema, bulkActionSchema, addNoteSchema,
} from './leases.schemas';

const router = Router();

router.use(authenticate);

router.get('/stats', controller.stats);
router.get('/priority-queue', controller.priorityQueue);
router.get('/kanban', controller.kanban);
router.get('/', validate(leaseQuerySchema, 'query'), controller.list);

router.post('/bulk', authorize('ANALYST'), validate(bulkActionSchema), controller.bulk);

router.get('/:id', requireOwner('lease'), controller.show);
router.get('/:id/preview', requireOwner('lease'), controller.preview);
router.get('/:id/activity', requireOwner('lease'), controller.activity);
router.get('/:id/notes', requireOwner('lease'), controller.notes);
router.post('/', authorize('ANALYST'), validate(createLeaseSchema), controller.create);
router.patch('/:id', authorize('ANALYST'), requireOwner('lease'), validate(updateLeaseSchema), controller.update);
router.delete('/:id', authorize('ANALYST'), requireOwner('lease'), controller.remove);

router.post('/:id/start-renewal', authorize('ANALYST'), requireOwner('lease'), controller.startRenewal);
router.post('/:id/set-renewal-date', authorize('ANALYST'), requireOwner('lease'), validate(setRenewalDateSchema), controller.setRenewalDate);
router.post('/:id/clear-renewal-date', authorize('ANALYST'), requireOwner('lease'), controller.clearRenewalDate);
router.post('/:id/assign-owner', authorize('ANALYST'), requireOwner('lease'), validate(assignOwnerSchema), controller.assignOwner);
router.post('/:id/mark-contacted', authorize('ANALYST'), requireOwner('lease'), controller.markContacted);
router.post('/:id/snooze', authorize('ANALYST'), requireOwner('lease'), validate(snoozeSchema), controller.snooze);
router.post('/:id/advance-stage', authorize('ANALYST'), requireOwner('lease'), validate(advanceStageSchema), controller.advanceStage);
router.post('/:id/notes', authorize('ANALYST'), requireOwner('lease'), validate(addNoteSchema), controller.addNote);
router.patch('/:id/notes/:noteId', authorize('ANALYST'), requireOwner('lease'), validate(addNoteSchema), controller.editNote);
router.delete('/:id/notes/:noteId', authorize('ANALYST'), requireOwner('lease'), controller.deleteNote);

export { router as leasesRouter };
