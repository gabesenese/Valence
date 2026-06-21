import { Router } from 'express';
import * as controller from './leases.controller';
import { validate } from '../../middleware/validate';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
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

router.get('/:id', controller.show);
router.get('/:id/preview', controller.preview);
router.get('/:id/activity', controller.activity);
router.get('/:id/notes', controller.notes);
router.post('/', authorize('ANALYST'), validate(createLeaseSchema), controller.create);
router.patch('/:id', authorize('ANALYST'), validate(updateLeaseSchema), controller.update);
router.delete('/:id', authorize('ANALYST'), controller.remove);

router.post('/:id/start-renewal', authorize('ANALYST'), controller.startRenewal);
router.post('/:id/set-renewal-date', authorize('ANALYST'), validate(setRenewalDateSchema), controller.setRenewalDate);
router.post('/:id/clear-renewal-date', authorize('ANALYST'), controller.clearRenewalDate);
router.post('/:id/assign-owner', authorize('ANALYST'), validate(assignOwnerSchema), controller.assignOwner);
router.post('/:id/mark-contacted', authorize('ANALYST'), controller.markContacted);
router.post('/:id/snooze', authorize('ANALYST'), validate(snoozeSchema), controller.snooze);
router.post('/:id/advance-stage', authorize('ANALYST'), validate(advanceStageSchema), controller.advanceStage);
router.post('/:id/notes', authorize('ANALYST'), validate(addNoteSchema), controller.addNote);
router.patch('/:id/notes/:noteId', authorize('ANALYST'), validate(addNoteSchema), controller.editNote);
router.delete('/:id/notes/:noteId', authorize('ANALYST'), controller.deleteNote);

export { router as leasesRouter };
