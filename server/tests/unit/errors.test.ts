import { describe, it, expect } from 'vitest';
import {
  ValidationError,
  NotFoundError,
  ConflictError,
  ForbiddenError,
  UnauthenticatedError,
} from '../../src/lib/errors';

describe('AppError subclasses', () => {
  it('ValidationError carries details and the standard shape', () => {
    const err = new ValidationError([{ path: 'email', message: 'Invalid email' }]);
    expect(err.status).toBe(400);
    expect(err.toBody()).toEqual({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Request validation failed',
        details: [{ path: 'email', message: 'Invalid email' }],
      },
    });
  });

  it.each([
    [new UnauthenticatedError(), 401, 'UNAUTHENTICATED'],
    [new ForbiddenError(), 403, 'FORBIDDEN'],
    [new NotFoundError('Ticket'), 404, 'NOT_FOUND'],
    [new ConflictError('CUSTOM_CODE', 'custom message'), 409, 'CUSTOM_CODE'],
  ] as const)('%o maps to status %d and code %s', (err, status, code) => {
    expect(err.status).toBe(status);
    expect(err.code).toBe(code);
    expect(err.toBody().error.code).toBe(code);
  });
});
