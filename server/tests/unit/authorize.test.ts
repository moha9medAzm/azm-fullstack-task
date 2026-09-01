import { describe, it, expect } from 'vitest';
import { canAccess } from '../../src/middleware/authorize';

describe('canAccess (RBAC decision)', () => {
  it('allows a role that is in the allow-list', () => {
    expect(canAccess('ADMIN', ['ADMIN'])).toBe(true);
    expect(canAccess('AGENT', ['ADMIN', 'AGENT'])).toBe(true);
  });

  it('denies a role not in the allow-list', () => {
    expect(canAccess('AGENT', ['ADMIN'])).toBe(false);
  });

  it('denies when there is no role at all', () => {
    expect(canAccess(undefined, ['ADMIN', 'AGENT'])).toBe(false);
  });
});
