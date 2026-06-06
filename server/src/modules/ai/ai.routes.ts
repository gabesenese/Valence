import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { insightEngine, riskEvaluator } from './ai.service';
import { extractLeaseFromPDF } from './lease-extractor.service';
import { generateExecutiveBrief } from './executive-brief.service';
import { computeHealthScore } from './health-score.service';
import { runSimulation, getActiveTenantsForSimulator } from './scenario-simulator.service';
import { authenticate } from '../../middleware/authenticate';
import { sendSuccess } from '../../utils/response';

const router = Router();
router.use(authenticate);

// ─── PDF lease extraction ─────────────────────────────────────────────────────

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'application/pdf') cb(null, true);
    else cb(new Error('Only PDF files are accepted'));
  },
});

router.post('/extract-lease', upload.single('file'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.file) return next(new Error('No file uploaded'));
    const result = await extractLeaseFromPDF(req.file.buffer);
    sendSuccess(res, result);
  } catch (e) { next(e); }
});

// ─── Executive brief ─────────────────────────────────────────────────────────

router.get('/executive-brief', async (_req: Request, res: Response, next: NextFunction) => {
  try { sendSuccess(res, await generateExecutiveBrief()); } catch (e) { next(e); }
});

// ─── Portfolio health score ───────────────────────────────────────────────────

router.get('/health-score', async (_req: Request, res: Response, next: NextFunction) => {
  try { sendSuccess(res, await computeHealthScore()); } catch (e) { next(e); }
});

// ─── Scenario simulator ───────────────────────────────────────────────────────

router.post('/simulate', async (req: Request, res: Response, next: NextFunction) => {
  try { sendSuccess(res, await runSimulation(req.body)); } catch (e) { next(e); }
});

router.get('/simulate/tenants', async (_req: Request, res: Response, next: NextFunction) => {
  try { sendSuccess(res, await getActiveTenantsForSimulator()); } catch (e) { next(e); }
});

// ─── Insights ─────────────────────────────────────────────────────────────────

router.get('/insights/portfolio', async (_req: Request, res: Response, next: NextFunction) => {
  try { sendSuccess(res, await insightEngine.analyzePortfolio()); } catch (e) { next(e); }
});

router.get('/insights/property/:id', async (req: Request, res: Response, next: NextFunction) => {
  try { sendSuccess(res, await insightEngine.analyzeProperty(req.params.id)); } catch (e) { next(e); }
});

router.get('/insights/lease/:id', async (req: Request, res: Response, next: NextFunction) => {
  try { sendSuccess(res, await insightEngine.analyzeLease(req.params.id)); } catch (e) { next(e); }
});

// ─── Risk ─────────────────────────────────────────────────────────────────────

router.get('/risk/lease/:id', async (req: Request, res: Response, next: NextFunction) => {
  try { sendSuccess(res, await riskEvaluator.evaluateLeaseRisk(req.params.id)); } catch (e) { next(e); }
});

router.get('/risk/portfolio', async (_req: Request, res: Response, next: NextFunction) => {
  try { sendSuccess(res, await riskEvaluator.evaluatePortfolioRisk()); } catch (e) { next(e); }
});

export { router as aiRouter };
