import { env } from '../config/env';
import { logger } from '../lib/logger';

/**
 * Background SLA sweep. Fleshed out in Phase 4 — for now the scheduler wrapper
 * exists so `index.ts` has a stable contract.
 */
export function startSlaSweep(): () => void {
  if (env.SLA_SWEEP_MS <= 0) {
    logger.info('SLA sweep disabled (SLA_SWEEP_MS=0)');
    return () => {};
  }
  const handle = setInterval(() => {
    // Phase 4: runSlaSweep({ now: new Date(), prisma })
  }, env.SLA_SWEEP_MS);
  handle.unref?.();
  logger.info('SLA sweep scheduled', { everyMs: env.SLA_SWEEP_MS });
  return () => clearInterval(handle);
}
