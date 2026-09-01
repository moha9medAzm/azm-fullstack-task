import { TICKET_PRIORITIES, type TicketPriority } from '../types/enums';

const HOUR_MS = 60 * 60 * 1000;

/** SPEC §4.1 — response/resolution targets in hours, keyed by priority. */
export const SLA_TARGETS_HOURS: Record<TicketPriority, { response: number; resolution: number }> = {
  URGENT: { response: 1, resolution: 4 },
  HIGH: { response: 4, resolution: 24 },
  MEDIUM: { response: 8, resolution: 72 },
  LOW: { response: 24, resolution: 168 },
};

/** Bump a priority one level up, capped at URGENT. */
export function bumpPriority(priority: TicketPriority): TicketPriority {
  const idx = TICKET_PRIORITIES.indexOf(priority);
  const next = TICKET_PRIORITIES[Math.min(idx + 1, TICKET_PRIORITIES.length - 1)];
  return next ?? priority;
}

export type SlaDueDates = {
  slaResponseDueAt: Date;
  slaResolutionDueAt: Date;
};

/** Compute both SLA due dates anchored to `anchor` (normally the ticket's createdAt). */
export function computeSlaDueDates(priority: TicketPriority, anchor: Date): SlaDueDates {
  const target = SLA_TARGETS_HOURS[priority];
  return {
    slaResponseDueAt: new Date(anchor.getTime() + target.response * HOUR_MS),
    slaResolutionDueAt: new Date(anchor.getTime() + target.resolution * HOUR_MS),
  };
}

/**
 * Recompute due dates when priority changes mid-life. Per SPEC §4.1: resolution
 * due date always recomputes; response due date only recomputes if the ticket
 * has not been responded to yet (otherwise the already-met/missed response
 * target is left alone).
 */
export function recomputeSlaOnPriorityChange(
  priority: TicketPriority,
  createdAt: Date,
  firstRespondedAt: Date | null,
  currentSlaResponseDueAt: Date,
): SlaDueDates {
  const fresh = computeSlaDueDates(priority, createdAt);
  return {
    slaResponseDueAt: firstRespondedAt ? currentSlaResponseDueAt : fresh.slaResponseDueAt,
    slaResolutionDueAt: fresh.slaResolutionDueAt,
  };
}

export function isResponseBreached(
  now: Date,
  slaResponseDueAt: Date,
  firstRespondedAt: Date | null,
): boolean {
  return firstRespondedAt === null && now.getTime() > slaResponseDueAt.getTime();
}

export function isResolutionBreached(
  now: Date,
  slaResolutionDueAt: Date,
  resolvedAt: Date | null,
): boolean {
  return resolvedAt === null && now.getTime() > slaResolutionDueAt.getTime();
}

export type SlaDerived = {
  slaResponseBreached: boolean;
  slaResolutionBreached: boolean;
  slaResponseRemainingMs: number;
  slaResolutionRemainingMs: number;
};

export function deriveSlaFields(
  now: Date,
  ticket: {
    slaResponseDueAt: Date;
    slaResolutionDueAt: Date;
    firstRespondedAt: Date | null;
    resolvedAt: Date | null;
  },
): SlaDerived {
  return {
    slaResponseBreached: isResponseBreached(now, ticket.slaResponseDueAt, ticket.firstRespondedAt),
    slaResolutionBreached: isResolutionBreached(now, ticket.slaResolutionDueAt, ticket.resolvedAt),
    slaResponseRemainingMs: ticket.slaResponseDueAt.getTime() - now.getTime(),
    slaResolutionRemainingMs: ticket.slaResolutionDueAt.getTime() - now.getTime(),
  };
}
