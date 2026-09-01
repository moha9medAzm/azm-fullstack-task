import type { ErrorRequestHandler, RequestHandler } from 'express';
import { Prisma } from '@prisma/client';
import { AppError, NotFoundError } from '../lib/errors';
import { logger } from '../lib/logger';

/** 404 for any unmatched route. Mount after all routers. */
export const notFoundHandler: RequestHandler = (_req, _res, next) => {
  next(new NotFoundError('Route'));
};

/** Central error handler. Must be the last `app.use`. */
export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof AppError) {
    res.status(err.status).json(err.toBody());
    return;
  }

  // Map the Prisma errors we can meaningfully translate.
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2025') {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Resource not found' } });
      return;
    }
    if (err.code === 'P2002') {
      const target = (err.meta?.target as string[] | undefined)?.join(', ') ?? 'field';
      res.status(409).json({
        error: { code: 'UNIQUE_VIOLATION', message: `A record with this ${target} already exists` },
      });
      return;
    }
    if (err.code === 'P2003') {
      res.status(409).json({
        error: { code: 'FOREIGN_KEY_VIOLATION', message: 'Referenced record does not exist' },
      });
      return;
    }
  }

  logger.error('Unhandled error', {
    message: err instanceof Error ? err.message : String(err),
    stack: err instanceof Error ? err.stack : undefined,
  });

  res.status(500).json({
    error: { code: 'INTERNAL', message: 'An unexpected error occurred' },
  });
};
