import { prisma } from '../../db/prisma';
import { verifyPassword } from '../../lib/password';
import { signToken } from '../../lib/jwt';
import { UnauthenticatedError } from '../../lib/errors';
import type { Role } from '../../types/enums';
import type { loginSchema } from './auth.schemas';
import type { z } from 'zod';

export function toPublicUser(user: {
  id: string;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
}) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role as Role,
    isActive: user.isActive,
  };
}

export async function login(input: z.infer<typeof loginSchema>) {
  const user = await prisma.user.findUnique({ where: { email: input.email } });
  // Same error for "no such user" and "wrong password" — don't leak which one.
  if (!user || !user.isActive) {
    throw new UnauthenticatedError('Invalid email or password');
  }
  const ok = await verifyPassword(input.password, user.passwordHash);
  if (!ok) {
    throw new UnauthenticatedError('Invalid email or password');
  }
  const token = signToken({ sub: user.id, email: user.email, role: user.role as Role });
  return { token, user: toPublicUser(user) };
}
