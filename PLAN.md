# Implementation Plan — Customer Support CRM (MVP)

Status: **Draft for review** · Companion to `SPEC.md`
Date: 2026-09-01

---

## 1. Architecture

```
fullstack-task/
├── SPEC.md  PLAN.md  README.md  .gitignore  .editorconfig
├── package.json                 # root: workspaces + orchestration scripts
├── server/                      # Express + TS + Prisma (SQLite)
│   ├── prisma/
│   │   ├── schema.prisma
│   │   ├── migrations/
│   │   └── seed.ts
│   ├── src/
│   │   ├── index.ts             # boot: env check, start server, start SLA sweep
│   │   ├── app.ts               # express app factory (used by server + tests)
│   │   ├── config/env.ts        # zod-validated process.env
│   │   ├── db/prisma.ts         # PrismaClient singleton
│   │   ├── lib/
│   │   │   ├── errors.ts        # AppError + subclasses, error codes
│   │   │   ├── password.ts      # bcrypt hash/verify
│   │   │   ├── jwt.ts           # sign/verify
│   │   │   ├── pagination.ts    # parse + shape helpers
│   │   │   └── sla.ts           # computeSlaDueDates, breach helpers (pure)
│   │   ├── middleware/
│   │   │   ├── authenticate.ts  # Bearer → req.user
│   │   │   ├── authorize.ts     # requireRole(...)
│   │   │   ├── validate.ts      # validate(schema) for body/query/params
│   │   │   └── errorHandler.ts  # central catch → error shape
│   │   ├── modules/
│   │   │   ├── auth/            # routes, service, schemas
│   │   │   ├── users/
│   │   │   ├── customers/
│   │   │   ├── tickets/         # routes, service, schemas, transitions.ts
│   │   │   └── dashboard/
│   │   └── jobs/slaSweep.ts     # pure runSlaSweep(now, deps) + scheduler wrapper
│   ├── tests/
│   │   ├── helpers/ (app, db, auth)
│   │   ├── unit/ (sla, transitions, rbac, schemas)
│   │   └── integration/ (auth, customers, tickets, dashboard, rbac)
│   ├── package.json  tsconfig.json  vitest.config.ts
│   └── .env.example
└── web/                         # React + Vite + TS
    ├── index.html
    ├── src/
    │   ├── main.tsx  App.tsx  routes.tsx
    │   ├── api/client.ts        # fetch wrapper, injects JWT, unwraps error shape
    │   ├── api/hooks.ts         # TanStack Query hooks per resource
    │   ├── auth/AuthContext.tsx  ProtectedRoute.tsx
    │   ├── lib/sla.ts           # shared-ish SLA badge logic (client copy)
    │   ├── components/          # Table, FilterBar, Field, Badge, Timeline, Modal, StatCard
    │   └── pages/               # Login, Dashboard, Tickets, TicketNew, TicketDetail,
    │                            #   Customers, CustomerDetail, AdminUsers
    ├── package.json  tsconfig.json  vite.config.ts  vitest.config.ts
    └── .env.example             # VITE_API_URL
```

**Key decisions & rationale**

- *App factory* (`createApp()`) so Supertest drives the real router with no network.
- *Pure core functions* (`sla.ts`, `transitions.ts`, `runSlaSweep`) take `now`/deps as
  args → fast deterministic unit tests, no clock mocking framework needed.
- *Module = router + service + schemas*: routes stay thin (parse → call service →
  send); services hold business rules and are the only place touching Prisma for
  their aggregate; each service writes its own `TicketEvent`s.
- *Prisma + SQLite*: zero-setup for a reviewer; `provider` swap + re-migrate moves to
  Postgres. `DATABASE_URL` env-driven; tests use a per-file temp `file:` db.
- *No shared TS package* for MVP (keeps setup trivial); Zod schemas duplicated
  minimally on the client where useful. Noted as a future refactor.

---

## 2. Task breakdown (ordered, each ends green + committed)

### Phase 0 — Scaffold
- **T0.1** Root `package.json` (npm workspaces: `server`, `web`), `.gitignore`,
  `.editorconfig`, `README` skeleton. `git init`, first commit.
