import type { RequestHandler } from 'express';
import { verifyToken } from '../lib/jwt';
import { UnauthenticatedError } from '../lib/errors';
import { prisma } from '../db/prisma';
import type { Role } from '../types/enums';

/**
 * Require a valid Bearer token. Loads the user fresh so a deactivated account
 * loses access immediately, and populates `req.user`.
 */
export const authenticate: RequestHandler = (req, _res, next) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    next(new UnauthenticatedError('Missing Bearer token'));
    return;
  }
  const token = header.slice('Bearer '.length).trim();

  Promise.resolve()
    .then(async () => {
      const payload = verifyToken(token);
      const user = await prisma.user.findUnique({ where: { id: payload.sub } });
      if (!user || !user.isActive) {
        throw new UnauthenticatedError('Account not found or deactivated');
      }
      req.user = { id: user.id, email: user.email, role: user.role as Role };
      next();
    })
    .catch(next);
};
