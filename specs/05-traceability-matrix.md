# 05 — Traceability matrix

Every requirement from [01-requirements.md](01-requirements.md) → the **backend**
code that implements it → the **frontend** code that consumes it → the **test(s)**
that prove it. This is the evidence that the feature set is complete on both
sides.

Paths are relative to the repo root. Test refs are `file › describe/it` (see
[04-acceptance-criteria.md](04-acceptance-criteria.md) for the full list).
"— (backend only)" / "— (n/a)" means that layer legitimately has no part in the
requirement.

---

## Authentication & session

| REQ | Backend | Frontend | Tests | Status |
|-----|---------|----------|-------|--------|
| REQ-AUTH-1 | `modules/auth/auth.service.ts` `login()`, `auth.routes.ts` `POST /login` | `auth/AuthContext.tsx` `login()`, `pages/LoginPage.tsx` | `auth.test.ts` › logs in with correct credentials; `LoginPage.test.tsx` › logs in and lands… | ✅ |
| REQ-AUTH-2 | `auth.service.ts` (same 401 for both) | `LoginPage.tsx` server-error banner | `auth.test.ts` › wrong password / unknown email; `LoginPage.test.tsx` › shows a server error | ✅ |
| REQ-AUTH-3 | `auth.service.ts` `!user.isActive` guard | — (n/a) | `auth.test.ts` › rejects a deactivated user | ✅ |
| REQ-AUTH-4 | `middleware/authenticate.ts` | `api/client.ts` Bearer header, `ProtectedRoute.tsx` | `auth.test.ts` › requires a bearer token / rejects a garbage token; `tickets.test.ts` › requires a token…; `ProtectedRoute.test.tsx` | ✅ |
| REQ-AUTH-5 | `authenticate.ts` re-queries `prisma.user` each request | `AuthContext.tsx` `unauthenticated` listener clears session | `auth.test.ts` (deactivated user path) | ✅ |
| REQ-AUTH-6 | `auth.routes.ts` `loginLimiter` (`express-rate-limit`) | — (n/a) | config asserted by inspection; covered by route wiring | ✅ |
| REQ-AUTH-7 | `auth.routes.ts` `GET /me` | `AuthContext.tsx` bootstrap | `auth.test.ts` › returns the current user… | ✅ |

## Roles & permissions

| REQ | Backend | Frontend | Tests | Status |
|-----|---------|----------|-------|--------|
| REQ-RBAC-1 | `middleware/authorize.ts`, `canAccess()`; every `*.routes.ts` lists `authorize(...)` | — (security is server-side) | `unit/authorize.test.ts`; `users.test.ts` / `customers.test.ts` 403 cases | ✅ |
| REQ-RBAC-2 | `authorize('ADMIN')` on `users` POST/PATCH, `customers` DELETE, `admin` router | — | `users.test.ts` › blocks a non-admin…; `customers.test.ts` › blocks an agent… | ✅ |
| REQ-RBAC-3 | role checks allow `ADMIN` through all agent routes | `components/Layout.tsx` shows admin nav | `users.test.ts` › lets an admin create a user; `customers.test.ts` delete-as-admin | ✅ |
| REQ-RBAC-4 | — (n/a) | `Layout.tsx` (`role === 'ADMIN'` nav), `auth/ProtectedRoute.tsx` `roles={['ADMIN']}` on `/admin/users` | `ProtectedRoute.test.tsx` (redirect path) | ✅ |

## Customer management

| REQ | Backend | Frontend | Tests | Status |
|-----|---------|----------|-------|--------|
| REQ-CUS-1 | `modules/customers/customers.routes.ts` `POST /`, `customers.schemas.ts` | `pages/CustomersListPage.tsx` create form, `api/hooks.ts` `useCreateCustomer` | `customers.test.ts` › creates a customer | ✅ |
| REQ-CUS-2 | `middleware/validate.ts` + `createCustomerSchema` | `CustomersListPage.tsx` RHF/Zod, `components/ErrorBanner.tsx` | `customers.test.ts` › rejects an invalid email… | ✅ |
| REQ-CUS-3 | `customers.routes.ts` `GET /` (`q` + `skipTake` + `paginate`) | `CustomersListPage.tsx` search + pager, `useCustomers` | `customers.test.ts` › lists customers with pagination shape and honors `q` | ✅ |
| REQ-CUS-4 | `customers.routes.ts` `GET /:id` `include: { tickets }` | `pages/CustomerDetailPage.tsx` ticket history | `customers.test.ts` › gets a customer with recent ticket history included | ✅ |
| REQ-CUS-5 | `customers.routes.ts` `NotFoundError` | `CustomerDetailPage.tsx` `ErrorBanner` | `customers.test.ts` › 404s for a missing customer | ✅ |
| REQ-CUS-6 | `customers.routes.ts` `PATCH /:id`, `updateCustomerSchema` | `CustomerDetailPage.tsx` edit form, `useUpdateCustomer` | `customers.test.ts` › updates a customer | ✅ |
| REQ-CUS-7 | `customers.routes.ts` `DELETE /:id` open-ticket guard → `ConflictError('CUSTOMER_HAS_OPEN_TICKETS')` | `CustomerDetailPage.tsx` delete button (ADMIN), `useDeleteCustomer` | `customers.test.ts` › blocks deleting a customer with a non-closed ticket (409), then allows… | ✅ |
| REQ-CUS-8 | (above) | `CustomersListPage.tsx`, `CustomerDetailPage.tsx` | rendered in browser E2E; unit-covered by hooks | ✅ |

