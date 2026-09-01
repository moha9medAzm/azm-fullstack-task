import supertest from 'supertest';
import type { Role } from '../../src/types/enums';
import { createApp } from '../../src/app';
import { hashPassword } from '../../src/lib/password';
import { signToken } from '../../src/lib/jwt';
import { prisma } from '../../src/db/prisma';

export const app = createApp();
export const api = supertest(app);

let seq = 0;

/** Create a user and return `{ user, token, auth }` where `auth` is a header tuple. */
export async function makeUser(
  role: Role = 'AGENT',
  overrides: Partial<{ name: string; email: string; password: string; isActive: boolean }> = {},
) {
  seq += 1;
  const password = overrides.password ?? 'Password123!';
  const user = await prisma.user.create({
    data: {
      name: overrides.name ?? `${role} ${seq}`,
      email: overrides.email ?? `${role.toLowerCase()}.${seq}.${Date.now()}@example.com`,
      passwordHash: await hashPassword(password),
      role,
      isActive: overrides.isActive ?? true,
    },
  });
  const token = signToken({ sub: user.id, email: user.email, role: user.role as Role });
  return {
    user,
    password,
    token,
    auth: ['Authorization', `Bearer ${token}`] as [string, string],
  };
}

export async function makeCustomer(
  overrides: Partial<{ name: string; email: string; phone: string; company: string }> = {},
) {
  seq += 1;
  return prisma.customer.create({
    data: {
      name: overrides.name ?? `Customer ${seq}`,
      email: overrides.email ?? `customer.${seq}.${Date.now()}@example.com`,
      phone: overrides.phone,
      company: overrides.company,
    },
  });
}
