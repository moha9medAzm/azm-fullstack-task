import { describe, it, expect, beforeEach } from 'vitest';
import { api, makeUser } from '../helpers/app';
import { resetDb } from '../helpers/db';

beforeEach(resetDb);

describe('POST /api/auth/login', () => {
  it('logs in with correct credentials', async () => {
    const { user, password } = await makeUser('AGENT', {
      email: 'agent@example.com',
      password: 'Secret123!',
    });
    const res = await api.post('/api/auth/login').send({ email: user.email, password });
    expect(res.status).toBe(200);
    expect(res.body.token).toEqual(expect.any(String));
    expect(res.body.user).toMatchObject({ email: user.email, role: 'AGENT' });
    expect(res.body.user.passwordHash).toBeUndefined();
  });

  it('rejects a wrong password with 401 and the standard error shape', async () => {
    const { user } = await makeUser('AGENT', {
      email: 'agent2@example.com',
      password: 'Secret123!',
    });
    const res = await api.post('/api/auth/login').send({ email: user.email, password: 'wrong' });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('rejects an unknown email the same way as a wrong password', async () => {
    const res = await api
      .post('/api/auth/login')
      .send({ email: 'nobody@example.com', password: 'whatever' });
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('rejects a deactivated user', async () => {
    const { user, password } = await makeUser('AGENT', { isActive: false, password: 'Secret123!' });
    const res = await api.post('/api/auth/login').send({ email: user.email, password });
    expect(res.status).toBe(401);
  });

  it('returns 400 VALIDATION_ERROR with details for a malformed body', async () => {
    const res = await api.post('/api/auth/login').send({ email: 'not-an-email' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(Array.isArray(res.body.error.details)).toBe(true);
    expect(res.body.error.details.length).toBeGreaterThan(0);
  });
});

describe('GET /api/auth/me', () => {
  it('requires a bearer token', async () => {
    const res = await api.get('/api/auth/me');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('rejects a garbage token', async () => {
    const res = await api.get('/api/auth/me').set('Authorization', 'Bearer not-a-real-token');
    expect(res.status).toBe(401);
  });

  it('returns the current user for a valid token', async () => {
    const { user, auth } = await makeUser('ADMIN');
    const res = await api.get('/api/auth/me').set(...auth);
    expect(res.status).toBe(200);
    expect(res.body.user.id).toBe(user.id);
  });
});
