import type { RequestHandler } from 'express';
import { ZodError, type ZodTypeAny, type infer as ZodInfer } from 'zod';
import { ValidationError, type ErrorDetail } from '../lib/errors';

type Schemas = {
  body?: ZodTypeAny;
  query?: ZodTypeAny;
  params?: ZodTypeAny;
};

function toDetails(err: ZodError, prefix: string): ErrorDetail[] {
  return err.issues.map((i) => ({
    path: [prefix, ...i.path.map(String)].filter(Boolean).join('.'),
    message: i.message,
  }));
}

/**
 * Parse request parts against Zod schemas. On success the parsed, typed values
 * are placed on `req.valid`; handlers should read from there, never from the
 * raw `req.body` / `req.query`. On failure a single 400 VALIDATION_ERROR is
 * thrown carrying every issue.
 */
export function validate(schemas: Schemas): RequestHandler {
  return (req, _res, next) => {
    const details: ErrorDetail[] = [];
    const valid: { body?: unknown; query?: unknown; params?: unknown } = {};

    for (const key of ['body', 'query', 'params'] as const) {
      const schema = schemas[key];
      if (!schema) continue;
      const result = schema.safeParse(req[key]);
      if (result.success) {
        valid[key] = result.data;
      } else {
        details.push(...toDetails(result.error, key));
      }
    }

    if (details.length > 0) {
      next(new ValidationError(details));
      return;
    }

    req.valid = valid;
    next();
  };
}

export type Infer<S extends ZodTypeAny> = ZodInfer<S>;
