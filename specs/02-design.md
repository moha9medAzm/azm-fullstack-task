# 02 — Design

How the system is built to satisfy [01-requirements.md](01-requirements.md).
Decisions with alternatives are in [adr/](adr/).

---

## 1. Architecture at a glance

```
┌──────────────┐        HTTPS/JSON         ┌───────────────────────────────┐
│  React SPA   │  ───────────────────────▶ │  Express API (/api)           │
│  (web/)      │   Bearer JWT              │  authenticate → authorize     │
│              │ ◀─────────────────────────│    → validate(Zod)            │
│ TanStack     │  { data } | { error }    │    → route → service          │
│ Query + RHF  │                          │      → Prisma → SQLite        │
└──────────────┘                          │  errorHandler (last)          │
                                          │  setInterval → runSlaSweep()  │
                                          └───────────────────────────────┘
```

- **Two workspaces**, no shared package (kept setup trivial — see
  [ADR-0001](adr/0001-stack-and-database.md)). Types/enums are mirrored in
  `web/src/api/types.ts`.
- **App factory** `createApp()` returns the Express app with no `listen()`, so
  Supertest drives the real router in-process.
- **Request pipeline** (every protected route): `helmet` → `cors` → JSON parse →
  `morgan` → `authenticate` → `authorize(...)` → `validate({ body, query, params })`
  → route handler → `service` → `errorHandler`.

---

## 2. Backend module map (`server/src/`)

| Path | Responsibility |
|------|----------------|
| `index.ts` | Boot: validate env, `listen`, start SLA sweep, wire graceful shutdown |
| `app.ts` | `createApp()` — middleware stack + router mount + error handler |
| `routes.ts` | Mounts feature routers under `/api` |
| `config/env.ts` | Zod-validated `process.env`; throws on boot if invalid |
| `db/prisma.ts` | `PrismaClient` singleton (survives dev hot-reload) |
| `lib/errors.ts` | `AppError` + `ValidationError` / `Unauthenticated` / `Forbidden` / `NotFound` / `Conflict`; each carries `status` + stable `code` + `toBody()` |
| `lib/sla.ts` | **Pure**: `computeSlaDueDates`, `recomputeSlaOnPriorityChange`, `isResponseBreached`, `isResolutionBreached`, `deriveSlaFields`, `bumpPriority` |
| `lib/jwt.ts` / `lib/password.ts` | Sign/verify JWT; bcrypt hash/verify |
| `lib/pagination.ts` | `paginationSchema`, `skipTake`, `paginate` |
| `lib/asyncHandler.ts` | Wrap async handlers so rejections reach `errorHandler` |
| `middleware/authenticate.ts` | Bearer → verify → **re-load user from DB** → `req.user` |
| `middleware/authorize.ts` | `authorize(...roles)` route guard; `canAccess()` is the pure decision |
| `middleware/validate.ts` | `validate({body,query,params})` → parsed values on `req.valid` |
| `middleware/errorHandler.ts` | `notFoundHandler` + central `errorHandler` (AppError / Prisma / 500) |
| `modules/<x>/<x>.routes.ts` | Thin: parse → call service → send. Lists `authorize(...)` explicitly |
| `modules/<x>/<x>.service.ts` | Business rules; the only place that touches Prisma for that aggregate; writes its own audit events |
| `modules/<x>/<x>.schemas.ts` | Zod schemas for that module |
| `modules/tickets/transitions.ts` | **Pure**: allowed-transition matrix, `assertTransition`, `isReopen` |
| `jobs/slaSweep.ts` | **Pure** `runSlaSweep({ now, client })` + `startSlaSweep()` interval wrapper |
| `types/enums.ts` | Single source of truth for enum values (SQLite has no native enums — see [ADR-0002](adr/0002-enums-as-validated-strings.md)) |

**Separation of concerns:** a route never contains business logic; a service never
reads `req`/`res`; pure helpers never import Prisma. This is what makes the core
unit-testable without a database or a running server.

---

## 3. Frontend module map (`web/src/`)

