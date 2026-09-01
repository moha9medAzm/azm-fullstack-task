import { describe, it, expect } from 'vitest';
import { api } from '../helpers/app';

describe('GET /health', () => {
  it('reports ok', async () => {
    const res = await api.get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  it('returns the standard error shape for unknown routes', async () => {
    const res = await api.get('/api/does-not-exist');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});
