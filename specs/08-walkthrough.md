# 08 — Project walkthrough (orientation guide)

A guided tour of **what was built, how, and why** — written so you can explain
any part of the project in your own words. Read top to bottom once; use the
section headers as a map afterwards.

- Big picture → §1–2
- How it was built (the process + the planning files) → §3
- Backend, file by file → §4
- Frontend, file by file → §5
- The domain rules you must be able to explain → §6
- Data model → §7
- Tests → §8
- The decisions (ADRs) in plain language → §9
- "How to present this" — a script + likely questions → §10

---

## 1. What the project is (one paragraph)

A **Customer Support CRM**. Support **agents** log in, record **customers**,
raise **tickets** for their issues, and move each ticket through a lifecycle
(`OPEN → IN_PROGRESS → PENDING → RESOLVED → CLOSED`) against **SLA deadlines**
that come from the ticket's priority. Agents assign tickets, escalate urgent
ones, comment (publicly or as internal notes), and every change is written to an
immutable **history** (audit log). A background job watches for **SLA breaches**
and auto-escalates overdue tickets. **Admins** additionally manage the agent
roster. There is a **dashboard** showing the queue and what's breaching. Built as
a React single-page app talking to an Express/Prisma REST API over JWT.

The product brief had **12 feature areas**; this MVP implements **5 of them**
fully (customers, tickets, dashboard, SLA/automation, security/admin) rather than
all 12 shallowly. The cut list and reasoning are in
[07-assumptions-and-scope.md](07-assumptions-and-scope.md).

---

## 2. Architecture — the big picture

```
┌───────────────────────┐        HTTPS / JSON         ┌─────────────────────────────────────┐
│   React SPA  (web/)   │  ────────────────────────▶  │        Express API  (server/)        │
│                       │   Authorization: Bearer JWT │                                      │
│  • React Router       │                             │  helmet → cors → json → morgan       │
│  • TanStack Query     │  ◀────────────────────────  │    → authenticate  (verify JWT,      │
│    (server state)     │   { data … }  |  { error }  │       reload user from DB)           │
│  • React Hook Form    │                             │    → authorize(...roles)             │
│    + Zod (forms)      │                             │    → validate({ body, query })  Zod  │
│  • AuthContext        │                             │    → route handler (thin)            │
│    + localStorage     │                             │      → service  (business rules)     │
└───────────────────────┘                             │        → Prisma → SQLite             │
                                                      │  errorHandler (last middleware)      │
                                                      │  setInterval → runSlaSweep()         │
                                                      └─────────────────────────────────────┘
```

Two independent packages managed by **npm workspaces**:

| Package | What | Runs on |
|---------|------|---------|
| `server/` | Express REST API + Prisma + SQLite + the SLA sweep | `http://localhost:4000` |
| `web/` | React + Vite single-page app | `http://localhost:5173` |

They share **no code** (kept setup simple); the frontend has a hand-written copy
of the API types in `web/src/api/types.ts`.

**The request pipeline** (every protected endpoint goes through this order):

1. `helmet()` — security headers
2. `cors()` — only allow the configured browser origin(s)
3. `express.json()` — parse the body (max 1 MB)
4. `morgan` — log the request (method, path, status, ms) — off during tests
5. `authenticate` — read `Authorization: Bearer <jwt>`, verify it, **re-load the
   user row from the DB** (so a deactivated user is rejected immediately), put
   `{ id, email, role }` on `req.user`
6. `authorize('ADMIN', 'AGENT', …)` — check the role, else `403`
7. `validate({ body, query, params })` — parse with Zod; on failure `400` with a
   list of `{ path, message }`; on success the parsed values go on `req.valid`
8. **route handler** — thin: reads `req.valid`, calls one **service** function,
   sends the result
9. **service** — the business logic; the only place that touches Prisma for its
   area; writes its own audit events
10. `errorHandler` — the last middleware; turns any thrown error into the
    standard `{ error: { code, message, details? } }` shape

---

## 3. How the project was built — the process and the planning files

The method was **Spec-Driven Development (SDD)**: write the spec and the plan
*before* the code, then build against them, verifying at every step.

### 3.1 The steps that were followed

| # | Step | Output |
|---|------|--------|
| 1 | Read the brief (`azm_squad_customer_support_crm.pdf`) — 12 feature areas — and the assessment rubric | understanding of scope + how it's graded |
| 2 | **Decide scope**: 12 areas is too many to do well → pick the 5 that form the "core support loop" | [07-assumptions-and-scope.md](07-assumptions-and-scope.md) |
| 3 | **Write the requirements** — personas, user stories, and testable acceptance criteria in EARS form, each with an ID (`REQ-AUTH-1`, `REQ-TKT-8`, …) | [01-requirements.md](01-requirements.md) |
| 4 | **Write the design** — architecture, module layout, data model, full API contract, sequence flows | [02-design.md](02-design.md) |
| 5 | **Write the plan** — break the work into 7 phases / ~34 tasks, ordered so each ends with a green build | [03-task-plan.md](03-task-plan.md) |
| 6 | **Build phase by phase** — after each phase: `tsc --noEmit` clean + all tests green + a git commit | the code + git history |
| 7 | **Verify** — run the acceptance checklist, then drive the running app in a real browser end-to-end | [04-acceptance-criteria.md](04-acceptance-criteria.md) |
| 8 | **Keep the specs in sync** — whenever an implementation detail changed the contract, update the spec (e.g. the `GET /users` visibility rule, the `unassigned` filter, the `UPDATED` event type) | updated specs |
| 9 | **Package the evidence** — traceability matrix, AI-usage notes, ADRs, CI, lint/format, SECURITY.md | this `specs/` folder + `.github/` + `SECURITY.md` |

