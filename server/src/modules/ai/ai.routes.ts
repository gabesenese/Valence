import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { insightEngine, riskEvaluator } from './ai.service';
import { extractLeaseFromPDF } from './lease-extractor.service';
import { verifyLeaseDocument } from './lease-verification.service';
import { applyExtractedLease } from './lease-apply.service';
import { extractPropertyFromPDF } from './property-extractor.service';
import { generateExecutiveBrief } from './executive-brief.service';
import { computeHealthScore } from './health-score.service';
import { runSimulation, getActiveTenantsForSimulator, getSimulatorOptions } from './scenario-simulator.service';
import { authenticate } from '../../middleware/authenticate';
import { requireOwner } from '../../middleware/ownership';
import { aiLimiter } from '../../middleware/rateLimits';
import { planGate, resolveEffectivePlan } from '../../middleware/planGate';
import { trackUsage, enforceUsageLimit } from '../plans/plans.service';
import { sendSuccess } from '../../utils/response';
import type { UsageType } from '@prisma/client';

const router = Router();
router.use(authenticate);
router.use(aiLimiter);


const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'application/pdf') cb(null, true);
    else cb(new Error('Only PDF files are accepted'));
  },
});


function meterUsage(type: UsageType) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const plan = resolveEffectivePlan(req.user?.plan ?? 'FREE', req.user?.trialEndsAt ?? null);
      await enforceUsageLimit(plan, req.user!.id, type);
      res.on('finish', () => {
        if (res.statusCode < 400) void trackUsage(req.user!.id, type);
      });
      next();
    } catch (e) { next(e); }
  };
}

router.post('/extract-lease', planGate('ESSENTIALS'), meterUsage('CONTRACT_PROCESSING'), upload.single('file'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.file) return next(new Error('No file uploaded'));
    const result = await extractLeaseFromPDF(req.file.buffer);
    sendSuccess(res, result);
  } catch (e) { next(e); }
});

router.post('/leases/:id/verify-document', planGate('ESSENTIALS'), meterUsage('CONTRACT_PROCESSING'), requireOwner('lease'), upload.single('file'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.file) return next(new Error('No file uploaded'));
    const result = await verifyLeaseDocument(req.params.id, req.user!.id, req.file.buffer);
    sendSuccess(res, result);
  } catch (e) { next(e); }
});

router.post('/leases/:id/apply-extracted', planGate('ESSENTIALS'), requireOwner('lease'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const fields = (req.body?.fields ?? {}) as Record<string, unknown>;
    sendSuccess(res, await applyExtractedLease(req.params.id, req.user!.id, fields));
  } catch (e) { next(e); }
});

router.post('/extract-property', planGate('ESSENTIALS'), meterUsage('CONTRACT_PROCESSING'), upload.single('file'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.file) return next(new Error('No file uploaded'));
    const result = await extractPropertyFromPDF(req.file.buffer);
    sendSuccess(res, result);
  } catch (e) { next(e); }
});


router.get('/executive-brief', planGate('EXECUTIVE'), async (req: Request, res: Response, next: NextFunction) => {
  try { sendSuccess(res, await generateExecutiveBrief(req.user!.id)); } catch (e) { next(e); }
});


router.get('/health-score', planGate('PROFESSIONAL'), async (req: Request, res: Response, next: NextFunction) => {
  try { sendSuccess(res, await computeHealthScore(req.user!.id)); } catch (e) { next(e); }
});


router.post('/simulate', planGate('ESSENTIALS'), meterUsage('IMPACT_SIMULATION'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    sendSuccess(res, await runSimulation(req.body, req.user!.id));
  } catch (e) { next(e); }
});

router.get('/simulate/tenants', async (req: Request, res: Response, next: NextFunction) => {
  try { sendSuccess(res, await getActiveTenantsForSimulator(req.user!.id)); } catch (e) { next(e); }
});

router.get('/simulate/options', async (req: Request, res: Response, next: NextFunction) => {
  try { sendSuccess(res, await getSimulatorOptions(req.user!.id)); } catch (e) { next(e); }
});


router.get('/insights/portfolio', planGate('ESSENTIALS'), meterUsage('AI_ANALYSIS'), async (_req: Request, res: Response, next: NextFunction) => {
  try { sendSuccess(res, await insightEngine.analyzePortfolio()); } catch (e) { next(e); }
});

router.get('/insights/property/:id', planGate('ESSENTIALS'), meterUsage('AI_ANALYSIS'), requireOwner('property'), async (req: Request, res: Response, next: NextFunction) => {
  try { sendSuccess(res, await insightEngine.analyzeProperty(req.params.id)); } catch (e) { next(e); }
});

router.get('/insights/lease/:id', planGate('ESSENTIALS'), meterUsage('AI_ANALYSIS'), requireOwner('lease'), async (req: Request, res: Response, next: NextFunction) => {
  try { sendSuccess(res, await insightEngine.analyzeLease(req.params.id)); } catch (e) { next(e); }
});


router.get('/risk/lease/:id', planGate('ESSENTIALS'), meterUsage('AI_ANALYSIS'), requireOwner('lease'), async (req: Request, res: Response, next: NextFunction) => {
  try { sendSuccess(res, await riskEvaluator.evaluateLeaseRisk(req.params.id)); } catch (e) { next(e); }
});

router.get('/risk/portfolio', planGate('ESSENTIALS'), meterUsage('AI_ANALYSIS'), async (_req: Request, res: Response, next: NextFunction) => {
  try { sendSuccess(res, await riskEvaluator.evaluatePortfolioRisk()); } catch (e) { next(e); }
});

export { router as aiRouter };