| Path | Responsibility |
|------|----------------|
| `App.tsx` | `QueryClientProvider` → `BrowserRouter` → `AuthProvider` → route table |
| `api/client.ts` | `fetch` wrapper: inject Bearer, unwrap `{ data }` / throw typed `ApiError`, emit `unauthenticated` on 401 |
| `api/hooks.ts` | One TanStack Query hook per resource action (queries + mutations with cache invalidation) |
| `api/types.ts` | TS mirror of backend types + enums |
| `auth/AuthContext.tsx` | Holds `{ user, loading, login, logout }`; bootstraps from stored token via `/auth/me`; clears on 401 |
| `auth/ProtectedRoute.tsx` | Redirects to `/login` when unauthenticated; optional `roles` gate |
| `components/` | `Badge` (status/priority/SLA), `StatCard`, `Spinner`, `ErrorBanner`, `Layout` (nav), `EventLine` (timeline row) |
| `lib/sla.ts` | Badge tone from remaining vs. total window (mirrors server breach flags for colour only) |
| `lib/format.ts` | `formatDateTime`, `formatRelative`, `titleCase` |
| `pages/` | `Login`, `Dashboard`, `TicketsList`, `TicketNew`, `TicketDetail`, `CustomersList`, `CustomerDetail`, `AdminUsers` |

State model: **server state** lives in TanStack Query (cache keyed by resource +
params, invalidated on mutation); **UI state** (filters, drafts) lives in the URL
(`useSearchParams`) or local `useState`; **session** lives in `AuthContext` +
`localStorage` (`crm.token`).

---

## 4. Data model

```
User ──1:*── Ticket (assignee, nullable, SET NULL)
User ──1:*── Ticket (createdBy)
User ──1:*── TicketComment (author)
User ──1:*── TicketEvent (actor, nullable, SET NULL)
Customer ──1:*── Ticket (CASCADE)
Ticket ──1:*── TicketComment (CASCADE)
Ticket ──1:*── TicketEvent (CASCADE)
```

| Entity | Key fields |
|--------|-----------|
| **User** | `id`, `name`, `email` (unique), `passwordHash`, `role` (`ADMIN`/`AGENT`), `isActive`, timestamps |
| **Customer** | `id`, `name`, `email` (unique), `phone?`, `company?`, `notes?`, timestamps |
| **Ticket** | `id`, `reference` (unique `TKT-NNNN`), `subject`, `description`, `status`, `priority`, `category`, `channel`, `isEscalated`, `slaResponseDueAt`, `slaResolutionDueAt`, `firstRespondedAt?`, `resolvedAt?`, `closedAt?`, `customerId`, `assigneeId?`, `createdById`, timestamps |
| **TicketComment** | `id`, `ticketId`, `authorId`, `body`, `isInternal`, `createdAt` |
| **TicketEvent** | `id`, `ticketId`, `actorId?`, `type`, `field?`, `fromValue?`, `toValue?`, `note?`, `createdAt` |

Enums (stored as validated `String` — [ADR-0002](adr/0002-enums-as-validated-strings.md)):

- `Role`: `ADMIN` `AGENT`
- `TicketStatus`: `OPEN` `IN_PROGRESS` `PENDING` `RESOLVED` `CLOSED`
- `TicketPriority`: `LOW` `MEDIUM` `HIGH` `URGENT`
- `TicketCategory`: `GENERAL` `TECHNICAL` `BILLING` `ACCOUNT` `FEATURE_REQUEST`
- `TicketChannel`: `WEB` `EMAIL` `PHONE` `CHAT` `WHATSAPP` `SMS`
- `TicketEventType`: `CREATED` `UPDATED` `STATUS_CHANGED` `PRIORITY_CHANGED` `ASSIGNED` `UNASSIGNED` `ESCALATED` `COMMENTED` `SLA_RESPONSE_BREACHED` `SLA_RESOLUTION_BREACHED` `REOPENED`

Indexes: `Ticket(status)`, `Ticket(priority)`, `Ticket(assigneeId)`,
`Ticket(customerId)`, `Ticket(slaResolutionDueAt)`, `Customer(company)`,
`TicketComment(ticketId)`, `TicketEvent(ticketId)`, `TicketEvent(type)`.

### Derived (never stored) ticket fields

Computed by `deriveSlaFields(now, ticket)` on every read:
`slaResponseBreached`, `slaResolutionBreached`, `slaResponseRemainingMs`,
`slaResolutionRemainingMs`.

---

## 5. Business rules

### SLA targets

Set from priority at creation, anchored to `createdAt`:

