import { PrismaClient } from '@prisma/client';
import { env } from '../config/env';

/**
 * Single PrismaClient for the process. In dev, `tsx watch` reloads the module
 * graph on change; stash the client on `globalThis` so we don't leak
 * connections across reloads.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

if (env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

export type { PrismaClient };
