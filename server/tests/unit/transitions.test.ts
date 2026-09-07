import { describe, it, expect } from 'vitest';
import {
  assertTransition,
  isTransitionAllowed,
  isReopen,
} from '../../src/modules/tickets/transitions';
import { TICKET_STATUSES, type TicketStatus } from '../../src/types/enums';

describe('ticket status transitions', () => {
  it('allows moving freely between active statuses', () => {
    const active: TicketStatus[] = ['OPEN', 'IN_PROGRESS', 'PENDING'];
    for (const from of active) {
      for (const to of active) {
        expect(isTransitionAllowed(from, to)).toBe(true);
      }
    }
  });

  it('allows any active status to move to RESOLVED', () => {
    for (const from of ['OPEN', 'IN_PROGRESS', 'PENDING'] as TicketStatus[]) {
      expect(isTransitionAllowed(from, 'RESOLVED')).toBe(true);
    }
  });

  it('rejects an active status moving straight to CLOSED', () => {
    for (const from of ['OPEN', 'IN_PROGRESS', 'PENDING'] as TicketStatus[]) {
      expect(isTransitionAllowed(from, 'CLOSED')).toBe(false);
      expect(() => assertTransition(from, 'CLOSED')).toThrowError(/INVALID_TRANSITION|Cannot move/);
    }
  });

  it('allows RESOLVED -> CLOSED', () => {
    expect(isTransitionAllowed('RESOLVED', 'CLOSED')).toBe(true);
  });

  it('rejects CLOSED -> RESOLVED directly', () => {
    expect(isTransitionAllowed('CLOSED', 'RESOLVED')).toBe(false);
  });

  it('allows reopening RESOLVED or CLOSED back to any active status', () => {
    for (const from of ['RESOLVED', 'CLOSED'] as TicketStatus[]) {
      for (const to of ['OPEN', 'IN_PROGRESS', 'PENDING'] as TicketStatus[]) {
        expect(isTransitionAllowed(from, to)).toBe(true);
        expect(isReopen(from, to)).toBe(true);
      }
    }
  });

  it('treats same-status as a no-op, not a reopen', () => {
    for (const s of TICKET_STATUSES) {
      expect(isTransitionAllowed(s, s)).toBe(true);
      expect(isReopen(s, s)).toBe(false);
    }
  });

  it('does not throw for the exact acceptance-criteria example (OPEN -> CLOSED)', () => {
    expect(() => assertTransition('OPEN', 'IN_PROGRESS')).not.toThrow();
    expect(() => assertTransition('OPEN', 'CLOSED')).toThrow();
  });
});
