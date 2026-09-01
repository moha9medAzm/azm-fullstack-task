# Customer Support CRM — Specification (MVP: Core Ticketing)

Status: **Draft for review**
Owner: mohamed
Date: 2026-09-01

---

## 1. Purpose & context

Build a working slice of the Customer Support CRM described in
`azm_squad_customer_support_crm.pdf`. The full product lists 12 feature areas;
this MVP delivers the **core support loop** end-to-end with production-shaped
engineering (validation, RBAC, errors, tests, docs) so it can be reviewed against
the AI-Assisted Full-Stack assessment rubric.

### In scope

| # | Area (from product doc)      | What we build                                                                 |
|---|------------------------------|------------------------------------------------------------------------------|
| 1 | Customer Management          | Customer profiles, contact details, notes, interaction history (per ticket)  |
| 2 | Ticket Management            | CRUD, categories, priorities, status lifecycle, assignment, escalation, history |
| 4 | Agent Dashboard             | My assigned tickets, queue counts, SLA-breaching list, unassigned list       |
| 5 | SLA & Automation (partial)   | Priority-driven response/resolution targets, derived breach flags, manual + auto escalation |
| 10| Security & Administration    | Users & roles (ADMIN / AGENT), JWT auth, permission checks, ticket audit log |

### Explicitly out of scope (assumptions)

- Real communication channels (Email / WhatsApp / SMS / Live chat / Web forms).
  `channel` is stored as an enum field on a ticket for realism; **no outbound
  messaging** is implemented.
- AI features (summaries, suggested replies, chatbot).
- Customer-facing portal (agents/admins only).
- Knowledge base, reports/BI dashboards, ERP/external integrations.
- File attachments (schema leaves room via a future `Attachment` table; not built).
- Multi-branch / multi-department / multi-tenant. Single workspace only.
- i18n / Arabic. UI is English, LTR.
- Notifications are **derived lists** in the dashboard; no email/push/websocket.

These are firm assumptions for the MVP. Any of them can become a follow-up milestone.

---

## 2. Personas & roles

| Role  | Who                          | Can                                                                 |
|-------|------------------------------|--------------------------------------------------------------------|
| ADMIN | Support lead / administrator | Everything AGENT can, plus: manage users, delete customers, reassign any ticket, change SLA-relevant fields freely |
| AGENT | Support agent                | Log in; CRUD customers; create/read/update tickets; comment; self-assign or assign to another agent; escalate; view dashboard |

No customer login in this MVP.

---

## 3. Domain model

### 3.1 Entities

**User**
- `id` (cuid), `name`, `email` (unique), `passwordHash`, `role` (ADMIN | AGENT),
  `isActive` (bool, default true), `createdAt`, `updatedAt`

**Customer**
- `id`, `name`, `email` (unique, required), `phone` (nullable), `company` (nullable),
  `notes` (text, nullable), `createdAt`, `updatedAt`
- Soft constraint: cannot be deleted while it has non-CLOSED tickets (409).

**Ticket**
- `id`, `reference` (human id, e.g. `TKT-1042`, unique, auto), `subject`, `description` (text)
- `status`: OPEN | IN_PROGRESS | PENDING | RESOLVED | CLOSED (default OPEN)
- `priority`: LOW | MEDIUM | HIGH | URGENT (default MEDIUM)
- `category`: GENERAL | TECHNICAL | BILLING | ACCOUNT | FEATURE_REQUEST (default GENERAL)
- `channel`: WEB | EMAIL | PHONE | CHAT | WHATSAPP | SMS (default WEB)
- `customerId` (FK, required)
- `assigneeId` (FK User, nullable)
- `createdById` (FK User, required)
- `isEscalated` (bool, default false)
- SLA timestamps: `slaResponseDueAt`, `slaResolutionDueAt` (set on create from priority),
  `firstRespondedAt` (nullable), `resolvedAt` (nullable), `closedAt` (nullable)
- `createdAt`, `updatedAt`

**TicketComment**
- `id`, `ticketId` (FK), `authorId` (FK User), `body` (text),
  `isInternal` (bool, default false), `createdAt`

**TicketEvent** (immutable audit / interaction history)
- `id`, `ticketId` (FK), `actorId` (FK User, nullable for system),
  `type`: CREATED | STATUS_CHANGED | PRIORITY_CHANGED | ASSIGNED | UNASSIGNED |
          ESCALATED | COMMENTED | SLA_RESPONSE_BREACHED | SLA_RESOLUTION_BREACHED | REOPENED
