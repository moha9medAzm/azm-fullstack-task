import { env } from '../config/env';

/** Tiny leveled logger. Silent during tests to keep output readable. */
type Level = 'debug' | 'info' | 'warn' | 'error';

function log(level: Level, msg: string, meta?: Record<string, unknown>) {
  if (env.NODE_ENV === 'test') return;
  const line = { time: new Date().toISOString(), level, msg, ...meta };
  const stream = level === 'error' || level === 'warn' ? console.error : console.log;
  stream(JSON.stringify(line));
}

export const logger = {
  debug: (m: string, meta?: Record<string, unknown>) => log('debug', m, meta),
  info: (m: string, meta?: Record<string, unknown>) => log('info', m, meta),
  warn: (m: string, meta?: Record<string, unknown>) => log('warn', m, meta),
  error: (m: string, meta?: Record<string, unknown>) => log('error', m, meta),
};
