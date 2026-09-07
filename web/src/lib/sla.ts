import type { Ticket } from '../api/types';

export type SlaTone = 'ok' | 'warn' | 'danger';

export const SLA_TONE_LABEL: Record<SlaTone, string> = {
  ok: 'On track',
  warn: 'Due soon',
  danger: 'Breached',
};

/**
 * Client-side mirror of the server's breach math, used only to pick a badge
 * colour — the server's `slaResolutionBreached` / `slaResponseBreached`
 * booleans (computed at request time) remain the source of truth for "is it
 * actually breached".
 */
export function slaTone(remainingMs: number, totalMs: number, breached: boolean): SlaTone {
  if (breached) return 'danger';
  if (totalMs <= 0) return 'warn';
  const fraction = remainingMs / totalMs;
  if (fraction < 0.25) return 'warn';
  return 'ok';
}

export function resolutionSla(ticket: Ticket) {
  const totalMs =
    new Date(ticket.slaResolutionDueAt).getTime() - new Date(ticket.createdAt).getTime();
  return {
    tone: slaTone(ticket.slaResolutionRemainingMs, totalMs, ticket.slaResolutionBreached),
    breached: ticket.slaResolutionBreached,
  };
}

export function responseSla(ticket: Ticket) {
  const totalMs =
    new Date(ticket.slaResponseDueAt).getTime() - new Date(ticket.createdAt).getTime();
  return {
    tone: slaTone(ticket.slaResponseRemainingMs, totalMs, ticket.slaResponseBreached),
    breached: ticket.slaResponseBreached,
  };
}