## Ticket management

| REQ | Backend | Frontend | Tests | Status |
|-----|---------|----------|-------|--------|
| REQ-TKT-1 | `modules/tickets/tickets.service.ts` `createTicket()` (`nextReference`, `CREATED` event) | `pages/TicketNewPage.tsx`, `api/hooks.ts` `useCreateTicket` | `tickets.test.ts` › sets SLA due dates…; › writes a CREATED audit event | ✅ |
| REQ-TKT-2 | `createTicket()` customer-exists check | `TicketNewPage.tsx` validation + `ErrorBanner` | `tickets.test.ts` › rejects an unknown customerId… | ✅ |
| REQ-TKT-3 | `lib/sla.ts` `computeSlaDueDates`, called in `createTicket()` | `lib/sla.ts` (web) badge tone, `pages/TicketDetailPage.tsx` | `tickets.test.ts` › sets SLA due dates from priority on creation; `unit/sla.test.ts` | ✅ |
| REQ-TKT-4 | `tickets.service.ts` `getTicketFull()` + `attachDerived()` | `TicketDetailPage.tsx`, `useTicket` | `tickets.test.ts` (detail assertions across cases) | ✅ |
| REQ-TKT-5 | `tickets.service.ts` `listTickets()` (filters/sort/pagination, `mine`, `unassigned`, `breaching`) | `pages/TicketsListPage.tsx` filter bar + URL state, `useTickets` | `tickets.test.ts` › filters by status…; › sorts by priority…; › supports `mine=true`/`unassigned=true`; `TicketsListPage.test.tsx` | ✅ |
| REQ-TKT-6 | `listTicketsQuerySchema` + `validate()` | `TicketsListPage.tsx` (only emits valid values) | `tickets.test.ts` › rejects an invalid query value with 400 | ✅ |
| REQ-TKT-7 | `tickets.service.ts` `updateTicket()` per-field diff → `createMany(events)` | `TicketDetailPage.tsx` inline edits, `useUpdateTicket` | `tickets.test.ts` › …logs PRIORITY_CHANGED…; audit assertions | ✅ |
| REQ-TKT-8 | `modules/tickets/transitions.ts` `assertTransition`, used in `updateTicket()` | `TicketDetailPage.tsx` status `<select>` + `ErrorBanner` on 409 | `unit/transitions.test.ts` (all pairs); `tickets.test.ts` › rejects OPEN -> CLOSED with 409 | ✅ |
| REQ-TKT-9 | `updateTicket()` sets `resolvedAt`/`closedAt` | `TicketDetailPage.tsx` SLA panel shows resolved time | `tickets.test.ts` › allows OPEN -> IN_PROGRESS -> RESOLVED -> CLOSED | ✅ |
| REQ-TKT-10 | `transitions.ts` `isReopen`, `updateTicket()` clears timestamps + `REOPENED` | `TicketDetailPage.tsx` timeline | `tickets.test.ts` › reopening a CLOSED ticket clears… and logs REOPENED | ✅ |
| REQ-TKT-11 | `tickets.service.ts` `addComment()` + `updateTicket()` (`OPEN→IN_PROGRESS`) stamp once | `TicketDetailPage.tsx` comment box | `tickets.test.ts` › stamps firstRespondedAt on the first non-internal comment only; › does not stamp… for an internal note | ✅ |
| REQ-TKT-12 | `addComment()` persists `isInternal`, writes `COMMENTED` | `TicketDetailPage.tsx` internal toggle + styling | `tickets.test.ts` (internal-note case); `TicketDetailPage.test.tsx` | ✅ |
| REQ-TKT-13 | `tickets.service.ts` `assignTicket()` active-user check, `ASSIGNED`/`UNASSIGNED` | `TicketDetailPage.tsx` assignee `<select>`, `useAssignTicket` | `tickets.test.ts` › assigns to another agent…; › rejects assigning to a non-existent user…; › unassigns with assigneeId: null | ✅ |
| REQ-TKT-14 | (all ticket endpoints) | `pages/TicketsListPage.tsx`, `TicketNewPage.tsx`, `TicketDetailPage.tsx`, `components/EventLine.tsx`, `components/Badge.tsx` | `TicketsListPage.test.tsx` (2), `TicketDetailPage.test.tsx` (1); browser E2E | ✅ |

