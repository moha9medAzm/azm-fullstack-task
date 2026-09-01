import { ConflictError } from '../../lib/errors';
import type { TicketStatus } from '../../types/enums';

export const ACTIVE_STATUSES: TicketStatus[] = ['OPEN', 'IN_PROGRESS', 'PENDING'];

/**
 * SPEC §4.2 status lifecycle:
 *
 *   OPEN <-> IN_PROGRESS <-> PENDING  (any active status reachable from any other)
 *   any active -> RESOLVED
 *   RESOLVED -> CLOSED
 *   RESOLVED or CLOSED -> any active status ("reopen")
 *
 * Not allowed: any active -> CLOSED directly, CLOSED -> RESOLVED directly.
 */
const ALLOWED_TRANSITIONS: Record<TicketStatus, TicketStatus[]> = {
  OPEN: ['IN_PROGRESS', 'PENDING', 'RESOLVED'],
  IN_PROGRESS: ['OPEN', 'PENDING', 'RESOLVED'],
  PENDING: ['OPEN', 'IN_PROGRESS', 'RESOLVED'],
  RESOLVED: ['OPEN', 'IN_PROGRESS', 'PENDING', 'CLOSED'],
  CLOSED: ['OPEN', 'IN_PROGRESS', 'PENDING'],
};

export function isTransitionAllowed(from: TicketStatus, to: TicketStatus): boolean {
  if (from === to) return true; // no-op, handled by caller
  return ALLOWED_TRANSITIONS[from].includes(to);
}

/** Throws `ConflictError('INVALID_TRANSITION', …)` when the move isn't legal. */
export function assertTransition(from: TicketStatus, to: TicketStatus): void {
  if (!isTransitionAllowed(from, to)) {
    throw new ConflictError(
      'INVALID_TRANSITION',
      `Cannot move a ticket from ${from} to ${to}`,
    );
  }
}

/** A move back to an active status from RESOLVED/CLOSED is a "reopen". */
export function isReopen(from: TicketStatus, to: TicketStatus): boolean {
  return (
    (from === 'RESOLVED' || from === 'CLOSED') &&
    from !== to &&
    (ACTIVE_STATUSES as string[]).includes(to)
  );
}