### 3.2 What each planning file is (in plain terms)

| File | In one sentence | Why it exists / how to use it |
|------|-----------------|------------------------------|
| `specs/README.md` | The index — what's in the folder and how to read it | Start here. |
| `specs/00-context.md` | The problem, the 12-vs-5 scope table, and a glossary of every term (SLA, breach, sweep, active status…) | Learn the vocabulary so you speak about it precisely. |
| `specs/01-requirements.md` | **65 numbered requirements** (`REQ-*`) with EARS acceptance criteria (`When X, the system shall Y`) | This is "what the system must do". Every row is testable. |
| `specs/02-design.md` | How the system is shaped to meet the requirements: architecture, backend/frontend module maps, data model, API table, and 4 sequence flows (create ticket, patch ticket, sweep, auth guard) | This is "how it's built". |
| `specs/03-task-plan.md` | The 7 phases / 34 tasks, each marked ✅ with the commit that delivered it and the `REQ-*` it covers | This is "the order the work was done in". |
| `specs/04-acceptance-criteria.md` | A checklist (A1, B2, C7…) where every item names the exact automated test that proves it | This is "how we know it's done". |
| `specs/05-traceability-matrix.md` | A big table: `REQ-*` → backend file → frontend file → test → ✅ | This proves **nothing is missing on the frontend or the backend**. |
| `specs/06-ai-usage-and-verification.md` | How AI was prompted, how its output was reviewed (pure functions + tests, not trust), and 6 concrete bugs that were caught and fixed | For the "AI usage & verification" rubric row. |
| `specs/07-assumptions-and-scope.md` | Everything in scope, everything out of scope (with a path back in), 10 explicit assumptions, and a dated decision log | For "assumptions" and "ownership". |
| `specs/adr/0001…0006` | One "Architecture Decision Record" per big choice: the context, the options considered, the decision, the consequences | For "explain your decisions" — see §9. |

### 3.3 The git history (the phases)

```
58abae5  Phase 0-1  scaffold + Prisma schema + env/errors/auth primitives + SLA lib
e942eab  Phase 2-4  customers, tickets, dashboard, admin, SLA sweep + seed data
0c985dd  Phase 5     React agent console (auth, dashboard, tickets, customers, admin)
f3e406b  Phase 6     hardening review + full README + activity-timeline polish
20eedba              RUNNING.md runbook
f18e17a              ESLint + Prettier + formatting
5ed9b00              specs/ SDD package + CI + SECURITY.md
```

---

## 4. Backend — every folder and file (`server/`)

```
server/
├── prisma/
│   ├── schema.prisma        the data model (see §7)
│   ├── migrations/          generated SQL, committed
│   └── seed.ts              fills the DB with demo data
└── src/
    ├── index.ts             process entry point
    ├── app.ts               builds the Express app (no listen)
    ├── routes.ts            mounts every feature router under /api
    ├── config/env.ts        validates environment variables on boot
    ├── db/prisma.ts         the single PrismaClient
    ├── types/
    │   ├── enums.ts         the allowed values for every "enum"
    │   └── express.d.ts     adds req.user and req.valid to the Express types
    ├── lib/                 small, reusable, mostly pure helpers
    │   ├── errors.ts
    │   ├── asyncHandler.ts
    │   ├── jwt.ts
    │   ├── password.ts
    │   ├── pagination.ts
    │   ├── sla.ts           ★ the SLA maths (pure)
    │   └── logger.ts
    ├── middleware/
    │   ├── authenticate.ts
    │   ├── authorize.ts
    │   ├── validate.ts
    │   └── errorHandler.ts
    ├── modules/             one folder per feature: routes + service + schemas
    │   ├── auth/
    │   ├── users/
    │   ├── customers/
    │   ├── tickets/         ★ the core; also has transitions.ts
    │   ├── dashboard/
    │   └── admin/
    └── jobs/slaSweep.ts     ★ the background SLA job
```

### 4.1 Bootstrap & wiring

**`config/env.ts`** — reads `process.env`, validates it with a Zod schema, and
**throws on boot** if anything is missing or wrong (e.g. `JWT_SECRET` shorter
than 16 chars). Everything else imports the typed `env` object from here, so the
rest of the code never touches `process.env` directly. *Why:* a misconfigured
server should fail immediately with a clear message, not halfway through a
request.

**`db/prisma.ts`** — creates one `PrismaClient` for the whole process and stashes
it on `globalThis` in dev so `tsx watch`'s hot-reload doesn't leak connections.

**`app.ts`** — exports `createApp()` which builds the Express app: the middleware
stack from §2, a `GET /health`, mounts `/api`, then the 404 handler and the
`errorHandler`. **It does not call `listen()`** — that's the key trick: the tests
import `createApp()` and drive it with Supertest with no real network.

**`index.ts`** — the actual process: `createApp()`, `server.listen(PORT)`,
`startSlaSweep()`, and a `SIGINT`/`SIGTERM` handler that stops the sweep, closes
the HTTP server, and disconnects Prisma cleanly.

**`routes.ts`** — one file that mounts all feature routers:
`/api/auth`, `/api/users`, `/api/customers`, `/api/tickets`, `/api/dashboard`,
`/api/admin`.

