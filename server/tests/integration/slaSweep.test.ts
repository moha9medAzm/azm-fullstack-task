import { describe, it, expect, beforeEach } from 'vitest';
import { makeUser, makeCustomer } from '../helpers/app';
import { resetDb, prisma } from '../helpers/db';
import { runSlaSweep } from '../../src/jobs/slaSweep';

let agentId: string;
let customerId: string;

beforeEach(async () => {
  await resetDb();
  const agent = await makeUser('AGENT');
  agentId = agent.user.id;
  const customer = await makeCustomer();
  customerId = customer.id;
});

async function makeOverdueTicket(
  overrides: Partial<{
    priority: string;
    firstRespondedAt: Date | null;
    resolvedAt: Date | null;
    isEscalated: boolean;
  }> = {},
) {
  const past = new Date(Date.now() - 60_000);
  return prisma.ticket.create({
    data: {
      reference: `TKT-${Math.random().toString(36).slice(2, 8)}`,
      subject: 's',
      description: 'd',
      customerId,
      createdById: agentId,
      priority: overrides.priority ?? 'MEDIUM',
      slaResponseDueAt: past,
      slaResolutionDueAt: past,
      firstRespondedAt: overrides.firstRespondedAt ?? null,
      resolvedAt: overrides.resolvedAt ?? null,
      isEscalated: overrides.isEscalated ?? false,
    },
  });
}

describe('runSlaSweep', () => {
  it('flags an overdue, unresponded ticket exactly once across repeated runs', async () => {
    const ticket = await makeOverdueTicket();
    const now = new Date();

    const first = await runSlaSweep({ now });
    expect(first.responseBreachesFlagged).toBe(1);

    const second = await runSlaSweep({ now });
    expect(second.responseBreachesFlagged).toBe(0);

    const events = await prisma.ticketEvent.findMany({
      where: { ticketId: ticket.id, type: 'SLA_RESPONSE_BREACHED' },
    });
    expect(events).toHaveLength(1);
  });

  it('auto-escalates an overdue unresolved, unescalated ticket and does not re-escalate it', async () => {
    const ticket = await makeOverdueTicket({ priority: 'MEDIUM', firstRespondedAt: new Date() });
    const now = new Date();

    const first = await runSlaSweep({ now });
    expect(first.resolutionBreachesEscalated).toBe(1);

    const updated = await prisma.ticket.findUniqueOrThrow({ where: { id: ticket.id } });
    expect(updated.isEscalated).toBe(true);
    expect(updated.priority).toBe('HIGH');
    // Its resolution due date should have moved into the future relative to `now`.
    expect(updated.slaResolutionDueAt.getTime()).toBeGreaterThan(now.getTime());

    const second = await runSlaSweep({ now });
    expect(second.resolutionBreachesEscalated).toBe(0);

    const escalatedEvents = await prisma.ticketEvent.findMany({
      where: { ticketId: ticket.id, type: 'ESCALATED' },
    });
    expect(escalatedEvents).toHaveLength(1);
  });

  it('does not touch a ticket that is already resolved or already escalated', async () => {
    const resolved = await makeOverdueTicket({
      resolvedAt: new Date(),
      firstRespondedAt: new Date(),
    });
    const escalated = await makeOverdueTicket({ isEscalated: true, firstRespondedAt: new Date() });

    const result = await runSlaSweep({ now: new Date() });
    expect(result.resolutionBreachesEscalated).toBe(0);

    const r = await prisma.ticket.findUniqueOrThrow({ where: { id: resolved.id } });
    const e = await prisma.ticket.findUniqueOrThrow({ where: { id: escalated.id } });
    expect(r.priority).toBe('MEDIUM');
    expect(e.priority).toBe('MEDIUM');
  });
});
