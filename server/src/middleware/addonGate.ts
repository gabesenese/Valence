import type { Request, Response, NextFunction } from 'express';
import type { AddonKey } from '../modules/plans/addons';
import { hasAddon } from '../modules/plans/plans.service';

export function addonGate(required: AddonKey) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    try {
      if (await hasAddon(userId, required)) return next();
      res.status(402).json({
        error: 'Add-on required',
        requiredAddon: required,
        message: 'This feature requires the Valence Copilot add-on.',
      });
    } catch (err) {
      next(err);
    }
  };
}