- **T0.2** `server` scaffold: TS, Express, tsx, vitest, eslint/prettier, `tsconfig`.
  `/health` route + `createApp()` + `index.ts`. One passing smoke test.
- **T0.3** `web` scaffold: Vite React-TS, router, TanStack Query, RHF+Zod, vitest +
  Testing Library. Blank routed shell renders.

### Phase 1 — Data & auth (backend)
- **T1.1** `schema.prisma`: all entities/enums from SPEC §3. Initial migration. `db/prisma.ts`.
- **T1.2** `config/env.ts` (zod), `lib/errors.ts`, `middleware/errorHandler.ts`,
  `middleware/validate.ts`, `lib/pagination.ts`. Unit tests for error mapping + validate.
- **T1.3** `lib/password.ts`, `lib/jwt.ts`, `middleware/authenticate.ts`,
  `middleware/authorize.ts`. Unit tests for RBAC helper + jwt round-trip.
- **T1.4** `auth` module: `POST /auth/login`, `GET /auth/me`; login rate-limit.
  Integration tests: success, bad password, unknown email, missing/invalid token.
- **T1.5** `prisma/seed.ts`: admin + 2 agents + customers + ~25 tickets (varied
  status/priority/age incl. breaching). `db:reset` script.

### Phase 2 — Customers (backend)
- **T2.1** `customers` module: list (`q` + pagination), create, get (+recent tickets),
  patch, delete with open-ticket guard (SPEC §4.7).
- **T2.2** Integration tests: CRUD, `q` search, pagination shape, delete 409 then 204,
  validation 400 shape, agent-vs-admin on delete (403).

### Phase 3 — Tickets (backend) — core
- **T3.1** `lib/sla.ts`: `computeSlaDueDates(priority, createdAt)`, breach helpers.
  Unit tests per priority + boundary (exactly at due, 1ms over).
- **T3.2** `tickets/transitions.ts`: allowed-transition map + `assertTransition`.
  Unit tests for every legal/illegal pair + reopen.
- **T3.3** `tickets` service + routes: create (sets SLA, `CREATED` event, `reference`),
  get (full + derived), list (all filters/sort/pagination from SPEC §5.2), patch
  (per-field diff → events; status→transition guard + resolvedAt/closedAt;
  priority→recompute SLA; firstRespondedAt on OPEN→IN_PROGRESS).
- **T3.4** `POST /tickets/:id/comments` (stamps `firstRespondedAt` on first
  non-internal agent comment; `COMMENTED` event), `POST /assign` (validate active
  user, `ASSIGNED`/`UNASSIGNED`), `POST /escalate` (SPEC §4.5), `GET /events`.
- **T3.5** Integration tests: the full SPEC §9 checklist for tickets — SLA set on
  create, firstRespondedAt once, priority recompute + event, illegal transition 409,
  escalate effects, assign audit, comment internal flag, filters/sort/pagination,
  RBAC.

### Phase 4 — SLA automation + dashboard (backend)
- **T4.1** `jobs/slaSweep.ts`: pure `runSlaSweep({ now, prisma })` — finds breached
  tickets, emits `SLA_*_BREACHED` once, auto-escalates unescalated resolution
  breaches. Scheduler wrapper (`setInterval`, `SLA_SWEEP_MS`) started in `index.ts`;
  `POST /admin/run-sla-sweep` (ADMIN) manual trigger.
- **T4.2** Unit tests: idempotency (run twice → no dup events), only breached+unescalated
  escalated, response-breach event without escalation.
- **T4.3** `dashboard` module: `GET /dashboard/stats` (SPEC §5.2). Integration test
  asserting counts against seeded/fixture data.

### Phase 5 — Frontend
- **T5.1** `api/client.ts` (JWT inject, error-shape unwrap, 401→logout),
  `AuthContext`, `ProtectedRoute`, `Login` page. Manual + RTL test on login flow.
- **T5.2** Shared components: `StatCard`, `Table`, `FilterBar`, `Field`/`Select`,
  `Badge` (SLA colour logic), `Timeline`, `Modal`, toast/error banner. SLA badge unit test.
