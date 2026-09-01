// Runs before every test file (vitest `setupFiles`). Establish a deterministic
// environment before any application module (and thus `config/env`) is imported.
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = process.env.DATABASE_URL ?? 'file:./test.db';
process.env.JWT_SECRET = 'test-secret-value-at-least-16-chars-long';
process.env.JWT_EXPIRES_IN = '1h';
process.env.CORS_ORIGIN = 'http://localhost:5173';
process.env.SLA_SWEEP_MS = '0';
process.env.BCRYPT_ROUNDS = '4';
