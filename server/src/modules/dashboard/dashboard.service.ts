import { prisma } from '../../db/prisma';
import { TICKET_STATUSES, TICKET_PRIORITIES } from '../../types/enums';
import { ACTIVE_STATUSES } from '../tickets/transitions';

const DAY_MS = 24 * 60 * 60 * 1000;

export async function getDashboardStats(actorId: string) {
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * DAY_MS);

  const [
    statusGroups,
    priorityGroups,
    myOpen,
    unassigned,
    breachingResolution,
    breachingResponse,
    resolvedLast7d,
  ] = await Promise.all([
    prisma.ticket.groupBy({ by: ['status'], _count: { _all: true } }),
    prisma.ticket.groupBy({ by: ['priority'], _count: { _all: true } }),
    prisma.ticket.count({ where: { assigneeId: actorId, status: { in: ACTIVE_STATUSES } } }),
    prisma.ticket.count({ where: { assigneeId: null, status: { in: ACTIVE_STATUSES } } }),
    prisma.ticket.count({ where: { resolvedAt: null, slaResolutionDueAt: { lt: now } } }),
    prisma.ticket.count({ where: { firstRespondedAt: null, slaResponseDueAt: { lt: now } } }),
    prisma.ticket.count({ where: { resolvedAt: { gte: sevenDaysAgo } } }),
  ]);

  const byStatus = Object.fromEntries(TICKET_STATUSES.map((s) => [s, 0])) as Record<string, number>;
  for (const g of statusGroups) byStatus[g.status] = g._count._all;

  const byPriority = Object.fromEntries(TICKET_PRIORITIES.map((p) => [p, 0])) as Record<
    string,
    number
  >;
  for (const g of priorityGroups) byPriority[g.priority] = g._count._all;

  return {
    byStatus,
    byPriority,
    myOpen,
    unassigned,
    breachingResolution,
    breachingResponse,
    resolvedLast7d,
  };
}