### 4.2 `lib/` — the helpers

**`errors.ts`** — an error class hierarchy:

```
AppError (status, code, message, details?)   .toBody() → { error: { code, message, details? } }
 ├── ValidationError      → 400  VALIDATION_ERROR   (+ details: [{ path, message }])
 ├── UnauthenticatedError → 401  UNAUTHENTICATED
 ├── ForbiddenError       → 403  FORBIDDEN
 ├── NotFoundError        → 404  NOT_FOUND
 └── ConflictError        → 409  <your CODE>   e.g. INVALID_TRANSITION, CUSTOMER_HAS_OPEN_TICKETS
```

Services `throw new NotFoundError('Ticket')`; the `errorHandler` turns it into the
right HTTP response. Anything **not** an `AppError` becomes a logged `500 INTERNAL`
with a generic body (no stack leaked to the client).

**`asyncHandler.ts`** — wraps an `async` route handler so a rejected promise is
forwarded to Express's error pipeline instead of becoming an unhandled rejection.

**`jwt.ts`** — `signToken({ sub, email, role })` and `verifyToken(str)` using
`jsonwebtoken`, HS256, secret + 8h expiry from `env`. `verifyToken` throws
`UnauthenticatedError` on a bad/expired token.

**`password.ts`** — `hashPassword` / `verifyPassword` using `bcryptjs`, cost from
`env.BCRYPT_ROUNDS`.

**`pagination.ts`** — a Zod schema for `?page` / `?pageSize` (defaults 1 / 20, max
100), a `skipTake(page, pageSize)` helper, and `paginate(data, page, pageSize,
total)` that shapes every list response as `{ data, page, pageSize, total }`.

**`sla.ts` ★** — pure functions, `now` always passed in (never `Date.now()`
inside):

| Function | What |
|----------|------|
| `SLA_TARGETS_HOURS` | the table: `URGENT` 1h/4h, `HIGH` 4h/24h, `MEDIUM` 8h/72h, `LOW` 24h/168h |
| `computeSlaDueDates(priority, anchor)` | `{ slaResponseDueAt, slaResolutionDueAt }` = anchor + targets |
| `recomputeSlaOnPriorityChange(priority, createdAt, firstRespondedAt, currentResponseDue)` | recompute the resolution due date always; recompute the response due date **only if not yet responded** |
| `isResponseBreached(now, due, firstRespondedAt)` | `firstRespondedAt == null && now > due` |
| `isResolutionBreached(now, due, resolvedAt)` | `resolvedAt == null && now > due` |
| `deriveSlaFields(now, ticket)` | `{ slaResponseBreached, slaResolutionBreached, slaResponseRemainingMs, slaResolutionRemainingMs }` |
| `bumpPriority(p)` | one level up, capped at `URGENT` |

*Why pure:* these are the trickiest parts (time maths, off-by-one). Pure +
`now`-as-argument means the unit tests freeze the clock and check exact
boundaries with zero flakiness.

**`logger.ts`** — a tiny JSON logger, silent when `NODE_ENV=test`.

### 4.3 `middleware/`

**`authenticate.ts`** — no `Bearer` header → `401`. Otherwise verify the token,
then `prisma.user.findUnique` on `sub`; if the user is missing or `isActive =
false` → `401`. On success set `req.user = { id, email, role }`. *Why re-load
from the DB:* it makes deactivation effective immediately even though the JWT is
still cryptographically valid.

**`authorize.ts`** — `authorize(...roles)` returns middleware: no `req.user` →
`401`; role not in the list → `403`. The actual decision is a **pure** function
`canAccess(role, allowed)` so it's unit-tested on its own.

**`validate.ts`** — `validate({ body?, query?, params? })` returns middleware that
`safeParse`s each part; collects **all** issues into one `400 VALIDATION_ERROR`
with `details: [{ path, message }]`; on success puts the parsed, typed values on
`req.valid`. Handlers read `req.valid.body`, never the raw `req.body`.

**`errorHandler.ts`** — two exports: `notFoundHandler` (any unmatched route →
`NotFoundError('Route')`) and `errorHandler` (the last `app.use`). The latter:
`AppError` → its status + body; known Prisma errors → mapped
(`P2025`→404, `P2002`→409 `UNIQUE_VIOLATION`, `P2003`→409 `FOREIGN_KEY_VIOLATION`);
anything else → log the stack, return `500 INTERNAL`.

### 4.4 `types/enums.ts` — why this file exists

SQLite (through Prisma) **has no native enum type**. So every "enum" column is a
plain `String`, and this file is the single source of truth for the allowed
values:

```ts
export const TICKET_STATUSES = ['OPEN','IN_PROGRESS','PENDING','RESOLVED','CLOSED'] as const;
export type TicketStatus = (typeof TICKET_STATUSES)[number];
// … same pattern for Role, TicketPriority, TicketCategory, TicketChannel, TicketEventType
```

Zod schemas do `z.enum(TICKET_STATUSES)`, so an invalid value is rejected at the
API edge with a `400`. The frontend mirrors these tuples in
`web/src/api/types.ts`. (This is [ADR-0002](adr/0002-enums-as-validated-strings.md).)

### 4.5 `modules/` — the feature pattern

Each feature folder has the same three files:

- **`<x>.schemas.ts`** — Zod schemas for that feature's request bodies/queries.
- **`<x>.routes.ts`** — an Express `Router`. Lists its middleware
  (`authenticate`, `authorize(...)`, `validate(...)`) then thin handlers that call
  the service and `res.json(...)`.
