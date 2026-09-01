import { execSync } from 'node:child_process';
import { existsSync, rmSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Once per `vitest run`: recreate the test SQLite database from the committed
 * migrations so integration tests hit a real schema.
 */
export default function setup() {
  const dbUrl = 'file:./test.db';
  const dbFile = resolve(__dirname, '../../prisma/test.db');

  for (const suffix of ['', '-journal', '-wal', '-shm']) {
    const f = `${dbFile}${suffix}`;
    if (existsSync(f)) rmSync(f);
  }

  execSync('npx prisma migrate deploy', {
    cwd: resolve(__dirname, '../..'),
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: dbUrl },
  });

  return () => {
    for (const suffix of ['', '-journal', '-wal', '-shm']) {
      const f = `${dbFile}${suffix}`;
      if (existsSync(f)) rmSync(f);
    }
  };
}