| Priority | First response | Resolution |
|----------|----------------|------------|
| `URGENT` | 1 h | 4 h |
| `HIGH` | 4 h | 24 h |
| `MEDIUM` | 8 h | 72 h |
| `LOW` | 24 h | 168 h |

A priority change recomputes the **resolution** due date always, and the
**response** due date only while `firstRespondedAt` is null. Clock is wall-clock
UTC (no business-hours calendar — [assumption](07-assumptions-and-scope.md)).

### Status lifecycle

```
        ┌───────────────┐
        ▼               │
  OPEN ⇄ IN_PROGRESS ⇄ PENDING  ──────▶ RESOLVED ──▶ CLOSED
        (any active ⇄ any active)          │  ▲          │
                                           │  └──────────┘  (RESOLVED ⇄ CLOSED)
   RESOLVED / CLOSED ──▶ OPEN | IN_PROGRESS | PENDING   = REOPENED
```

Not allowed: any active status → `CLOSED` directly; `CLOSED` → `RESOLVED`
directly. Illegal transition → `409 INVALID_TRANSITION`. Same-status is a no-op.

### First response

`firstRespondedAt` is stamped once, by the earlier of: first non-internal agent
comment, or first `OPEN → IN_PROGRESS`.

### Escalation

Manual (`POST /tickets/:id/escalate`) or automatic (sweep on resolution breach):
`priority = bumpPriority(priority)` (cap `URGENT`), `isEscalated = true`,
resolution SLA recomputed, `ESCALATED` event.

### Audit

Every mutating ticket operation writes ≥1 immutable `TicketEvent`. The sweep adds
`SLA_RESPONSE_BREACHED` / `SLA_RESOLUTION_BREACHED` at most once each per ticket.

### Customer deletion

`ADMIN` only. `409 CUSTOMER_HAS_OPEN_TICKETS` if any ticket is not `CLOSED`;
otherwise cascade-delete the customer and its tickets/comments/events.

---

## 6. API contract

Base `/api`. JSON only. `Authorization: Bearer <jwt>` on everything except
`/auth/login` and `/health`.

**Conventions:** success `200`/`201`/`204`; errors
`{ error: { code, message, details? } }` with `400 VALIDATION_ERROR` (+`details`
`[{path,message}]`), `401 UNAUTHENTICATED`, `403 FORBIDDEN`, `404 NOT_FOUND`,
`409 <CODE>`. Lists: `?page` (≥1, default 1), `?pageSize` (1–100, default 20) →
`{ data, page, pageSize, total }`.

| Method | Path | Role | Notes |
|--------|------|------|-------|
| `POST` | `/auth/login` | — | `{ email, password }` → `{ token, user }` |
| `GET` | `/auth/me` | any | current user |
| `GET` | `/users` | ADMIN, AGENT | agents: active only; admins: all |
| `POST` | `/users` | ADMIN | `{ name, email, password, role }` |
| `PATCH` | `/users/:id` | ADMIN | `{ name?, role?, isActive?, password? }` |
| `GET` | `/customers` | ADMIN, AGENT | `?q`, pagination |
| `POST` | `/customers` | ADMIN, AGENT | `{ name, email, phone?, company?, notes? }` |
| `GET` | `/customers/:id` | ADMIN, AGENT | + recent tickets |
| `PATCH` | `/customers/:id` | ADMIN, AGENT | partial |
| `DELETE` | `/customers/:id` | ADMIN | 409 if a non-closed ticket exists |
| `GET` | `/tickets` | ADMIN, AGENT | filters + `sort` + pagination (see REQ-TKT-5) |
| `POST` | `/tickets` | ADMIN, AGENT | `{ subject, description, customerId, priority?, category?, channel?, assigneeId? }` |
| `GET` | `/tickets/:id` | ADMIN, AGENT | full + comments + events + derived SLA |
| `PATCH` | `/tickets/:id` | ADMIN, AGENT | `{ subject?, description?, status?, priority?, category?, channel?, assigneeId? }` — diffed + audited |
| `POST` | `/tickets/:id/assign` | ADMIN, AGENT | `{ assigneeId: string \| null }` |
| `POST` | `/tickets/:id/escalate` | ADMIN, AGENT | — |
| `POST` | `/tickets/:id/comments` | ADMIN, AGENT | `{ body, isInternal? }` |
| `GET` | `/tickets/:id/events` | ADMIN, AGENT | audit trail, newest first |
| `GET` | `/dashboard/stats` | ADMIN, AGENT | queue + SLA counters |
| `POST` | `/admin/run-sla-sweep` | ADMIN | run the sweep now |
| `GET` | `/health` | — | `{ status: "ok" }` |