- **`<x>.service.ts`** — the business logic. The **only** place that touches
  Prisma for that feature. Throws `AppError` subclasses. Writes its own audit
  events.

Now each feature:

#### `auth/`
- `POST /api/auth/login` — `{ email, password }`. `login()` looks up the user;
  if missing / inactive / wrong password → **the same** `401 UNAUTHENTICATED`
  (no "which one was wrong" leak). On success → `{ token, user }` where `user`
  goes through `toPublicUser()` (strips `passwordHash`).
- `GET /api/auth/me` — returns the current user (used by the frontend on
  startup to validate a stored token).
- The login route has an `express-rate-limit` (20 requests / 15 min).

#### `users/` (admin management)
- `GET /api/users` — any logged-in user. **Agents get active users only**
  (for assignment dropdowns); **admins get everyone** (so they can reactivate a
  deactivated account). This asymmetry is a deliberate rule (`REQ-USR-3`).
- `POST /api/users` — **ADMIN only** — `{ name, email, password≥8, role }`.
- `PATCH /api/users/:id` — **ADMIN only** — change `name` / `role` / `isActive`
  / `password`.
- Duplicate email → `409` (via the Prisma `P2002` mapping).

#### `customers/`
- `GET /api/customers` — `?q` searches name/email/company/phone; paginated.
- `POST /api/customers` — `{ name, email, phone?, company?, notes? }`.
- `GET /api/customers/:id` — the customer **plus their last 20 tickets**
  (the "interaction history").
- `PATCH /api/customers/:id` — partial update.
- `DELETE /api/customers/:id` — **ADMIN only**. If the customer has **any**
  ticket that isn't `CLOSED` → `409 CUSTOMER_HAS_OPEN_TICKETS` and nothing is
  deleted. Otherwise the customer and their tickets/comments/events cascade away.

#### `tickets/` ★ (the core — `tickets.service.ts`, 437 lines)

Helpers inside the service:
- `ticketInclude` — the standard relations to load (customer, assignee, creator).
- `attachDerived(ticket, now)` — spreads in the `deriveSlaFields(...)` output so
  every ticket the API returns carries `slaResponseBreached` etc.
- `nextReference(tx)` — reads the latest ticket, parses the digits, returns
  `TKT-000N`. Done inside the transaction. (Race-prone at extreme concurrency —
  documented assumption `AS-5`.)
- `getOr404`, `assertActiveUser` — small guards.

The operations:

| Function → endpoint | What it does |
|---------------------|--------------|
| `createTicket()` → `POST /tickets` | validate customer exists (else 400); validate assignee is active if given; `computeSlaDueDates(priority, now)`; in a **transaction**: get `reference`, create the row, write a `CREATED` event, write an `ASSIGNED` event if it was assigned; return `attachDerived`. |
| `getTicketFull()` → `GET /tickets/:id` | the ticket + customer + assignee + creator + comments (oldest first) + events (newest first) + derived SLA. |
| `getTicketEvents()` → `GET /tickets/:id/events` | just the audit trail, newest first. |
| `listTickets()` → `GET /tickets` | builds a Prisma `where` from the filters (`status, priority, category, channel, assigneeId, customerId, mine, unassigned, breaching, q`). `mine` = assigned to me; `unassigned` = `assigneeId: null`; `breaching` = an `OR` of "resolution overdue & unresolved" / "response overdue & unresponded". For `createdAt` / `slaResolutionDueAt` sorts it uses SQL `orderBy` + `skip`/`take`. For **priority** sort it can't use SQL (it's a string column with the wrong alphabetical order) so it loads the matched set (capped at 2000), sorts in JS by a `PRIORITY_RANK` map, and slices the page. Always returns `{ data, page, pageSize, total }`. |
| `updateTicket()` → `PATCH /tickets/:id` | the important one. In a transaction it **diffs each field** against the existing row and builds up a `data` object **and** an `events[]` array: <br>• `subject/description/category/channel` change → `data[field]` + an `UPDATED` event with from/to. <br>• `priority` change → `recomputeSlaOnPriorityChange(...)`, set the new priority + due dates, `PRIORITY_CHANGED` event. <br>• `status` change → `assertTransition(from, to)` (throws `409 INVALID_TRANSITION` if illegal); if it's a reopen (`RESOLVED`/`CLOSED` → active) clear `resolvedAt`/`closedAt` and emit `REOPENED`, else emit `STATUS_CHANGED` and set `resolvedAt`/`closedAt` for `RESOLVED`/`CLOSED`; if `OPEN → IN_PROGRESS` and not yet responded, stamp `firstRespondedAt`. <br>• `assigneeId` change → active-user check, `ASSIGNED` or `UNASSIGNED` event. <br>Then one `ticket.update` + one `ticketEvent.createMany`. If nothing actually changed, it returns the ticket untouched. |
| `assignTicket()` → `POST /tickets/:id/assign` | `{ assigneeId: string \| null }`. No-op if unchanged. Else validate active user, update, write `ASSIGNED`/`UNASSIGNED`. |
| `escalateTicket()` → `POST /tickets/:id/escalate` | `bumpPriority`, recompute the resolution SLA, set `isEscalated = true`, write `ESCALATED`. |
| `addComment()` → `POST /tickets/:id/comments` | `{ body, isInternal? }`. Create the comment; if it's the **first non-internal** comment and `firstRespondedAt` is still null, stamp it; write a `COMMENTED` event. |

