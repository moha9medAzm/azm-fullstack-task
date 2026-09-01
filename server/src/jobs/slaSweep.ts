import type { PrismaClient } from '@prisma/client';
import { prisma } from '../db/prisma';
import { env } from '../config/env';
import { logger } from '../lib/logger';
import { bumpPriority, recomputeSlaOnPriorityChange } from '../lib/sla';
import type { TicketPriority } from '../types/enums';

export type SlaSweepResult = {
  responseBreachesFlagged: number;
  resolutionBreachesEscalated: number;
};

/**
 * SPEC §4.5 — automatic escalation sweep. Pure-ish: takes `now` and a Prisma
 * client so it is deterministic and testable against a real (test) database
 * without wall-clock flakiness.
 *
 * Idempotent by construction:
 *  - a response breach is flagged once per ticket (guarded by checking for an
 *    existing SLA_RESPONSE_BREACHED event before writing another).
 *  - a resolution breach only matches tickets with `isEscalated: false`; once
 *    escalated here, the same ticket is excluded from the next run, and its
 *    `slaResolutionDueAt` has also moved out per the new (higher) priority.
 */
export async function runSlaSweep(opts: { now: Date; client?: PrismaClient }): Promise<SlaSweepResult> {
  const client = opts.client ?? prisma;
  const { now } = opts;

  const responseCandidates = await client.ticket.findMany({
    where: { firstRespondedAt: null, slaResponseDueAt: { lt: now } },
    select: { id: true },
  });

  let responseBreachesFlagged = 0;
  for (const t of responseCandidates) {
    const already = await client.ticketEvent.findFirst({
      where: { ticketId: t.id, type: 'SLA_RESPONSE_BREACHED' },
    });
    if (already) continue;
    await client.ticketEvent.create({
      data: { ticketId: t.id, type: 'SLA_RESPONSE_BREACHED', note: 'Response SLA target missed' },
    });
    responseBreachesFlagged += 1;
  }

  const resolutionCandidates = await client.ticket.findMany({
    where: { resolvedAt: null, isEscalated: false, slaResolutionDueAt: { lt: now } },
  });

  let resolutionBreachesEscalated = 0;
  for (const t of resolutionCandidates) {
    const newPriority = bumpPriority(t.priority as TicketPriority);
    const { slaResolutionDueAt } = recomputeSlaOnPriorityChange(
      newPriority,
      t.createdAt,
      t.firstRespondedAt,
      t.slaResponseDueAt,
    );
    await client.ticket.update({
      where: { id: t.id },
      data: { isEscalated: true, priority: newPriority, slaResolutionDueAt },
    });
    await client.ticketEvent.create({
      data: { ticketId: t.id, type: 'SLA_RESOLUTION_BREACHED', note: 'Resolution SLA target missed — auto-escalated' },
    });
    await client.ticketEvent.create({
      data: { ticketId: t.id, type: 'ESCALATED', field: 'priority', fromValue: t.priority, toValue: newPriority },
    });
    resolutionBreachesEscalated += 1;
  }

  return { responseBreachesFlagged, resolutionBreachesEscalated };
}

/** Scheduler wrapper for `index.ts`. Returns a stop function. */
export function startSlaSweep(): () => void {
  if (env.SLA_SWEEP_MS <= 0) {
    logger.info('SLA sweep disabled (SLA_SWEEP_MS=0)');
    return () => {};
  }

  const tick = () => {
    runSlaSweep({ now: new Date() })
      .then((result) => {
        if (result.responseBreachesFlagged || result.resolutionBreachesEscalated) {
          logger.info('SLA sweep', result);
        }
      })
      .catch((err) => logger.error('SLA sweep failed', { message: (err as Error).message }));
  };

  const handle = setInterval(tick, env.SLA_SWEEP_MS);
  handle.unref?.();
  logger.info('SLA sweep scheduled', { everyMs: env.SLA_SWEEP_MS });
  return () => clearInterval(handle);
}