- `field` (nullable), `fromValue` (nullable), `toValue` (nullable), `note` (nullable),
  `createdAt`

### 3.2 Relationships

- Customer 1—* Ticket
- User (assignee) 1—* Ticket ; User (creator) 1—* Ticket
- Ticket 1—* TicketComment ; Ticket 1—* TicketEvent

### 3.3 Derived (never stored) fields on Ticket read

- `slaResponseBreached` = `firstRespondedAt == null && now > slaResponseDueAt`
- `slaResolutionBreached` = `resolvedAt == null && now > slaResolutionDueAt`
- `slaResponseRemainingMs`, `slaResolutionRemainingMs` (can be negative)

---

## 4. Business rules

### 4.1 SLA targets (from priority, set once at creation)

| Priority | Response target | Resolution target |
|----------|-----------------|-------------------|
| URGENT   | 1 h             | 4 h               |
| HIGH     | 4 h             | 24 h              |
| MEDIUM   | 8 h             | 72 h              |
| LOW      | 24 h            | 168 h (7 d)       |

- Changing priority **recomputes** `slaResolutionDueAt` (and `slaResponseDueAt`
  only if `firstRespondedAt` is still null), anchored to `createdAt`.
- Elapsed clock is wall-clock (no business-hours calendar in MVP — noted assumption).

### 4.2 Status lifecycle

```
OPEN ──▶ IN_PROGRESS ──▶ PENDING ──▶ RESOLVED ──▶ CLOSED
  ▲___________┴____________┴___________┘   (any active → any active allowed)
RESOLVED/CLOSED ──▶ OPEN  (=> "REOPENED" event, clears resolvedAt/closedAt)
```

- Allowed transitions are validated; illegal transition → `409 INVALID_TRANSITION`.
- → `RESOLVED`: set `resolvedAt = now`.
- → `CLOSED`: require current status `RESOLVED`; set `closedAt = now`.
- `RESOLVED`/`CLOSED` → any active status: clear `resolvedAt`/`closedAt`, emit `REOPENED`.

### 4.3 First response

`firstRespondedAt` is stamped (once) the first time any of these happens by an agent:
- a **non-internal** comment is added, or
- status moves `OPEN → IN_PROGRESS`.

### 4.4 Assignment

- `assigneeId` must reference an active User (ADMIN or AGENT).
- AGENT may assign to self or any other agent. ADMIN may assign to anyone.
- Setting `assigneeId = null` emits `UNASSIGNED`.

### 4.5 Escalation

- Manual: `POST /tickets/:id/escalate` → `isEscalated = true`, bump priority by one
  level (max URGENT), emit `ESCALATED`, recompute resolution SLA.
- Automatic: a background sweep (every 60 s) finds tickets where
  `slaResolutionBreached` just became true and `isEscalated == false`; escalates them
  and emits `SLA_RESOLUTION_BREACHED` + `ESCALATED`. Also emits
  `SLA_RESPONSE_BREACHED` once per ticket when response target passes with no response.
  Sweep is idempotent (guards on flags / existing events).

### 4.6 Audit

Every state-changing operation on a ticket writes exactly one primary `TicketEvent`
(plus SLA events from the sweep). Events are never edited or deleted.

### 4.7 Customer deletion

`DELETE /customers/:id` (ADMIN only) → `409 CUSTOMER_HAS_OPEN_TICKETS` if any ticket
for that customer is not `CLOSED`. Otherwise cascade-deletes that customer's tickets,
comments, and events.

---

## 5. API

Base path `/api`. JSON only. Auth via `Authorization: Bearer <jwt>` except
`/auth/login` and `/health`.

### 5.1 Conventions

- Success: `200` (read/update), `201` (create), `204` (delete).
- Error body (always): `{ "error": { "code": "STRING_CODE", "message": "human text", "details"?: [...] } }`
- Validation failures: `400 VALIDATION_ERROR` with `details` = array of `{ path, message }`.
- Auth: `401 UNAUTHENTICATED`, `403 FORBIDDEN`, `404 NOT_FOUND`, `409 <CODE>`.
- List endpoints: `?page` (1-based, default 1), `?pageSize` (default 20, max 100).
  Response: `{ data: [...], page, pageSize, total }`.