- **T5.3** `Dashboard` page wired to `/dashboard/stats` + quick lists.
- **T5.4** `Tickets` list: filter bar (status/priority/category/assignee/mine/breaching/q),
  sort, pagination, row → detail.
- **T5.5** `TicketDetail`: inline field edits, status/priority selects, assignee
  picker, escalate button, comment box (internal toggle), event timeline, SLA badges.
- **T5.6** `TicketNew` form (customer combobox w/ inline create) + RHF/Zod validation.
- **T5.7** `Customers` list + `CustomerDetail` (edit + ticket history).
- **T5.8** `AdminUsers` (ADMIN-gated route): list, create, edit role/active.
- **T5.9** RTL tests: Login happy/again, Tickets list renders + filter triggers
  refetch (mocked fetch), TicketDetail comment submit calls API, ProtectedRoute
  redirects when unauthenticated.

### Phase 6 — Hardening & docs
- **T6.1** Helmet, CORS allowlist, login rate-limit, request logging, 404 handler,
  graceful shutdown. Re-run full suite.
- **T6.2** `README.md`: prerequisites, `.env` setup, all scripts, seeded credentials,
  architecture diagram, data model, API summary table, testing, **out-of-scope**
  list, "how I used AI" note, possible next milestones.
- **T6.3** Final pass: `npm run typecheck` (both), `npm test` (server), `npm run test`
  (web), `npm run build` (web); walk SPEC §9 checklist; tag `v0.1.0`.

---

## 3. Root scripts (npm workspaces)

| Script                | Effect                                                        |
|-----------------------|-------------------------------------------------------------|
| `npm run dev`         | concurrently: server (`tsx watch`) + web (`vite`)           |
| `npm run db:reset`    | `prisma migrate reset --force` + `prisma db seed`           |
| `npm run db:migrate`  | `prisma migrate dev`                                        |
| `npm test`            | server vitest                                               |
| `npm run test:web`    | web vitest                                                  |
| `npm run typecheck`   | `tsc --noEmit` in both workspaces                           |
| `npm run build`       | build web (+ `tsc` server)                                  |
| `npm run seed`        | `prisma db seed` only                                       |

---

## 4. Dependencies (intended)

**server**: express, @prisma/client, prisma (dev), zod, bcryptjs, jsonwebtoken,
helmet, cors, express-rate-limit, pino + pino-http (or morgan), dotenv, tsx (dev),
typescript, vitest, supertest, @types/*.

**web**: react, react-dom, react-router-dom, @tanstack/react-query,
react-hook-form, @hookform/resolvers, zod, date-fns; dev: vite, @vitejs/plugin-react,
typescript, vitest, @testing-library/react, @testing-library/user-event, jsdom.

No CSS framework — a single hand-written `styles.css` with CSS variables + a few
utility classes. Keeps the dependency surface small and reviewable.

---

## 5. Risks / watch-list

| Risk | Mitigation |
|------|------------|
| Scope creep back toward all 12 areas | SPEC §1 out-of-scope list is the contract; extras become milestones. |
| Prisma + SQLite concurrency in tests | one temp DB file per test file; serial within file; no shared global state. |
| SLA time logic off-by-one / TZ bugs | pure functions, UTC everywhere, boundary unit tests, injected clock. |
| Auth/RBAC gap on a route | `authenticate` app-wide; every router explicitly lists `authorize(...)`; RBAC integration test hits an admin route as agent. |
| Frontend/back contract drift | client `api/client.ts` unwraps the exact SPEC error shape; hooks typed; smoke E2E-ish RTL with mocked fetch. |
| Sweep double-escalation | guard on `isEscalated` + "event of this type already exists for ticket" check; idempotency unit test. |

---

## 6. Definition of done

All of SPEC §9 checked · `npm test` green · `npm run build` + `npm run typecheck`
clean · README reproduces a seeded, running app · git history shows incremental,
message-per-task commits · SPEC/PLAN kept in sync with any agreed changes.