**`transitions.ts` ★** — pure, 43 lines. `ALLOWED_TRANSITIONS` is a map from each
status to the statuses it may move to. `isTransitionAllowed(from, to)` (same
status = allowed no-op), `assertTransition(from, to)` (throws `409
INVALID_TRANSITION`), `isReopen(from, to)` (true when `RESOLVED`/`CLOSED` → an
active status). `ACTIVE_STATUSES = ['OPEN','IN_PROGRESS','PENDING']` is exported
and also used by the dashboard.

#### `dashboard/`
- `GET /api/dashboard/stats` — one service call that runs 7 queries in
  `Promise.all` and returns:
  `byStatus` (count per status), `byPriority` (count per priority),
  `myOpen` (active tickets assigned to me), `unassigned` (active tickets with no
  assignee), `breachingResolution`, `breachingResponse`, `resolvedLast7d`.

#### `admin/`
- `POST /api/admin/run-sla-sweep` — **ADMIN only** — runs `runSlaSweep({ now: new
  Date() })` immediately and returns the counts. Exists for demos and for
  deterministic tests, on top of the automatic interval.

### 4.6 `jobs/slaSweep.ts` ★ — the background automation

`runSlaSweep({ now, client })` — pure over its inputs (clock + Prisma client
injected):

1. **Response breaches** — find tickets where `firstRespondedAt == null` and
   `slaResponseDueAt < now`. For each one that doesn't already have a
   `SLA_RESPONSE_BREACHED` event, write one. (Guard = the existing-event check.)
2. **Resolution breaches** — find tickets where `resolvedAt == null`,
   `isEscalated == false`, `slaResolutionDueAt < now`. For each: `bumpPriority`,
   recompute the resolution due date, set `isEscalated = true`, write
   `SLA_RESOLUTION_BREACHED` **and** `ESCALATED`.
3. Return `{ responseBreachesFlagged, resolutionBreachesEscalated }`.

**Why it's idempotent** (safe to run again on the same clock): response breaches
are guarded by the existing-event check; resolution breaches only match
`isEscalated == false`, and escalating both flips that flag **and** pushes the
due date into the future — so the second run finds nothing.

`startSlaSweep()` — the wrapper `index.ts` calls: if `SLA_SWEEP_MS > 0`, a
`setInterval` that runs `runSlaSweep`, logs any action, and swallows errors so a
transient failure doesn't crash the process. Returns a stop function.

### 4.7 `prisma/seed.ts`

Wipes the tables, then creates: 1 admin + 2 agents, 8 customers, and 25 tickets
from a hand-written "plan" array that spreads them across every status, priority,
and age — including several **already breaching SLA** so the dashboard has
something to show on a fresh checkout. Prints the login credentials at the end.

---

## 5. Frontend — every folder and file (`web/`)

```
web/src/
├── main.tsx              mounts <App/>, imports styles.css
├── App.tsx               providers + the route table
├── styles.css            hand-written CSS (no UI framework), CSS variables
├── vite-env.d.ts         types for import.meta.env
├── api/
│   ├── client.ts         the fetch wrapper
│   ├── types.ts          TS mirror of the API types + enum tuples
│   └── hooks.ts          one TanStack Query hook per resource action
├── auth/
│   ├── AuthContext.tsx   { user, loading, login, logout }
│   └── ProtectedRoute.tsx redirect / role gate
├── components/
│   ├── Layout.tsx        top nav + <Outlet/>
│   ├── Badge.tsx         StatusBadge / PriorityBadge / SlaBadge
│   ├── StatCard.tsx      a dashboard number card
│   ├── Spinner.tsx       loading indicator
│   ├── ErrorBanner.tsx   renders an ApiError (+ its details list)
│   └── EventLine.tsx     one row of the activity timeline
├── lib/
│   ├── format.ts         formatDateTime / formatRelative / titleCase (date-fns)
│   └── sla.ts            badge tone (green / amber / red) from remaining vs total
└── pages/
    ├── LoginPage.tsx
    ├── DashboardPage.tsx
    ├── TicketsListPage.tsx
    ├── TicketNewPage.tsx
    ├── TicketDetailPage.tsx
    ├── CustomersListPage.tsx
    ├── CustomerDetailPage.tsx
    └── AdminUsersPage.tsx
```

### 5.1 Data & auth plumbing

**`api/client.ts`** — a `fetch` wrapper:
- reads the JWT from `localStorage` (`crm.token`) and adds `Authorization: Bearer`
- builds the query string from an object
- on `!res.ok`: if `401`, dispatch an `unauthenticated` event (see AuthContext);
  then `throw new ApiError(status, body)` where `ApiError` carries `status`,
  `code`, and `details`
- exports `api.get/post/patch/delete` and `getToken` / `setToken`

**`api/types.ts`** — the hand-written mirror of the backend types (`User`,
`Customer`, `Ticket`, `TicketComment`, `TicketEvent`, `Paginated<T>`,
`DashboardStats`) and the same enum tuples as `server/src/types/enums.ts`.

**`api/hooks.ts`** — a thin TanStack Query hook per action, e.g.
`useTickets(query)`, `useTicket(id)`, `useCreateTicket()`, `useUpdateTicket(id)`,
`useAssignTicket(id)`, `useEscalateTicket(id)`, `useAddComment(id)`,
`useCustomers()`, `useDashboardStats()`, `useUsers()` … Queries are cached by
`[resource, params]`; mutations call `queryClient.invalidateQueries` on success so
the screen refreshes automatically. `useTicket` and `useDashboardStats` also
`refetchInterval: 30_000` to keep SLA countdowns fresh.