### 5.2 Endpoints

**Auth**
| Method | Path             | Role  | Body / notes                                  |
|--------|------------------|-------|-----------------------------------------------|
| POST   | `/auth/login`    | —     | `{ email, password }` → `{ token, user }`     |
| GET    | `/auth/me`       | any   | current user                                  |

**Users** (ADMIN only, except `GET /users`)
| Method | Path          | Role         | Notes                                        |
|--------|---------------|--------------|----------------------------------------------|
| GET    | `/users`      | ADMIN, AGENT | AGENT sees active users only (assignment dropdown); ADMIN sees all, incl. deactivated |
| POST   | `/users`      | ADMIN        | `{ name, email, password, role }`            |
| PATCH  | `/users/:id`  | ADMIN        | `{ name?, role?, isActive?, password? }`     |

**Customers**
| Method | Path                   | Role         | Notes                                             |
|--------|------------------------|--------------|---------------------------------------------------|
| GET    | `/customers`           | ADMIN, AGENT | `?q` (name/email/company/phone), pagination       |
| POST   | `/customers`           | ADMIN, AGENT | `{ name, email, phone?, company?, notes? }`       |
| GET    | `/customers/:id`       | ADMIN, AGENT | includes recent tickets (interaction history)     |
| PATCH  | `/customers/:id`       | ADMIN, AGENT | partial update                                    |
| DELETE | `/customers/:id`       | ADMIN        | see §4.7                                          |

**Tickets**
| Method | Path                       | Role         | Notes                                                                 |
|--------|----------------------------|--------------|---------------------------------------------------------------------|
| GET    | `/tickets`                 | ADMIN, AGENT | filters: `status, priority, category, channel, assigneeId, customerId, mine=true, breaching=true, q`; `sort` in `createdAt,-createdAt,priority,-priority,slaResolutionDueAt`; pagination |
| POST   | `/tickets`                 | ADMIN, AGENT | `{ subject, description, customerId, priority?, category?, channel?, assigneeId? }` |
| GET    | `/tickets/:id`             | ADMIN, AGENT | full: customer, assignee, comments, events, derived SLA              |
| PATCH  | `/tickets/:id`             | ADMIN, AGENT | `{ subject?, description?, status?, priority?, category?, channel?, assigneeId? }` — each change validated + audited |
| POST   | `/tickets/:id/assign`      | ADMIN, AGENT | `{ assigneeId: string | null }`                                      |
| POST   | `/tickets/:id/escalate`    | ADMIN, AGENT | §4.5                                                                 |
| POST   | `/tickets/:id/comments`    | ADMIN, AGENT | `{ body, isInternal? }`                                              |
| GET    | `/tickets/:id/events`      | ADMIN, AGENT | audit trail, newest first                                            |

**Dashboard**
| Method | Path                 | Role         | Returns                                                                 |
|--------|----------------------|--------------|----------------------------------------------------------------------|
| GET    | `/dashboard/stats`   | ADMIN, AGENT | `{ byStatus: {...}, byPriority: {...}, myOpen, unassigned, breachingResolution, breachingResponse, resolvedLast7d }` |

**Misc**
| GET | `/health` | — | `{ status: "ok" }` |

---

## 6. Frontend (React + Vite + TS)

Single agent-facing SPA. Routes:

| Route                | Screen                                                                 |
|----------------------|----------------------------------------------------------------------|
| `/login`             | Email/password form, stores JWT                                     |
| `/` (dashboard)      | Stat cards (queue by status, my open, unassigned, breaching), lists  |
| `/tickets`           | Filterable/sortable table; filter bar; "New ticket" button; pagination |
| `/tickets/new`       | Create form (customer picker w/ inline create, priority, category…)  |
| `/tickets/:id`       | Detail: fields with inline edit, status/priority/assign controls, SLA badges, comment thread (internal toggle), event timeline |
| `/customers`         | Table + search + create                                             |
| `/customers/:id`     | Profile, editable fields, ticket history list                       |
| `/admin/users`       | ADMIN only: user table, create/edit, activate/deactivate            |

Cross-cutting:
- `AuthContext` + protected routes; 401 → redirect to `/login`.
- Data layer: TanStack Query (caching, mutations, invalidation).
- Forms: React Hook Form + Zod resolver, shared schemas where practical.
- Every async view has explicit loading / empty / error states.
- SLA badges: green (>25% left), amber (<25%), red (breached).
- Minimal styling via a small CSS/utility layer (no heavy UI kit); accessible labels.

