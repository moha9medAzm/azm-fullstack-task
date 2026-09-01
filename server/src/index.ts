import { createApp } from './app';
import { env } from './config/env';
import { logger } from './lib/logger';
import { prisma } from './db/prisma';
import { startSlaSweep } from './jobs/slaSweep';

const app = createApp();

const server = app.listen(env.PORT, () => {
  logger.info(`API listening on http://localhost:${env.PORT}`, { env: env.NODE_ENV });
});

const stopSweep = startSlaSweep();

async function shutdown(signal: string) {
  logger.info(`Received ${signal}, shutting down`);
  stopSweep();
  server.close(() => logger.info('HTTP server closed'));
  await prisma.$disconnect();
  process.exit(0);
}

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