**`auth/AuthContext.tsx`** — holds `{ user, loading, login, logout }`. On mount,
if there's a stored token it calls `GET /auth/me` to validate it and load the
user (else clears it). `login()` calls `POST /auth/login`, stores the token, sets
the user. Also listens for the `unauthenticated` event from `client.ts` and
clears the session when it fires.

**`auth/ProtectedRoute.tsx`** — while `loading` shows a `<Spinner/>`; if no `user`
→ `<Navigate to="/login">`; if `roles` was passed and the user's role isn't in it
→ `<Navigate to="/">`. Otherwise renders `<Outlet/>`.

**`App.tsx`** — wraps everything in `QueryClientProvider` → `BrowserRouter` →
`AuthProvider`, then the routes: `/login` is public; everything else is inside
`<ProtectedRoute>` → `<Layout>`; `/admin/users` is additionally inside
`<ProtectedRoute roles={['ADMIN']}>`.

### 5.2 The components

- **`Layout.tsx`** — the top bar: logo, nav links (Dashboard / Tickets /
  Customers, plus **Users only if `role === 'ADMIN'`**), the user's name + role,
  a Log out button, and `<Outlet/>` for the page.
- **`Badge.tsx`** — `StatusBadge` and `PriorityBadge` map a value to a colour
  class; `SlaBadge` takes a `tone` ('ok'|'warn'|'danger') and a label.
- **`StatCard.tsx`** — a big number + a label, with an optional `warn`/`danger`
  tone.
- **`Spinner.tsx`**, **`ErrorBanner.tsx`** — the loading and error states used on
  every page. `ErrorBanner` special-cases `ApiError` and lists its `details`.
- **`EventLine.tsx`** — renders one audit event as a human sentence: a friendly
  label per `type`, resolves `assigneeId` values to user names, shows `from → to`.

### 5.3 The pages (the "full feature flow")

| Page | Route | What it does |
|------|-------|--------------|
| **LoginPage** | `/login` | email/password form (React Hook Form + Zod). On success `AuthContext.login` runs and `<Navigate>` sends you to where you were going. Shows the server error inline on `401`. Lists the seeded accounts as a hint. |
| **DashboardPage** | `/` | `useDashboardStats()` → 5 `StatCard`s; "queue by status" and "queue by priority" as clickable pills (each links to the filtered ticket list); two lists — "breaching SLA soonest" (`useTickets({ breaching:true, sort:'slaResolutionDueAt' })`) and "unassigned, highest priority first" (`useTickets({ unassigned:true, sort:'-priority' })`). |
| **TicketsListPage** | `/tickets` | A filter bar (search box, status/priority/category/assignee selects, "Mine"/"Unassigned"/"Breaching SLA" checkboxes, a sort dropdown) whose state lives **in the URL** (`useSearchParams`) — so it's shareable and survives refresh. A table of results + Previous/Next pagination. "New ticket" button. |
| **TicketNewPage** | `/tickets/new` | The create form. Customer picker is a search box + `<select>`; there's an "add a new customer inline" panel that calls `useCreateCustomer` and selects the result. Priority/category/channel selects, optional assignee. Zod validation. On success → navigate to the new ticket. |
| **TicketDetailPage** | `/tickets/:id` | The richest screen. Left: description (subject is click-to-edit), the comment thread with an "internal note" toggle and a post box, the activity timeline (`EventLine` per event). Right sidebar: `<select>`s for status / priority / category / channel / assignee that call the mutation hooks on change; an **Escalate** button; an **SLA** panel with the two badges and human due-times ("Due in about 8 hours" / "Responded less than a minute ago"); a **Customer** card linking to the customer page. Everything re-fetches after each mutation. |
| **CustomersListPage** | `/customers` | Search box + paginated table + a "new customer" form that toggles open. |
| **CustomerDetailPage** | `/customers/:id` | The profile (editable), and the ticket-history list. **Admins** see a Delete button; deleting a customer with open tickets surfaces the `409` in an `ErrorBanner`. |
| **AdminUsersPage** | `/admin/users` | ADMIN-only route. Table of all users; inline role `<select>` per row; Deactivate/Reactivate button; a "new user" form. |

### 5.4 `styles.css`

One hand-written stylesheet — no Tailwind/MUI. CSS variables for the palette
(`--primary`, `--ok`, `--warn`, `--danger`, …), a small set of utility/component
classes (`.btn`, `.panel`, `.data-table`, `.badge-*`, `.stat-card`, `.filter-bar`,
`.event-list` …), and a couple of responsive `@media` rules. *Why:* keeps the
dependency surface tiny and every style is greppable.

---

## 6. The domain rules you must be able to explain

These are the "business logic" — know them cold.

### 6.1 SLA targets (from priority, set once at creation)

| Priority | First response within | Resolution within |
|----------|-----------------------|-------------------|
| URGENT | 1 hour | 4 hours |
| HIGH | 4 hours | 24 hours |
| MEDIUM | 8 hours | 72 hours |
| LOW | 24 hours | 168 hours (7 days) |

- Due dates are **stored** (`slaResponseDueAt`, `slaResolutionDueAt`), anchored to
  `createdAt`.
- "Breached" is **not stored** — it's computed on every read
  (`deriveSlaFields`): response is breached if there's no `firstRespondedAt` and
  `now` is past the due date; resolution likewise with `resolvedAt`.
