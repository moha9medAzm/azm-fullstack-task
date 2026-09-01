# Customer Support CRM — MVP

A working, end-to-end slice of the Customer Support CRM: the **core support loop**
— customers → tickets → assignment → SLA → resolution — built with authentication,
role-based access control, request validation, an immutable audit log, background
SLA automation, a test suite, and a React agent console.

- **Requirements, assumptions, API contract, acceptance criteria:** [SPEC.md](SPEC.md)
- **Architecture and the task-by-task build plan:** [PLAN.md](PLAN.md)

The product brief lists 12 feature areas; this MVP deliberately implements 5 of them
well rather than all 12 shallowly. See [What's intentionally out of scope](#whats-intentionally-out-of-scope).

---

## Stack

| Layer     | Choice                                                                 |
|-----------|-----------------------------------------------------------------------|
| Backend   | Node.js, Express, TypeScript, Prisma ORM                             |
| Database  | SQLite (file-based; `provider` swap + re-migrate moves it to Postgres) |
| Auth      | JWT (HS256) + bcrypt                                                 |
| Frontend  | React, Vite, TypeScript, TanStack Query, React Hook Form + Zod       |
| Tests     | Vitest, Supertest (API), Testing Library (UI)                        |
| Tooling   | npm workspaces                                                       |

---

## Prerequisites

- Node.js **>= 18.13**
- npm **>= 8**

No database server required — SQLite is a local file.

---

## Setup & run

```bash
# 1. install all workspace dependencies
npm install

# 2. create local env files from the templates
cp server/.env.example server/.env
cp web/.env.example web/.env

# 3. create the database schema and load seed data
npm run db:reset

# 4. start the API (:4000) and the web app (:5173) together
npm run dev
```

Then open the web app and sign in with a seeded account (below). If port 5173 is
taken, Vite picks the next free port and prints it — add that origin to
`CORS_ORIGIN` in `server/.env` if it differs.

### Seeded accounts

| Email                | Password    | Role  |
|----------------------|-------------|-------|
| `admin@example.com`  | `Admin123!` | ADMIN |
| `alice@example.com`  | `Agent123!` | AGENT |
| `bilal@example.com`  | `Agent123!` | AGENT |

The seed also creates 8 customers and 25 tickets spanning every status, priority,
and a range of ages — including several that are actively breaching SLA so the
dashboard has something to show.

---

## Scripts

Run from the repo root:

| Script                | What it does                                              |
|-----------------------|----------------------------------------------------------|
| `npm run dev`         | API (`tsx watch`) + web (`vite`) concurrently            |
| `npm run dev:server`  | API only                                                 |
| `npm run dev:web`     | Web only                                                 |
| `npm run db:reset`    | Drop, re-migrate, and re-seed the database               |
| `npm run db:migrate`  | Create/apply a new migration from schema changes         |
| `npm run seed`        | Re-run the seed script only                              |
| `npm test`            | Server test suite (unit + integration)                   |
| `npm run test:web`    | Web test suite                                           |
| `npm run typecheck`   | `tsc --noEmit` in both workspaces                        |
| `npm run build`       | Type-check + build both workspaces                       |

---

## Architecture

```
fullstack-task/
├── SPEC.md  PLAN.md                     specification + build plan
├── server/
│   ├── prisma/
│   │   ├── schema.prisma                data model (SQLite)
│   │   ├── migrations/                  committed, applied via migrate deploy
│   │   └── seed.ts
│   └── src/
│       ├── app.ts                       Express app factory (used by tests too)
│       ├── index.ts                     boot: listen + start SLA sweep + shutdown
│       ├── config/env.ts                zod-validated environment
│       ├── db/prisma.ts                 PrismaClient singleton
│       ├── lib/                         errors, jwt, password, pagination, sla (pure)
│       ├── middleware/                  authenticate, authorize, validate, errorHandler
│       ├── modules/
│       │   ├── auth/  users/  customers/  dashboard/  admin/
│       │   └── tickets/                 routes + service + schemas + transitions
│       └── jobs/slaSweep.ts             pure runSlaSweep() + interval wrapper
└── web/
    └── src/
        ├── api/          client (fetch + JWT + typed errors), hooks (TanStack Query), types
        ├── auth/         AuthContext, ProtectedRoute
        ├── components/   Badge, StatCard, Spinner, ErrorBanner, Layout, EventLine
        ├── lib/          format, sla (badge tone)
        └── pages/        Login, Dashboard, Tickets(List|New|Detail), Customers(List|Detail), AdminUsers
```

**Design decisions (rationale in [PLAN.md](PLAN.md) §1):**

- **App factory** — `createApp()` returns the Express app with no `listen()`, so
  Supertest drives the real router in-process.
- **Thin routes, service layer owns the rules** — routers parse (via Zod) → call a
  service → send. Each service is the only place touching Prisma for its aggregate
  and writes its own `TicketEvent` audit rows.
- **Pure core functions** — `lib/sla.ts`, `tickets/transitions.ts`, and
  `runSlaSweep()` take `now`/dependencies as arguments, so they unit-test
  deterministically with no clock mocking.
- **Enums as validated strings** — SQLite has no native enum type; valid values
  live in `src/types/enums.ts` and are enforced by Zod at every edge.
- **Consistent error envelope** — every error is
  `{ error: { code, message, details? } }`; a central handler maps `AppError`
  subclasses and known Prisma errors, and turns anything else into a logged 500.

---

## Data model

| Entity          | Notes                                                                                   |
|-----------------|----------------------------------------------------------------------------------------|
| `User`          | `role` = ADMIN \| AGENT, `isActive`; bcrypt `passwordHash`                              |
| `Customer`      | unique `email`; cannot be deleted while it has a non-CLOSED ticket                      |
| `Ticket`        | `reference` (`TKT-0001`), status/priority/category/channel, `assigneeId`, SLA timestamps, `isEscalated` |
| `TicketComment` | `isInternal` flag; the first non-internal agent comment stamps `firstRespondedAt`       |
| `TicketEvent`   | append-only audit trail (created / updated / status / priority / assigned / escalated / commented / SLA breach / reopened) |

### SLA targets (set from priority at creation)

| Priority | First response | Resolution |
|----------|----------------|------------|
| URGENT   | 1 h            | 4 h        |
| HIGH     | 4 h            | 24 h       |
| MEDIUM   | 8 h            | 72 h       |
| LOW      | 24 h           | 168 h      |

Changing priority recomputes the resolution target (and the response target too,
if the ticket hasn't been responded to yet). Breach flags are **derived at read
time** from timestamps; the background sweep additionally records a one-off breach
event and auto-escalates overdue, un-escalated tickets.

### Status lifecycle

```
OPEN ⇄ IN_PROGRESS ⇄ PENDING  ──▶ RESOLVED ──▶ CLOSED
        (any active ⇄ any active)      │            │
        RESOLVED / CLOSED ──▶ any active status  = REOPENED (clears resolved/closed timestamps)
```

Illegal moves (e.g. `OPEN → CLOSED`) return `409 INVALID_TRANSITION`.

---

## API summary

Base path `/api`. All routes except `/auth/login` and `/health` require
`Authorization: Bearer <jwt>`. Full contract in [SPEC.md](SPEC.md) §5.

| Method | Path                       | Role         | Purpose                                        |
|--------|----------------------------|--------------|------------------------------------------------|
| POST   | `/auth/login`              | —            | email + password → `{ token, user }`           |
| GET    | `/auth/me`                 | any          | current user                                   |
| GET    | `/users`                   | ADMIN, AGENT | list users (agents: active only)               |
| POST   | `/users`                   | ADMIN        | create user                                    |
| PATCH  | `/users/:id`               | ADMIN        | update name / role / isActive / password       |
| GET    | `/customers`               | ADMIN, AGENT | `?q=` search + pagination                       |
| POST   | `/customers`               | ADMIN, AGENT | create                                         |
| GET    | `/customers/:id`           | ADMIN, AGENT | profile + recent tickets                        |
| PATCH  | `/customers/:id`           | ADMIN, AGENT | update                                         |
| DELETE | `/customers/:id`           | ADMIN        | delete (409 if a non-closed ticket exists)      |
| GET    | `/tickets`                 | ADMIN, AGENT | filter (`status,priority,category,channel,assigneeId,customerId,mine,unassigned,breaching,q`), `sort`, paginate |
| POST   | `/tickets`                 | ADMIN, AGENT | create (SLA computed from priority)            |
| GET    | `/tickets/:id`             | ADMIN, AGENT | full ticket + comments + events + derived SLA   |
| PATCH  | `/tickets/:id`             | ADMIN, AGENT | update fields (diffed → audit events)           |
| POST   | `/tickets/:id/assign`      | ADMIN, AGENT | `{ assigneeId: string \| null }`               |
| POST   | `/tickets/:id/escalate`    | ADMIN, AGENT | bump priority, flag escalated, recompute SLA    |
| POST   | `/tickets/:id/comments`    | ADMIN, AGENT | `{ body, isInternal? }`                        |
| GET    | `/tickets/:id/events`      | ADMIN, AGENT | audit trail                                    |
| GET    | `/dashboard/stats`         | ADMIN, AGENT | queue counts, my open, unassigned, breaching, resolved-7d |
| POST   | `/admin/run-sla-sweep`     | ADMIN        | run the SLA sweep on demand                     |

---

## Testing

```bash
npm test         # server: 76 tests (unit + integration)
npm run test:web # web: 6 tests (React Testing Library)
```

**Server** — unit tests cover the pure core (SLA math with frozen clock and
boundary cases, status-transition matrix, RBAC decision, error mapping).
Integration tests run against a fresh temporary SQLite database (`migrate deploy`
in `globalSetup`, table wipe between tests) and cover the [SPEC.md](SPEC.md) §9
acceptance checklist: login success/failure/deactivated, the standard 400/401/403/
404/409 shapes, customer delete-guard, ticket creation SLA, first-response
stamping, priority-change SLA recompute + event, illegal transitions, escalation,
assignment auditing, list filter/sort/pagination, dashboard stat math, and the
idempotent auto-escalation sweep.

**Web** — `ProtectedRoute` redirect when unauthenticated, login happy path +
server-error surface, ticket list rendering + filter-triggered refetch (mocked
`fetch`), and ticket-detail comment submission.

The app was also driven end-to-end in a real headless browser (login → dashboard →
tickets → ticket detail → customers → users) with no console errors.

---

## Security notes

- Passwords hashed with bcrypt; JWTs signed HS256 with an env secret and an 8 h
  expiry; the token is re-checked against a live user row on every request, so
  deactivating a user revokes access immediately.
- RBAC is enforced **server-side** on every route (`authorize(...)`), never trusted
  from the client; the UI merely hides what the API would reject.
- Zod validation at every edge; Prisma parameterises all queries.
- `helmet`, a CORS origin allow-list, a JSON body-size limit, and a rate limiter on
  `/auth/login`.
- Uniform `404` for missing resources (no "user exists / wrong password"
  distinction on login).
- Secrets are read from `.env` (git-ignored); `.env.example` is committed.

---

## What's intentionally out of scope

Firm MVP boundaries (any one is a viable follow-up milestone — see [SPEC.md](SPEC.md) §1):

- **Communication channels** — `channel` is a field on the ticket for realism, but
  there is **no** outbound email / WhatsApp / SMS / live-chat integration.
- **AI features** — summaries, suggested replies, auto-categorisation, chatbot.
- **Customer portal** — this build is agents/admins only; no customer login.
- **Knowledge base, BI reporting, ERP / external integrations.**
- **File attachments** — schema leaves room; not built.
- **Multi-branch / multi-department / multi-tenant**, i18n / Arabic, business-hours
  SLA calendars (SLA uses wall-clock UTC), email/push notifications (the dashboard
  surfaces breaching/unassigned queues instead).
- **Self-service signup** — users are created by an admin or the seed only.

---

## How AI was used on this task

- Drafted [SPEC.md](SPEC.md) and [PLAN.md](PLAN.md) first, scoping 12 feature areas
  down to a coherent, testable core and writing explicit assumptions + acceptance
  criteria before any code.
- Generated implementation in the planned order, keeping business logic in pure,
  unit-tested functions so AI output could be verified deterministically rather
  than trusted.
- Every phase ended with `tsc --noEmit` + the full test suite green and a
  descriptive commit; the running app was screenshot-verified in a browser.
- Reviewed and corrected AI output where it was wrong or thin — e.g. SQLite's lack
  of enum support (moved to validated string unions), a pagination-reset bug in the
  ticket filter bar, and the `GET /users` visibility rule for deactivated accounts.

---

## Possible next milestones

1. SLA business-hours calendar + per-category SLA overrides.
2. Real email channel: inbound parsing → ticket, outbound replies from comments.
3. Customer portal (submit / track / FAQ) reusing the same API + a `CUSTOMER` role.
4. One AI feature end-to-end (ticket summary + suggested reply) via the Claude API.
5. Reporting: agent performance, SLA attainment, CSAT.
6. Extract shared Zod schemas / types into a `packages/shared` workspace.
