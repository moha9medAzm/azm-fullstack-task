import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import { asyncHandler } from '../../lib/asyncHandler';
import { runSlaSweep } from '../../jobs/slaSweep';

export const adminRouter = Router();

adminRouter.use(authenticate, authorize('ADMIN'));

// Manual trigger for the SLA sweep — handy for demos and deterministic tests,
// on top of the automatic interval started in index.ts.
adminRouter.post(
  '/run-sla-sweep',
  asyncHandler(async (_req, res) => {
    const result = await runSlaSweep({ now: new Date() });
    res.json(result);
  }),
);
