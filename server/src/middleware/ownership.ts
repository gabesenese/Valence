import type { Request, Response, NextFunction } from 'express';
import { ownershipAsserters, type OwnedEntity } from '../utils/ownership';

/**
 * Route guard that rejects requests for a record the caller does not own.
 * Apply to any `/:id` (or nested `/:id/...`) route AFTER `authenticate`.
 *
 *   router.get('/:id', requireOwner('lease'), controller.show);
 *   router.patch('/:id/notes/:noteId', requireOwner('lease'), controller.editNote);
 *
 * `param` selects which route param holds the entity id (defaults to `id`).
 */
export function requireOwner(entity: OwnedEntity, param = 'id') {
  return async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    try {
      await ownershipAsserters[entity](req.params[param], req.user!.id);
      next();
    } catch (err) {
      next(err);
    }
  };
}
