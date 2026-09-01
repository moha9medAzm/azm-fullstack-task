import { describe, it, expect, beforeEach } from 'vitest';
import { api, makeUser, makeCustomer } from '../helpers/app';
import { resetDb, prisma } from '../helpers/db';

let agent: Awaited<ReturnType<typeof makeUser>>;
let admin: Awaited<ReturnType<typeof makeUser>>;

beforeEach(async () => {
  await resetDb();
  agent = await makeUser('AGENT');
  admin = await makeUser('ADMIN');
});

describe('customers CRUD', () => {
  it('creates a customer', async () => {
    const res = await api
      .post('/api/customers')
      .set(...agent.auth)
      .send({ name: 'Ada Lovelace', email: 'ada@example.com', company: 'Analytical Engines' });
    expect(res.status).toBe(201);
    expect(res.body.customer).toMatchObject({ name: 'Ada Lovelace', email: 'ada@example.com' });
  });

  it('rejects an invalid email with 400 VALIDATION_ERROR', async () => {
    const res = await api
      .post('/api/customers')
      .set(...agent.auth)
      .send({ name: 'Bad Email', email: 'not-an-email' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('lists customers with pagination shape and honors `q`', async () => {
    await makeCustomer({ name: 'Grace Hopper', company: 'US Navy' });
    await makeCustomer({ name: 'Unrelated Person', company: 'Other Co' });

    const res = await api.get('/api/customers?q=Grace').set(...agent.auth);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ page: 1, pageSize: 20 });
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].name).toBe('Grace Hopper');
  });

  it('gets a customer with recent ticket history included', async () => {
    const customer = await makeCustomer();
    const res = await api.get(`/api/customers/${customer.id}`).set(...agent.auth);
    expect(res.status).toBe(200);
    expect(res.body.customer.tickets).toEqual([]);
  });

  it('404s for a missing customer', async () => {
    const res = await api.get('/api/customers/does-not-exist').set(...agent.auth);
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('updates a customer', async () => {
    const customer = await makeCustomer();
    const res = await api
      .patch(`/api/customers/${customer.id}`)
      .set(...agent.auth)
      .send({ notes: 'VIP customer' });
    expect(res.status).toBe(200);
    expect(res.body.customer.notes).toBe('VIP customer');
  });

  it('lets an agent delete a customer with no open tickets', async () => {
    const customer = await makeCustomer();
    const res = await api.delete(`/api/customers/${customer.id}`).set(...admin.auth);
    expect(res.status).toBe(204);
  });

  it('blocks an agent (non-admin) from deleting a customer with 403', async () => {
    const customer = await makeCustomer();
    const res = await api.delete(`/api/customers/${customer.id}`).set(...agent.auth);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('blocks deleting a customer with a non-closed ticket (409), then allows it once closed', async () => {
    const customer = await makeCustomer();
    const ticket = await prisma.ticket.create({
      data: {
        reference: 'TKT-TEST-1',
        subject: 'Cannot log in',
        description: 'Help',
        customerId: customer.id,
        createdById: agent.user.id,
        slaResponseDueAt: new Date(),
        slaResolutionDueAt: new Date(),
      },
    });

    const blocked = await api.delete(`/api/customers/${customer.id}`).set(...admin.auth);
    expect(blocked.status).toBe(409);
    expect(blocked.body.error.code).toBe('CUSTOMER_HAS_OPEN_TICKETS');

    await prisma.ticket.update({ where: { id: ticket.id }, data: { status: 'CLOSED' } });

    const allowed = await api.delete(`/api/customers/${customer.id}`).set(...admin.auth);
    expect(allowed.status).toBe(204);
  });
});
