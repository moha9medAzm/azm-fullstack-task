# 04 — Acceptance criteria

The definition of done. Every item is **checked** and backed by an automated test
(file · `describe > it`) or a named artifact. Totals: **76 backend + 6 frontend
tests**, `typecheck` clean, `build` clean.

Run it yourself:

```bash
npm run typecheck      # both workspaces, no errors
npm test               # 76 backend tests
npm run test:web       # 6 frontend tests
npm run build          # server tsc + web vite build
```

---

## Environment & setup

| # | Criterion | Evidence |
|---|-----------|----------|
| A1 | `npm install && npm run db:reset && npm run dev` boots the API on `:4000` and the web app on `:5173` with seed data | [RUNNING.md](../RUNNING.md) §5–6; `prisma/seed.ts` prints `Seeded 25 tickets, 8 customers, 3 users` |
| A2 | Config is validated on boot; a missing/short var aborts start with a readable message | `server/src/config/env.ts` |
| A3 | Migrations are committed; the schema is reproducible | `server/prisma/migrations/20260901154312_init/` |

## Authentication & RBAC

| # | Criterion | Test |
|---|-----------|------|
| B1 | Log in as seeded admin and agent | `integration/auth.test.ts` › *logs in with correct credentials* |
| B2 | Wrong password → 401 with the standard error shape | `auth.test.ts` › *rejects a wrong password with 401 and the standard error shape* |
| B3 | Unknown email → same 401 as wrong password (no user enumeration) | `auth.test.ts` › *rejects an unknown email the same way as a wrong password* |
| B4 | Deactivated account cannot log in | `auth.test.ts` › *rejects a deactivated user* |
| B5 | Malformed login body → 400 with `error.details[]` | `auth.test.ts` › *returns 400 VALIDATION_ERROR with details for a malformed body* |
| B6 | Missing / garbage token on a protected route → 401 | `auth.test.ts` › *requires a bearer token* / *rejects a garbage token*; `tickets.test.ts` › *requires a token for every tickets route* |
| B7 | `GET /auth/me` returns the caller | `auth.test.ts` › *returns the current user for a valid token* |
| B8 | Agent hitting an admin route → 403 `FORBIDDEN` | `users.test.ts` › *blocks a non-admin from creating a user (403 FORBIDDEN)*; `customers.test.ts` › *blocks an agent (non-admin) from deleting a customer with 403* |
| B9 | RBAC decision function is unit-tested | `unit/authorize.test.ts` (3 cases) |
| B10 | Frontend redirects to `/login` when unauthenticated | `web · ProtectedRoute.test.tsx` › *redirects to /login when there is no session* |
| B11 | Frontend login success routes into the app; failure shows a server error | `web · LoginPage.test.tsx` (2 cases) |

## Customers

| # | Criterion | Test |
|---|-----------|------|
| C1 | Create a valid customer → 201 | `customers.test.ts` › *creates a customer* |
| C2 | Invalid email → 400 `VALIDATION_ERROR` | `customers.test.ts` › *rejects an invalid email with 400 VALIDATION_ERROR* |
| C3 | List honours `?q` and returns `{ data, page, pageSize, total }` | `customers.test.ts` › *lists customers with pagination shape and honors `q`* |
| C4 | Detail includes recent ticket history | `customers.test.ts` › *gets a customer with recent ticket history included* |
| C5 | Missing id → 404 | `customers.test.ts` › *404s for a missing customer* |
| C6 | Partial update touches only supplied fields | `customers.test.ts` › *updates a customer* |
| C7 | Delete blocked (409) while a non-closed ticket exists; allowed (204) once closed | `customers.test.ts` › *blocks deleting a customer with a non-closed ticket (409), then allows it once closed* |
| C8 | Admin can delete an eligible customer | `customers.test.ts` › *lets an agent delete a customer with no open tickets* (as admin) |

## Tickets

| # | Criterion | Test |
|---|-----------|------|
| D1 | Create → `reference` `TKT-NNNN`, status `OPEN` | `tickets.test.ts` › *sets SLA due dates from priority on creation* |
| D2 | Create computes SLA due dates from priority | same as D1 (URGENT → +1 h / +4 h) |
| D3 | Unknown `customerId` → 400 | `tickets.test.ts` › *rejects an unknown customerId with a validation error* |
| D4 | Create writes a `CREATED` audit event | `tickets.test.ts` › *writes a CREATED audit event* |
| D5 | First non-internal comment stamps `firstRespondedAt`; a second does not; internal note does not | `tickets.test.ts` › *stamps firstRespondedAt on the first non-internal comment only* / *does not stamp firstRespondedAt for an internal note* |
| D6 | Priority `LOW → URGENT` recomputes the resolution due date and logs `PRIORITY_CHANGED` | `tickets.test.ts` › *recomputes the resolution due date and logs PRIORITY_CHANGED on LOW -> URGENT* |
| D7 | `OPEN → CLOSED` → 409 `INVALID_TRANSITION` | `tickets.test.ts` › *rejects OPEN -> CLOSED with 409 INVALID_TRANSITION* |
| D8 | `OPEN → IN_PROGRESS → RESOLVED → CLOSED` all succeed; timestamps set; `OPEN→IN_PROGRESS` stamps first response | `tickets.test.ts` › *allows OPEN -> IN_PROGRESS -> RESOLVED -> CLOSED* |
| D9 | Reopening a `CLOSED` ticket clears `resolvedAt`/`closedAt` and logs `REOPENED` | `tickets.test.ts` › *reopening a CLOSED ticket clears resolvedAt/closedAt and logs REOPENED* |
| D10 | Escalate bumps priority one level, sets `isEscalated`, writes `ESCALATED`; caps at `URGENT` | `tickets.test.ts` › *bumps priority, sets isEscalated, and writes an ESCALATED event* / *caps at URGENT* |
| D11 | Assign to another agent sets `assignee` + logs `ASSIGNED`; non-user → 400; `null` → `UNASSIGNED` | `tickets.test.ts` › *assigns to another agent and logs ASSIGNED* / *rejects assigning to a non-existent user…* / *unassigns with assigneeId: null…* |
| D12 | List filters by status with the standard pagination shape | `tickets.test.ts` › *filters by status and paginates with the standard shape* |
| D13 | List sorts by priority ascending and descending | `tickets.test.ts` › *sorts by priority ascending and descending* |
| D14 | `mine=true` and `unassigned=true` filters | `tickets.test.ts` › *supports `mine=true`* / *supports `unassigned=true`* |
| D15 | Invalid query enum → 400 | `tickets.test.ts` › *rejects an invalid query value with 400* |
| D16 | Frontend ticket list renders from the API and refetches on filter change | `web · TicketsListPage.test.tsx` (2 cases) |
| D17 | Frontend ticket detail posts a comment and shows it | `web · TicketDetailPage.test.tsx` › *posts a new comment and shows it after refetch* |