---

## 7. Key sequence flows

### Create ticket

```
POST /tickets
  validate(body)                       → 400 on bad input
  service.createTicket(input, actor)
    customer exists?                    → 400 VALIDATION_ERROR if not
    assignee active? (if given)         → 400 if not
    now = new Date()
    { slaResponseDueAt, slaResolutionDueAt } = computeSlaDueDates(priority, now)
    tx:
      reference = nextReference(tx)     ("TKT-" + zero-padded count+1)
      ticket = create({...})
      event(CREATED)
      if assignee: event(ASSIGNED)
    return attachDerived(ticket, now)   → 201 { ticket }
```

### Patch ticket (field diffing + SLA recompute)

```
PATCH /tickets/:id
  load existing → 404 if missing
  tx, for each field present in body and != existing:
    subject|description|category|channel → data[field]=v ; event(UPDATED, field, from, to)
    priority                             → recomputeSlaOnPriorityChange(...) ;
                                           data.priority/slaResponseDueAt?/slaResolutionDueAt ;
                                           event(PRIORITY_CHANGED)
    status                               → assertTransition(from, to)  → 409 INVALID_TRANSITION
                                           RESOLVED → resolvedAt=now ; CLOSED → closedAt=now
                                           isReopen → clear resolvedAt/closedAt ; event(REOPENED)
                                           else event(STATUS_CHANGED)
                                           OPEN→IN_PROGRESS & !firstRespondedAt → firstRespondedAt=now
    assigneeId                           → active-user check ; event(ASSIGNED | UNASSIGNED)
  update(ticket, data) ; createMany(events)
  return attachDerived(updated)          → 200 { ticket }
```

### SLA sweep (`runSlaSweep({ now, client })`)

```
responseCandidates = tickets where firstRespondedAt=null AND slaResponseDueAt < now
  for each without an existing SLA_RESPONSE_BREACHED event:
    event(SLA_RESPONSE_BREACHED)                        → counted

resolutionCandidates = tickets where resolvedAt=null AND isEscalated=false
                       AND slaResolutionDueAt < now
  for each:
    newPriority = bumpPriority(priority)
    slaResolutionDueAt = recomputeSlaOnPriorityChange(newPriority, ...).slaResolutionDueAt
    update(isEscalated=true, priority=newPriority, slaResolutionDueAt)
    event(SLA_RESOLUTION_BREACHED) ; event(ESCALATED)   → counted
return { responseBreachesFlagged, resolutionBreachesEscalated }
```

Idempotent: response breaches guarded by an existing-event check; resolution
breaches self-exclude next run via `isEscalated=false` **and** the pushed-out due
date.

### Frontend auth guard

```
AuthProvider mount
  token in localStorage?  no  → loading=false, user=null
                          yes → GET /auth/me → user  |  on failure: clear token
api/client on any 401 → dispatch 'unauthenticated' → AuthProvider clears session
ProtectedRoute: loading → <Spinner/> ; !user → <Navigate to="/login"/> ;
                roles && !roles.includes(user.role) → <Navigate to="/"/>
```

---

## 8. Testing design

| Layer | Tool | What |
|-------|------|------|
| Unit | Vitest | Pure core with a **frozen clock**: SLA math + boundaries, transition matrix (every pair), `canAccess` RBAC, `AppError` mapping |
| Integration | Vitest + Supertest | Real Express app against a **fresh temp SQLite DB** (`migrate deploy` in `globalSetup`, table wipe per test): auth, customers, tickets, dashboard, users, RBAC, error shapes, pagination |
| Sweep | Vitest + real test DB | Idempotency, escalate-only-eligible, resolved/escalated untouched |
| Frontend | Vitest + Testing Library + `jsdom` | `ProtectedRoute` redirect, login happy/error, ticket list render + filter-triggered refetch (mocked `fetch`), ticket-detail comment submit |

See [04-acceptance-criteria.md](04-acceptance-criteria.md) for the item-by-item
mapping and [05-traceability-matrix.md](05-traceability-matrix.md) for
requirement → test.
