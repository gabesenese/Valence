import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { sendSuccess } from '../../utils/response';
import { sendSupportTicket } from '../../lib/email';

const router = Router();
router.use(authenticate);

router.post('/ticket', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { category, subject, message, screenshot, pageUrl, browserInfo } = req.body as {
      category: string;
      subject: string;
      message: string;
      screenshot?: string | null;
      pageUrl?: string | null;
      browserInfo?: string | null;
    };

    if (!category || !subject?.trim() || !message?.trim()) {
      res.status(400).json({ success: false, message: 'category, subject, and message are required' });
      return;
    }

    await sendSupportTicket({
      userName:    `${req.user!.firstName} ${req.user!.lastName}`,
      userEmail:   req.user!.email,
      userId:      req.user!.id,
      category,
      subject:     subject.trim(),
      message:     message.trim(),
      screenshot:  screenshot ?? null,
      pageUrl:     pageUrl ?? null,
      browserInfo: browserInfo ?? null,
      submittedAt: new Date().toISOString(),
    });

    sendSuccess(res, { sent: true });
  } catch (e) { next(e); }
});

export { router as supportRouter };