## SLA & escalation

| # | Criterion | Test |
|---|-----------|------|
| E1 | SLA math per priority is correct | `unit/sla.test.ts` › *computeSlaDueDates* (4 priorities) |
| E2 | Breach boundary: exactly at due = not breached; +1 ms = breached; never after responded/resolved | `unit/sla.test.ts` › *breach boundaries* (3 cases) |
| E3 | Priority change recomputes response due date only while unresponded | `unit/sla.test.ts` › *recomputeSlaOnPriorityChange* (2 cases) |
| E4 | `bumpPriority` steps one level, caps at `URGENT` | `unit/sla.test.ts` › *escalates one step at a time and caps at URGENT* |
| E5 | `deriveSlaFields` returns remaining time + breach flags | `unit/sla.test.ts` › *reports remaining time and breach flags together* |
| E6 | Sweep flags a response breach exactly once across repeated runs | `integration/slaSweep.test.ts` › *flags an overdue, unresponded ticket exactly once…* |
| E7 | Sweep auto-escalates an overdue unresolved unescalated ticket and does not re-escalate | `slaSweep.test.ts` › *auto-escalates an overdue unresolved, unescalated ticket and does not re-escalate it* |
| E8 | Sweep leaves resolved / already-escalated tickets alone | `slaSweep.test.ts` › *does not touch a ticket that is already resolved or already escalated* |
| E9 | Sweep is available on demand | `POST /api/admin/run-sla-sweep` (ADMIN) — `modules/admin/admin.routes.ts` |

## Status transitions (pure)

| # | Criterion | Test |
|---|-----------|------|
| F1 | Free movement between active statuses | `unit/transitions.test.ts` › *allows moving freely between active statuses* |
| F2 | Any active → `RESOLVED` allowed | *allows any active status to move to RESOLVED* |
| F3 | Active → `CLOSED` rejected | *rejects an active status moving straight to CLOSED* |
| F4 | `RESOLVED → CLOSED` allowed; `CLOSED → RESOLVED` rejected | *allows RESOLVED -> CLOSED* / *rejects CLOSED -> RESOLVED directly* |
| F5 | Reopen from `RESOLVED`/`CLOSED` to any active status | *allows reopening RESOLVED or CLOSED back to any active status* |
| F6 | Same-status is a no-op | *treats same-status as a no-op, not a reopen* |

## Dashboard

| # | Criterion | Test |
|---|-----------|------|
| G1 | `/dashboard/stats` numbers match a hand count | `integration/dashboard.test.ts` › *matches a hand count of seeded/fixture data* |
| G2 | `myOpen` / `unassigned` count active-status tickets only | same test (RESOLVED excluded from `unassigned`) |

## API conventions & errors

| # | Criterion | Test |
|---|-----------|------|
| H1 | Single error envelope everywhere | asserted across auth / customers / tickets / users tests |
| H2 | Unknown route → 404 with the standard shape | `integration/health.test.ts` › *returns the standard error shape for unknown routes* |
| H3 | `AppError` subclasses map to the right status + code | `unit/errors.test.ts` › *AppError subclasses* |
| H4 | Duplicate email → 409 (Prisma `P2002` mapping) | `users.test.ts` › *rejects a duplicate email with 409* |
| H5 | Health check | `health.test.ts` › *reports ok* |

## Users

| # | Criterion | Test |
|---|-----------|------|
| I1 | Any authenticated user can list users | `users.test.ts` › *lets any authenticated user list active users…* |
| I2 | Admin can create a user | `users.test.ts` › *lets an admin create a user* |
| I3 | Admin can deactivate a user | `users.test.ts` › *lets an admin deactivate a user* |
| I4 | Deactivated users hidden from agents, visible to admins | `users.test.ts` › *hides deactivated users from an agent but shows them to an admin* |

## Build & quality gates

| # | Criterion | Evidence |
|---|-----------|----------|
| J1 | `npm run typecheck` clean in both workspaces | CI job `typecheck` |
| J2 | `npm test` — 76 backend tests green | CI job `server-tests` |
| J3 | `npm run test:web` — 6 frontend tests green | CI job `web-tests` |
| J4 | `npm run build` — server `tsc` + web `vite build` succeed | CI job `build` |
| J5 | `npm run lint` clean (ESLint + Prettier) | CI job `lint` |
| J6 | Git history is incremental with descriptive messages | `git log` — 5 phase/docs commits + this SDD change |
| J7 | Running app verified end-to-end in a browser | Phase 6 — login → dashboard → tickets → detail → customers → users, zero console errors |
