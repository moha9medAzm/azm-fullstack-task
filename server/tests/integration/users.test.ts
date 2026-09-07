import { describe, it, expect, beforeEach } from 'vitest';
import { api, makeUser } from '../helpers/app';
import { resetDb } from '../helpers/db';

let agent: Awaited<ReturnType<typeof makeUser>>;
let admin: Awaited<ReturnType<typeof makeUser>>;

beforeEach(async () => {
  await resetDb();
  agent = await makeUser('AGENT');
  admin = await makeUser('ADMIN');
});

describe('users', () => {
  it('lets any authenticated user list active users (for assignment pickers)', async () => {
    const res = await api.get('/api/users').set(...agent.auth);
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThanOrEqual(2);
    expect(res.body.data[0].passwordHash).toBeUndefined();
  });

  it('blocks a non-admin from creating a user (403 FORBIDDEN)', async () => {
    const res = await api
      .post('/api/users')
      .set(...agent.auth)
      .send({ name: 'New Agent', email: 'new@example.com', password: 'Password123!' });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('lets an admin create a user', async () => {
    const res = await api
      .post('/api/users')
      .set(...admin.auth)
      .send({
        name: 'New Agent',
        email: 'new2@example.com',
        password: 'Password123!',
        role: 'AGENT',
      });
    expect(res.status).toBe(201);
    expect(res.body.user.email).toBe('new2@example.com');
  });

  it('lets an admin deactivate a user', async () => {
    const target = await makeUser('AGENT');
    const res = await api
      .patch(`/api/users/${target.user.id}`)
      .set(...admin.auth)
      .send({ isActive: false });
    expect(res.status).toBe(200);
    expect(res.body.user.isActive).toBe(false);
  });

  it('hides deactivated users from an agent but shows them to an admin', async () => {
    const deactivated = await makeUser('AGENT', { isActive: false });

    const asAgent = await api.get('/api/users').set(...agent.auth);
    expect(asAgent.body.data.map((u: { id: string }) => u.id)).not.toContain(deactivated.user.id);

    const asAdmin = await api.get('/api/users').set(...admin.auth);
    expect(asAdmin.body.data.map((u: { id: string }) => u.id)).toContain(deactivated.user.id);
  });

  it('rejects a duplicate email with 409', async () => {
    const res = await api
      .post('/api/users')
      .set(...admin.auth)
      .send({ name: 'Dup', email: agent.user.email, password: 'Password123!' });
    expect(res.status).toBe(409);
  });
});
