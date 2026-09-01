import type { Role } from './enums';

declare global {
  namespace Express {
    interface Request {
      /** Populated by `validate()` — parsed, typed request parts. */
      valid: {
        body?: unknown;
        query?: unknown;
        params?: unknown;
      };
      /** Populated by `authenticate` on protected routes. */
      user?: {
        id: string;
        email: string;
        role: Role;
      };
    }
  }
}

export {};
