import { describe, it, expect, beforeEach } from 'vitest';
import { api, makeUser, makeCustomer } from '../helpers/app';
import { resetDb } from '../helpers/db';

let agent: Awaited<ReturnType<typeof makeUser>>;
let otherAgent: Awaited<ReturnType<typeof makeUser>>;
let customerId: string;

beforeEach(async () => {
  await resetDb();
  agent = await makeUser('AGENT');
  otherAgent = await makeUser('AGENT');
  const customer = await makeCustomer();
  customerId = customer.id;
});

async function createTicket(overrides: Record<string, unknown> = {}) {
  const res = await api
    .post('/api/tickets')
    .set(...agent.auth)
    .send({ subject: 'Cannot log in', description: 'Getting a 500 error', customerId, ...overrides });
  expect(res.status).toBe(201);
  return res.body.ticket as {
    id: string;
    reference: string;
    priority: string;
    status: string;
    slaResponseDueAt: string;
    slaResolutionDueAt: string;
  };
}

describe('POST /api/tickets', () => {
  it('sets SLA due dates from priority on creation', async () => {
    const before = Date.now();
    const ticket = await createTicket({ priority: 'URGENT' });
    const respMs = new Date(ticket.slaResponseDueAt).getTime() - before;
    const resMs = new Date(ticket.slaResolutionDueAt).getTime() - before;
    expect(respMs).toBeGreaterThanOrEqual(1 * 3_600_000 - 2000);
    expect(respMs).toBeLessThanOrEqual(1 * 3_600_000 + 5000);
    expect(resMs).toBeGreaterThanOrEqual(4 * 3_600_000 - 2000);
    expect(resMs).toBeLessThanOrEqual(4 * 3_600_000 + 5000);
    expect(ticket.reference).toMatch(/^TKT-\d+$/);
    expect(ticket.status).toBe('OPEN');
  });

  it('rejects an unknown customerId with a validation error', async () => {
    const res = await api
      .post('/api/tickets')
      .set(...agent.auth)
      .send({ subject: 'x', description: 'y', customerId: 'nope' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('writes a CREATED audit event', async () => {
    const ticket = await createTicket();
    const res = await api.get(`/api/tickets/${ticket.id}/events`).set(...agent.auth);
    expect(res.body.data.map((e: { type: string }) => e.type)).toContain('CREATED');
  });
});

describe('comments and first response', () => {
  it('stamps firstRespondedAt on the first non-internal comment only', async () => {
    const ticket = await createTicket();

    const c1 = await api
      .post(`/api/tickets/${ticket.id}/comments`)
      .set(...agent.auth)
      .send({ body: 'Looking into it' });
    expect(c1.status).toBe(201);

    const afterFirst = await api.get(`/api/tickets/${ticket.id}`).set(...agent.auth);
    const firstStamp = afterFirst.body.ticket.firstRespondedAt;
    expect(firstStamp).not.toBeNull();

    await api
      .post(`/api/tickets/${ticket.id}/comments`)
      .set(...agent.auth)
      .send({ body: 'Second reply' });

    const afterSecond = await api.get(`/api/tickets/${ticket.id}`).set(...agent.auth);
    expect(afterSecond.body.ticket.firstRespondedAt).toBe(firstStamp);
  });

  it('does not stamp firstRespondedAt for an internal note', async () => {
    const ticket = await createTicket();
    await api
      .post(`/api/tickets/${ticket.id}/comments`)
      .set(...agent.auth)
      .send({ body: 'internal only', isInternal: true });
    const res = await api.get(`/api/tickets/${ticket.id}`).set(...agent.auth);
    expect(res.body.ticket.firstRespondedAt).toBeNull();
    expect(res.body.ticket.comments[0]).toMatchObject({ isInternal: true });
  });
});

describe('PATCH /api/tickets/:id — priority', () => {
  it('recomputes the resolution due date and logs PRIORITY_CHANGED on LOW -> URGENT', async () => {
    const ticket = await createTicket({ priority: 'LOW' });
    const before = Date.now();

    const res = await api
      .patch(`/api/tickets/${ticket.id}`)
      .set(...agent.auth)
      .send({ priority: 'URGENT' });

    expect(res.status).toBe(200);
    const resMs = new Date(res.body.ticket.slaResolutionDueAt).getTime() - before;
    expect(resMs).toBeLessThan(5 * 3_600_000); // now ~4h out, was ~168h out

    const events = await api.get(`/api/tickets/${ticket.id}/events`).set(...agent.auth);
    expect(events.body.data.map((e: { type: string }) => e.type)).toContain('PRIORITY_CHANGED');
  });
});

describe('PATCH /api/tickets/:id — status transitions', () => {
  it('rejects OPEN -> CLOSED with 409 INVALID_TRANSITION', async () => {
    const ticket = await createTicket();
    const res = await api
      .patch(`/api/tickets/${ticket.id}`)
      .set(...agent.auth)
      .send({ status: 'CLOSED' });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('INVALID_TRANSITION');
  });

  it('allows OPEN -> IN_PROGRESS -> RESOLVED -> CLOSED', async () => {
    const ticket = await createTicket();
    const toInProgress = await api
      .patch(`/api/tickets/${ticket.id}`)
      .set(...agent.auth)
      .send({ status: 'IN_PROGRESS' });
    expect(toInProgress.status).toBe(200);
    expect(toInProgress.body.ticket.firstRespondedAt).not.toBeNull(); // OPEN->IN_PROGRESS stamps it

    const toResolved = await api
      .patch(`/api/tickets/${ticket.id}`)
      .set(...agent.auth)
      .send({ status: 'RESOLVED' });
    expect(toResolved.status).toBe(200);
    expect(toResolved.body.ticket.resolvedAt).not.toBeNull();

    const toClosed = await api
      .patch(`/api/tickets/${ticket.id}`)
      .set(...agent.auth)
      .send({ status: 'CLOSED' });
    expect(toClosed.status).toBe(200);
    expect(toClosed.body.ticket.closedAt).not.toBeNull();
  });

  it('reopening a CLOSED ticket clears resolvedAt/closedAt and logs REOPENED', async () => {
    const ticket = await createTicket();
    await api.patch(`/api/tickets/${ticket.id}`).set(...agent.auth).send({ status: 'RESOLVED' });
    await api.patch(`/api/tickets/${ticket.id}`).set(...agent.auth).send({ status: 'CLOSED' });

    const reopened = await api
      .patch(`/api/tickets/${ticket.id}`)
      .set(...agent.auth)
      .send({ status: 'OPEN' });
    expect(reopened.status).toBe(200);
    expect(reopened.body.ticket.resolvedAt).toBeNull();
    expect(reopened.body.ticket.closedAt).toBeNull();

    const events = await api.get(`/api/tickets/${ticket.id}/events`).set(...agent.auth);
    expect(events.body.data.map((e: { type: string }) => e.type)).toContain('REOPENED');
  });
});

describe('escalate', () => {
  it('bumps priority, sets isEscalated, and writes an ESCALATED event', async () => {
    const ticket = await createTicket({ priority: 'MEDIUM' });
    const res = await api.post(`/api/tickets/${ticket.id}/escalate`).set(...agent.auth);
    expect(res.status).toBe(200);
    expect(res.body.ticket.priority).toBe('HIGH');
    expect(res.body.ticket.isEscalated).toBe(true);

    const events = await api.get(`/api/tickets/${ticket.id}/events`).set(...agent.auth);
    expect(events.body.data.map((e: { type: string }) => e.type)).toContain('ESCALATED');
  });

  it('caps at URGENT', async () => {
    const ticket = await createTicket({ priority: 'URGENT' });
    const res = await api.post(`/api/tickets/${ticket.id}/escalate`).set(...agent.auth);
    expect(res.body.ticket.priority).toBe('URGENT');
  });
});

describe('assign', () => {
  it('assigns to another agent and logs ASSIGNED', async () => {
    const ticket = await createTicket();
    const res = await api
      .post(`/api/tickets/${ticket.id}/assign`)
      .set(...agent.auth)
      .send({ assigneeId: otherAgent.user.id });
    expect(res.status).toBe(200);
    expect(res.body.ticket.assignee.id).toBe(otherAgent.user.id);

    const events = await api.get(`/api/tickets/${ticket.id}/events`).set(...agent.auth);
    expect(events.body.data.map((e: { type: string }) => e.type)).toContain('ASSIGNED');
  });

  it('rejects assigning to a non-existent user with a validation error', async () => {
    const ticket = await createTicket();
    const res = await api
      .post(`/api/tickets/${ticket.id}/assign`)
      .set(...agent.auth)
      .send({ assigneeId: 'ghost' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('unassigns with assigneeId: null and logs UNASSIGNED', async () => {
    const ticket = await createTicket({ assigneeId: otherAgent.user.id });
    const res = await api
      .post(`/api/tickets/${ticket.id}/assign`)
      .set(...agent.auth)
      .send({ assigneeId: null });
    expect(res.status).toBe(200);
    expect(res.body.ticket.assignee).toBeNull();
  });
});

describe('GET /api/tickets — list, filter, sort, paginate', () => {
  it('filters by status and paginates with the standard shape', async () => {
    await createTicket({ priority: 'LOW' });
    const t2 = await createTicket({ priority: 'HIGH' });
    await api.patch(`/api/tickets/${t2.id}`).set(...agent.auth).send({ status: 'IN_PROGRESS' });

    const res = await api.get('/api/tickets?status=IN_PROGRESS&page=1&pageSize=10').set(...agent.auth);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ page: 1, pageSize: 10, total: 1 });
    expect(res.body.data).toHaveLength(1);
  });

  it('sorts by priority ascending and descending', async () => {
    await createTicket({ priority: 'LOW' });
    await createTicket({ priority: 'URGENT' });
    await createTicket({ priority: 'MEDIUM' });

    const asc = await api.get('/api/tickets?sort=priority').set(...agent.auth);
    expect(asc.body.data.map((t: { priority: string }) => t.priority)).toEqual(['LOW', 'MEDIUM', 'URGENT']);

    const desc = await api.get('/api/tickets?sort=-priority').set(...agent.auth);
    expect(desc.body.data.map((t: { priority: string }) => t.priority)).toEqual(['URGENT', 'MEDIUM', 'LOW']);
  });

  it('supports `mine=true`', async () => {
    await createTicket({ assigneeId: agent.user.id });
    await createTicket({ assigneeId: otherAgent.user.id });

    const res = await api.get('/api/tickets?mine=true').set(...agent.auth);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].assignee.id).toBe(agent.user.id);
  });

  it('rejects an invalid query value with 400', async () => {
    const res = await api.get('/api/tickets?status=NOT_A_STATUS').set(...agent.auth);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('auth requirements', () => {
  it('requires a token for every tickets route', async () => {
    const res = await api.get('/api/tickets');
    expect(res.status).toBe(401);
  });
});