- Changing **priority** recomputes the **resolution** due date always, and the
  **response** due date only if the ticket hasn't been responded to yet.
- The clock is plain UTC wall-clock — no business-hours calendar (assumption
  `AS-1`).

### 6.2 Status lifecycle

```
OPEN ⇄ IN_PROGRESS ⇄ PENDING        (you can move freely between these three)
   any of the three ─────────────▶ RESOLVED
                       RESOLVED ──▶ CLOSED
   RESOLVED or CLOSED ────────────▶ OPEN | IN_PROGRESS | PENDING     = "REOPENED"
```

- **Not allowed:** an active status straight to `CLOSED`; `CLOSED` straight to
  `RESOLVED`. Illegal move → `409 INVALID_TRANSITION`.
- `→ RESOLVED` sets `resolvedAt`. `→ CLOSED` sets `closedAt`. A reopen clears
  both.

### 6.3 First response

`firstRespondedAt` is stamped **once**, by whichever happens first: the first
**non-internal** comment, or the first `OPEN → IN_PROGRESS`. It never changes
after that. It's what the "response SLA" measures against.

### 6.4 Escalation

- **Manual:** the Escalate button / `POST /tickets/:id/escalate`.
- **Automatic:** the sweep, when the resolution SLA is breached and the ticket
  isn't already escalated.
- Both do the same thing: priority one level up (max `URGENT`), `isEscalated =
  true`, resolution SLA recomputed, `ESCALATED` event.

### 6.5 Audit log

Every state-changing ticket operation writes at least one **`TicketEvent`** row.
Events are **never updated or deleted**. This is the ticket history and it drives
the activity timeline in the UI. Types: `CREATED`, `UPDATED`, `STATUS_CHANGED`,
`PRIORITY_CHANGED`, `ASSIGNED`, `UNASSIGNED`, `ESCALATED`, `COMMENTED`,
`SLA_RESPONSE_BREACHED`, `SLA_RESOLUTION_BREACHED`, `REOPENED`.

### 6.6 Roles (RBAC)

| | AGENT | ADMIN |
|--|-------|-------|
| Log in, dashboard | ✅ | ✅ |
| Customers: list / create / view / edit | ✅ | ✅ |
| Customers: **delete** | ❌ | ✅ |
| Tickets: everything (create, edit, assign, escalate, comment) | ✅ | ✅ |
| Users: list | active only | everyone |
| Users: **create / edit / deactivate** | ❌ | ✅ |
| Run SLA sweep manually | ❌ | ✅ |

Enforced **on the server** on every route. The UI hiding the Users link is only
convenience — the API still returns `403` if an agent calls an admin route.

### 6.7 Customer deletion guard

An admin can't delete a customer while any of their tickets is not `CLOSED` →
`409 CUSTOMER_HAS_OPEN_TICKETS`. Once all are closed, deleting cascades to their
tickets/comments/events.

---

## 7. Data model (`prisma/schema.prisma`)

```
User      id, name, email(unique), passwordHash, role, isActive, timestamps
Customer  id, name, email(unique), phone?, company?, notes?, timestamps
Ticket    id, reference(unique "TKT-0001"), subject, description,
          status, priority, category, channel,      ← Strings, validated by Zod
          isEscalated,
          slaResponseDueAt, slaResolutionDueAt,      ← stored
          firstRespondedAt?, resolvedAt?, closedAt?,
          customerId  → Customer (cascade delete)
          assigneeId? → User    (set null on user delete)
          createdById → User
          timestamps
TicketComment  id, ticketId→Ticket(cascade), authorId→User, body, isInternal, createdAt
TicketEvent    id, ticketId→Ticket(cascade), actorId?→User(set null),
               type, field?, fromValue?, toValue?, note?, createdAt
```

Relations: Customer 1—* Ticket; User 1—* Ticket (as assignee **and** as creator);
Ticket 1—* TicketComment; Ticket 1—* TicketEvent.

Indexes on the columns the app filters/sorts by: `Ticket.status`,
`Ticket.priority`, `Ticket.assigneeId`, `Ticket.customerId`,
`Ticket.slaResolutionDueAt`, `Customer.company`, `TicketComment.ticketId`,
`TicketEvent.ticketId`, `TicketEvent.type`.

Schema changes go through **migrations** (`npx prisma migrate dev`), which are
committed under `prisma/migrations/`.

---

## 8. Tests

| Layer | Tool | What it covers |
|-------|------|----------------|
| **Unit** | Vitest | the pure code with a frozen clock: `sla.ts` (every priority + the exact breach boundary: at the due instant = not breached, +1 ms = breached), `transitions.ts` (every from→to pair), `canAccess` (RBAC), `errors.ts` (each subclass → status + code). |
| **Integration** | Vitest + Supertest | the real Express app against a **fresh temporary SQLite DB** (`prisma migrate deploy` in `globalSetup`, tables wiped between tests): login ok/bad/deactivated/no-token; the standard 400/401/403/404/409 shapes; customers CRUD + delete-guard; ticket create → SLA set; first-response stamped once; priority change recomputes SLA + logs the event; illegal transition → 409; escalate; assign audit; comment internal flag; list filter/sort/pagination; dashboard maths; users RBAC + the admin-vs-agent visibility rule. |
| **Sweep** | Vitest + test DB | run the sweep twice on the same clock → no duplicate escalations or events; already-resolved / already-escalated tickets are left alone. |
| **Frontend** | Vitest + Testing Library + jsdom | `ProtectedRoute` redirects when logged out; login happy path + server-error path; ticket list renders from a mocked API and **re-fetches when a filter changes**; ticket detail posts a comment and shows it. |

