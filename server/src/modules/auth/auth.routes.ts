import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { validate } from '../../middleware/validate';
import { authenticate } from '../../middleware/authenticate';
import { asyncHandler } from '../../lib/asyncHandler';
import { loginSchema } from './auth.schemas';
import { login, toPublicUser } from './auth.service';
import { prisma } from '../../db/prisma';
import { NotFoundError } from '../../lib/errors';

export const authRouter = Router();

// Slow down credential guessing without blocking normal use.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: { code: 'RATE_LIMITED', message: 'Too many login attempts, try again later' } },
});

authRouter.post(
  '/login',
  loginLimiter,
  validate({ body: loginSchema }),
  asyncHandler(async (req, res) => {
    const body = req.valid.body as ReturnType<typeof loginSchema.parse>;
    const result = await login(body);
    res.json(result);
  }),
);

authRouter.get(
  '/me',
  authenticate,
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({ where: { id: req.user!.id } });
    if (!user) throw new NotFoundError('User');
    res.json({ user: toPublicUser(user) });
  }),
);