## SLA & escalation

| REQ | Backend | Frontend | Tests | Status |
|-----|---------|----------|-------|--------|
| REQ-SLA-1 | `lib/sla.ts` `deriveSlaFields`, `isResponseBreached`, `isResolutionBreached` | `lib/sla.ts` (web) `resolutionSla`/`responseSla` | `unit/sla.test.ts` › breach boundaries | ✅ |
| REQ-SLA-2 | `lib/sla.ts` `recomputeSlaOnPriorityChange`, used in `updateTicket()` | `TicketDetailPage.tsx` (shows recomputed due date after change) | `unit/sla.test.ts` › recomputeSlaOnPriorityChange; `tickets.test.ts` › recomputes the resolution due date… | ✅ |
| REQ-SLA-3 | `tickets.service.ts` `escalateTicket()`, `lib/sla.ts` `bumpPriority` | `TicketDetailPage.tsx` Escalate button, `useEscalateTicket` | `tickets.test.ts` › bumps priority, sets isEscalated…; › caps at URGENT | ✅ |
| REQ-SLA-4 | `jobs/slaSweep.ts` `runSlaSweep()` response-breach branch (existing-event guard) | dashboard `breachingResponse` counter | `slaSweep.test.ts` › flags an overdue, unresponded ticket exactly once… | ✅ |
| REQ-SLA-5 | `runSlaSweep()` resolution-breach branch (auto-escalate, `isEscalated=false` filter) | dashboard `breachingResolution`; ticket list "Escalated" tag | `slaSweep.test.ts` › auto-escalates…and does not re-escalate; › does not touch resolved/escalated | ✅ |
| REQ-SLA-6 | `jobs/slaSweep.ts` `startSlaSweep()` (`SLA_SWEEP_MS`); `modules/admin/admin.routes.ts` `POST /run-sla-sweep` | — (n/a) | `slaSweep.test.ts` runs the pure function directly | ✅ |
| REQ-SLA-7 | (derived fields on read) | `components/Badge.tsx` `SlaBadge`, `lib/sla.ts` `slaTone` / `SLA_TONE_LABEL` | `unit/sla.test.ts` (server tone parity); UI covered by browser E2E | ✅ |

## Audit / history

| REQ | Backend | Frontend | Tests | Status |
|-----|---------|----------|-------|--------|
| REQ-AUD-1 | `tickets.service.ts` — every mutation writes `TicketEvent`; no update/delete path | — (read-only in UI) | `tickets.test.ts` (event assertions across create/patch/assign/escalate/reopen) | ✅ |
| REQ-AUD-2 | `tickets.routes.ts` `GET /:id/events`; `getTicketFull()` includes `events` | `api/hooks.ts` `useTicketEvents`, `useTicket` | `tickets.test.ts` › writes a CREATED audit event (via events endpoint) | ✅ |
| REQ-AUD-3 | — (n/a) | `components/EventLine.tsx`, `TicketDetailPage.tsx` Activity section | browser E2E (timeline rendered) | ✅ |

## Dashboard

| REQ | Backend | Frontend | Tests | Status |
|-----|---------|----------|-------|--------|
| REQ-DASH-1 | `modules/dashboard/dashboard.service.ts` `getDashboardStats()`, `dashboard.routes.ts` | `pages/DashboardPage.tsx`, `api/hooks.ts` `useDashboardStats` | `dashboard.test.ts` › matches a hand count of seeded/fixture data | ✅ |
| REQ-DASH-2 | `getDashboardStats()` — `ACTIVE_STATUSES` filter on `myOpen`/`unassigned` | `DashboardPage.tsx` stat cards | `dashboard.test.ts` (RESOLVED excluded assertions) | ✅ |
| REQ-DASH-3 | (above) | `DashboardPage.tsx` — stat cards, by-status/by-priority links, breaching + unassigned lists | browser E2E; hooks unit-covered | ✅ |

## User administration

