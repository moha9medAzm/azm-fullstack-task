import { describe, it, expect, beforeEach } from 'vitest';
import { api, makeUser, makeCustomer } from '../helpers/app';
import { resetDb, prisma } from '../helpers/db';

let agent: Awaited<ReturnType<typeof makeUser>>;

beforeEach(async () => {
  await resetDb();
  agent = await makeUser('AGENT');
});

describe('GET /api/dashboard/stats', () => {
  it('matches a hand count of seeded/fixture data', async () => {
    const customer = await makeCustomer();

    const create = (overrides: Partial<{ status: string; priority: string; assigneeId: string | null }>) =>
      api
        .post('/api/tickets')
        .set(...agent.auth)
        .send({ subject: 's', description: 'd', customerId: customer.id, ...overrides });

    const t1 = await create({ assigneeId: agent.user.id }); // OPEN, mine, unassigned=false
    await create({}); // OPEN, unassigned
    const t3 = await create({ priority: 'URGENT' });

    // Move t3 to RESOLVED so it counts toward resolvedLast7d.
    await api.patch(`/api/tickets/${t3.body.ticket.id}`).set(...agent.auth).send({ status: 'RESOLVED' });

    // Force t1's resolution SLA into the past to count as a breach, without going
    // through the sweep (this test only checks the read-side stats query).
    await prisma.ticket.update({
      where: { id: t1.body.ticket.id },
      data: { slaResolutionDueAt: new Date(Date.now() - 60_000) },
    });

    const res = await api.get('/api/dashboard/stats').set(...agent.auth);
    expect(res.status).toBe(200);
    expect(res.body.myOpen).toBe(1);
    // t3 is unassigned too, but RESOLVED is not an "active" status, so it doesn't
    // count toward the open unassigned queue.
    expect(res.body.unassigned).toBe(1);
    expect(res.body.byStatus.RESOLVED).toBe(1);
    expect(res.body.resolvedLast7d).toBe(1);
    expect(res.body.breachingResolution).toBe(1);
  });
});