---

## 7. Non-functional requirements

- **Validation**: every request body/query parsed with Zod at the edge; handlers
  receive typed, validated input.
- **Security**: bcrypt (cost 10+) password hashing; JWT (HS256, 8 h expiry, secret
  from env); no secrets in repo; Helmet + CORS allowlist; rate-limit `/auth/login`;
  RBAC enforced server-side on every route (never trust client); parameterised
  queries via Prisma; consistent 404 (no info leak).
- **Errors**: central error middleware maps known `AppError` subclasses → codes;
  unknown → `500 INTERNAL` with logged stack, generic body.
- **Config**: `.env` (`DATABASE_URL`, `JWT_SECRET`, `PORT`, `CORS_ORIGIN`,
  `SLA_SWEEP_MS`), validated on boot; `.env.example` committed.
- **Observability**: request logging (method, path, status, ms) via pino/morgan.
- **DB**: SQLite via Prisma; migrations committed; `prisma/seed.ts` seeds 1 admin,
  2 agents, ~8 customers, ~25 tickets across states incl. some breaching.

---

## 8. Testing strategy

| Layer | Tool | Coverage target |
|-------|------|-----------------|
| Unit  | Vitest | SLA calc (`computeSlaDueDates`, breach logic w/ frozen clock), status-transition guard, RBAC helper, Zod schemas |
| Integration | Vitest + Supertest, fresh tmp SQLite per file, migrations applied | auth (login ok/bad creds/no token), customers CRUD + delete-guard 409, ticket create→SLA set→comment stamps firstRespondedAt, assign + audit event written, escalate bumps priority, invalid status transition 409, RBAC 403 (agent hitting admin route), validation 400 shape, pagination/filter correctness, dashboard stat math |
| Auto-escalation | Unit on the sweep function with injected clock + in-memory data | idempotency, escalates only breached+unescalated, emits events once |

Acceptance = all tests green + `README` steps reproduce a running app with seed data.

---

## 9. Acceptance criteria (checklist)

- [ ] `npm install && npm run db:reset && npm run dev` boots API on `:4000`,
      web on `:5173`; seed data visible.
- [ ] Can log in as seeded admin and as agent; wrong password → 401 with error shape.
- [ ] Agent hitting `POST /users` → 403 `FORBIDDEN`.
- [ ] Create ticket → `slaResponseDueAt`/`slaResolutionDueAt` match §4.1 for its priority.
- [ ] First non-internal agent comment sets `firstRespondedAt`; second comment does not change it.
- [ ] Changing priority LOW→URGENT recomputes resolution due date; emits `PRIORITY_CHANGED` event.
- [ ] Illegal transition (e.g. `OPEN → CLOSED`) → 409 `INVALID_TRANSITION`.
- [ ] Escalate bumps priority one level, sets `isEscalated`, writes `ESCALATED` event, recomputes SLA.
- [ ] Auto-sweep escalates an overdue unescalated ticket exactly once and logs SLA breach event once.
- [ ] `DELETE /customers/:id` with an open ticket → 409; after closing all tickets → 204.
- [ ] Dashboard stats numbers match a hand count on seed data.
- [ ] Every list endpoint respects `page`/`pageSize` and returns `{ data, page, pageSize, total }`.
- [ ] Invalid body → 400 with `error.details` array of `{ path, message }`.
- [ ] Frontend: ticket list filters + sort work against real API; ticket detail can comment,
      change status/priority, assign, escalate; timeline reflects each action.
- [ ] `npm test` (server) green; `npm run build` (web) succeeds with no type errors.
- [ ] README documents setup, env, scripts, seeded credentials, architecture overview,
      and "what's intentionally out of scope".

---

## 10. Open questions for reviewer

1. OK to keep SLA on wall-clock (no business-hours calendar)? — assumed **yes**.
2. Keep `register`/self-signup out entirely (users created only by admin + seed)? — assumed **yes**.
3. Is a lightweight `setInterval` sweep acceptable in-process, or do you want it
   behind a manual `POST /admin/run-sla-sweep` trigger only? — assumed **both**
   (interval on by default, plus manual trigger for tests/demo).
