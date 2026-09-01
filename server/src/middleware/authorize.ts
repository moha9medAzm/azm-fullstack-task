import type { RequestHandler } from 'express';
import type { Role } from '../types/enums';
import { ForbiddenError, UnauthenticatedError } from '../lib/errors';

/**
 * Restrict a route to the given roles. Must run after `authenticate`.
 * Pure decision logic lives in `canAccess` so it is unit-testable.
 */
export function canAccess(userRole: Role | undefined, allowed: Role[]): boolean {
  if (!userRole) return false;
  return allowed.includes(userRole);
}

export function authorize(...allowed: Role[]): RequestHandler {
  return (req, _res, next) => {
    if (!req.user) {
      next(new UnauthenticatedError());
      return;
    }
    if (!canAccess(req.user.role, allowed)) {
      next(new ForbiddenError());
      return;
    }
    next();
  };
}
