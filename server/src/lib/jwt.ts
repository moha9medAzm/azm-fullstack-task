import jwt from 'jsonwebtoken';
import type { Role } from '../types/enums';
import { env } from '../config/env';
import { UnauthenticatedError } from './errors';

export type TokenPayload = {
  sub: string;
  email: string;
  role: Role;
};

export function signToken(payload: TokenPayload): string {
  return jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN,
  } as jwt.SignOptions);
}

export function verifyToken(token: string): TokenPayload {
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET);
    if (
      typeof decoded !== 'object' ||
      decoded === null ||
      typeof (decoded as Record<string, unknown>).sub !== 'string'
    ) {
      throw new Error('malformed payload');
    }
    const d = decoded as Record<string, unknown>;
    return { sub: d.sub as string, email: d.email as string, role: d.role as Role };
  } catch {
    throw new UnauthenticatedError('Invalid or expired token');
  }
}
