import { Router } from 'express';
import { authenticate } from '../../middleware/authenticate';
import { authorize } from '../../middleware/authorize';
import { asyncHandler } from '../../lib/asyncHandler';
import { getDashboardStats } from './dashboard.service';

export const dashboardRouter = Router();

dashboardRouter.get(
  '/stats',
  authenticate,
  authorize('ADMIN', 'AGENT'),
  asyncHandler(async (req, res) => {
    const stats = await getDashboardStats(req.user!.id);
    res.json(stats);
  }),
);
