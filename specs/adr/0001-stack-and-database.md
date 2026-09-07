# ADR-0001 — Stack: Node + Express + Prisma + SQLite; React + Vite

**Status:** Accepted · 2026-09-01

## Context

An AI-assisted full-stack assessment. The reviewer must be able to clone, install,
and run the whole thing in minutes on a fresh machine, and read the code without
fighting a framework. The data model is relational (customers → tickets →
comments/events).

## Options

1. **Next.js full-stack** — one app, API routes + React. Fewer moving parts, but
   backend and frontend concerns blur, and Supertest-style API testing is awkward.
2. **NestJS + React** — strong structure out of the box, but heavy DI/decorator
   ceremony for a small surface; more to explain than to show.
3. **Express + React (Vite), separate workspaces** — explicit layering, trivial to
   test the API in isolation, minimal magic.
4. Database: **PostgreSQL** (needs Docker/a server) vs **SQLite** (a file).

## Decision

Express + TypeScript + Prisma on the backend, React + Vite + TypeScript on the
frontend, as two npm workspaces. **SQLite** via Prisma for storage.

## Consequences

- **+** `npm install && npm run db:reset && npm run dev` works with no external
  services. Integration tests use a throwaway SQLite file.
- **+** Clear separation: the API can be driven by Supertest with no network; the
  SPA is a pure client of a documented contract.
- **+** Prisma abstracts the driver — moving to Postgres is a `provider` change +
  re-migration, no application code ([ADR-0002](0002-enums-as-validated-strings.md)
  notes the one caveat: enums).
- **−** SQLite: single writer (tests run serially within a file), case-sensitive
  `LIKE`, no native enums, no `mode: 'insensitive'`. All documented in
  [07-assumptions-and-scope.md](../07-assumptions-and-scope.md).
- **−** Two workspaces means types are mirrored by hand (`web/src/api/types.ts`).
  Accepted for MVP; a `packages/shared` extraction is the follow-up.