Totals: **76 backend + 6 frontend**, all green. Plus `tsc --noEmit`, ESLint,
Prettier, and `vite build` all clean — and GitHub Actions runs the whole set on
every push.

---

## 9. The decisions (ADRs), in plain language

Read [adr/](adr/) for the full versions; here's the gist so you can defend each.

| Decision | Why | Trade-off accepted |
|----------|-----|--------------------|
| **Express + React + Prisma + SQLite**, two workspaces ([ADR-0001](adr/0001-stack-and-database.md)) | Reviewer can `clone && install && run` with no Docker/DB server; clear frontend/backend split; Prisma lets us swap to Postgres later with no app-code change | SQLite is single-writer, case-sensitive `LIKE`, no enums; types mirrored by hand |
| **Enums as validated `String`s** ([ADR-0002](adr/0002-enums-as-validated-strings.md)) | SQLite has no enum type; one source of truth in `types/enums.ts` + Zod at the edge | DB doesn't constrain the column — the app does |
| **Thin routes + a service layer** ([ADR-0003](adr/0003-thin-routes-service-layer.md)) | Business rules are testable without HTTP; one obvious home per rule; audit writes sit next to the mutation so they can't be forgotten | more files per feature |
| **Immutable `TicketEvent` audit log** ([ADR-0004](adr/0004-immutable-audit-log.md)) | The brief needs "ticket history"; explicit events give attribution + drive the sweep's idempotency | write amplification (several rows per multi-field PATCH) |
| **SLA as pure functions + an idempotent sweep** ([ADR-0005](adr/0005-sla-pure-functions-and-sweep.md)) | Deterministic tests (frozen clock, exact boundaries); safe to run the sweep repeatedly | breach state recomputed on every read (cheap); in-process interval doesn't scale to many instances |
| **JWT + bcrypt + server-side RBAC** ([ADR-0006](adr/0006-auth-jwt-and-server-side-rbac.md)) | Stateless; standard; re-loading the user each request makes deactivation instant | a per-request user lookup; no refresh-token rotation |

---

## 10. How to present this (a script + likely questions)

### A 2-minute spoken summary

> "It's a support CRM — the core loop from customer to resolved ticket. I scoped
> the brief's 12 areas down to 5 that hang together and built those properly:
> customers, tickets with a full lifecycle and SLA, a dashboard, the SLA
> automation, and auth/roles. Frontend is React with TanStack Query and React
> Hook Form; backend is Express with a service layer, Prisma over SQLite, JWT
> auth, and Zod validation on every endpoint. Every ticket change is written to an
> immutable audit log, and a background job auto-escalates tickets that breach
> their resolution SLA. There's a spec folder with the requirements, the design,
> the task plan, and a traceability matrix that maps every requirement to the
> code and the test that proves it. 82 tests, CI green."

### A live demo path

1. Log in as **admin** → Dashboard: point at "breaching resolution" and the two
   lists.
2. Tickets → apply a couple of filters (show the URL changing) → open one.
3. On the detail: change **status to In Progress** → show the timeline entry and
   the "first response" SLA badge flipping to *Responded*.
4. Change **priority to Urgent** → show the resolution due date shrinking + the
   `PRIORITY_CHANGED` entry.
5. **Escalate** → priority bumps, "Escalated" tag, event logged.
6. Post an **internal note** vs a **reply** → show the styling + that only the
   reply would count as a response.
7. Customers → try to **delete** one with an open ticket → the `409`.
8. Log out, log in as **agent** → the Users link is gone; (in dev tools) calling
   `POST /api/users` still returns `403`.
9. Terminal: `POST /api/admin/run-sla-sweep` → show it flags/escalates and is a
   no-op on the second call.

### Questions you might get, and the answer

- **"Why not all 12 features?"** → Depth over breadth; the rubric rewards
  engineering foundations, testing and ownership. Each cut area has a documented
  path back in ([07](07-assumptions-and-scope.md)).
- **"Where's the business logic?"** → In the module **services**, not the routes.
  `tickets.service.ts` is the centre. Pure sub-logic (SLA maths, transition
  rules, the sweep) is in separate files so it's unit-tested with a frozen clock.
- **"How do you know it works?"** → 76 backend + 6 frontend tests, the
  traceability matrix, CI on every push, and I drove the running app end-to-end.
- **"How is auth secured?"** → bcrypt hashes, HS256 JWT with an 8h expiry, the
  user is re-loaded from the DB every request (so deactivation is instant),
  `authorize()` on every route, login is rate-limited, same 401 for bad-email and
  bad-password.
- **"What breaks under load / what would you change first?"** → the `TKT-000N`
  reference generator races under high concurrency (move to a DB sequence); the
  in-process sweep needs an external scheduler + lock for multiple instances;
  free-text search is case-sensitive on SQLite (fixed by moving to Postgres);
  extract a shared types package instead of mirroring by hand.
- **"How did you use AI, and how did you check it?"** →
  [06-ai-usage-and-verification.md](06-ai-usage-and-verification.md): spec first,
  pure functions + tests to verify rather than trust, `tsc` + tests after every
  phase, and I list 6 concrete bugs I caught and fixed (e.g. SQLite enums, a
  pagination-reset bug, the `GET /users` visibility rule).
