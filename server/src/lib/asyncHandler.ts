import type { Request, Response, NextFunction, RequestHandler } from 'express';

/**
 * Wrap an async route handler so a rejected promise is forwarded to Express'
 * error pipeline instead of becoming an unhandled rejection.
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>,
): RequestHandler {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
}