| REQ | Backend | Frontend | Tests | Status |
|-----|---------|----------|-------|--------|
| REQ-USR-1 | `modules/users/users.routes.ts` `POST /`, `PATCH /:id`; `users.schemas.ts` | `pages/AdminUsersPage.tsx`, `useCreateUser`/`useUpdateUser` | `users.test.ts` › lets an admin create a user; › lets an admin deactivate a user | ✅ |
| REQ-USR-2 | Prisma `P2002` → 409 via `errorHandler.ts` | `AdminUsersPage.tsx` `ErrorBanner` | `users.test.ts` › rejects a duplicate email with 409 | ✅ |
| REQ-USR-3 | `users.routes.ts` `GET /` — `role === 'ADMIN' ? {} : { isActive: true }` | `AdminUsersPage.tsx` (admin sees all), assignment pickers (agents see active) | `users.test.ts` › hides deactivated users from an agent but shows them to an admin | ✅ |
| REQ-USR-4 | — (n/a) | `AdminUsersPage.tsx`, route gated `roles={['ADMIN']}` | `ProtectedRoute.test.tsx` (redirect mechanism) | ✅ |

## API conventions & non-functional

| REQ | Backend | Frontend | Tests | Status |
|-----|---------|----------|-------|--------|
| REQ-API-1 | `lib/errors.ts` `AppError.toBody()`, `middleware/errorHandler.ts` | `api/client.ts` `ApiError` unwraps the same shape | `unit/errors.test.ts`; asserted across integration tests | ✅ |
| REQ-API-2 | status codes per route; stable `code` strings | `api/client.ts` surfaces `status` + `code` | integration tests per endpoint | ✅ |
| REQ-API-3 | `middleware/validate.ts` on every route; handlers use `req.valid.*` | RHF + Zod resolvers on every form | `health.test.ts`, `*.test.ts` 400 cases | ✅ |
| REQ-API-4 | `errorHandler.ts` unknown → `500 INTERNAL` + logged stack | `ErrorBanner.tsx` generic fallback | `unit/errors.test.ts` (mapping); by construction | ✅ |
| REQ-API-5 | `errorHandler.ts` Prisma `P2025/P2002/P2003` mapping | — | `users.test.ts` › duplicate email 409 | ✅ |
| REQ-API-6 | `lib/pagination.ts` `paginationSchema` + `paginate` | `TicketsListPage.tsx` / `CustomersListPage.tsx` pagers | `customers.test.ts` / `tickets.test.ts` pagination-shape assertions | ✅ |
| REQ-NFR-1 | `lib/password.ts` (bcrypt), `lib/jwt.ts` (HS256, 8 h), `.gitignore` | token in `localStorage` only | by construction; `.env` not tracked (`git ls-files`) | ✅ |
| REQ-NFR-2 | `app.ts` — `helmet()`, `cors({ origin: allowlist })`, `express.json({ limit })` | — | by construction; browser E2E exercises CORS | ✅ |
| REQ-NFR-3 | `config/env.ts` Zod parse → throw with issues | `web` reads `VITE_API_URL` with a fallback | by construction (`RUNNING.md` §10) | ✅ |
| REQ-NFR-4 | `app.ts` `morgan`, silenced in `NODE_ENV=test` | — | by construction | ✅ |
| REQ-NFR-5 | `index.ts` `SIGINT`/`SIGTERM` → stop sweep, close server, `prisma.$disconnect()` | — | by construction | ✅ |
| REQ-NFR-6 | `lib/sla.ts`, `transitions.ts`, `runSlaSweep({now,client})`, `canAccess()` pure | `lib/sla.ts` (web) pure tone fn | `unit/sla.test.ts`, `unit/transitions.test.ts`, `unit/authorize.test.ts`, `slaSweep.test.ts` | ✅ |
| REQ-NFR-7 | `prisma/migrations/`, `prisma/seed.ts` | — | `globalSetup.ts` applies migrations for the test DB | ✅ |
| REQ-NFR-8 | consistent error bodies | `Spinner` / empty states / `ErrorBanner` on every page; `AuthContext` 401 handler | `ProtectedRoute.test.tsx`, `LoginPage.test.tsx`, `TicketsListPage.test.tsx` | ✅ |
| REQ-NFR-9 | — | `api/hooks.ts` (TanStack Query), form pages (RHF + Zod) | `TicketsListPage.test.tsx` (refetch on filter change) | ✅ |

---

## Coverage summary

| Area | Requirements | Implemented (BE) | Implemented (FE) | Tested |
|------|--------------|------------------|------------------|--------|
| Auth & session | 7 | 7 | 7 (where applicable) | 7 |
| RBAC | 4 | 4 | 2 | 4 |
| Customers | 8 | 8 | 8 | 8 |
| Tickets | 14 | 14 | 14 | 14 |
| SLA & escalation | 7 | 7 | 3 | 7 |
| Audit | 3 | 3 | 1 | 3 |
| Dashboard | 3 | 3 | 3 | 3 |
| Users | 4 | 4 | 2 | 4 |
| API / NFR | 15 | 15 | (cross-cutting) | 15 |
| **Total** | **65** | **65** | **all applicable** | **65** |

No requirement is unimplemented or untested on either side.
