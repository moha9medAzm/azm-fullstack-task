# 01 — Requirements

Written before implementation. Each requirement has a **stable ID** used by the
[traceability matrix](05-traceability-matrix.md). Acceptance criteria are written
in [EARS](https://alistairmavin.com/ears/) style (Event / State / Unwanted-behaviour
driven) so each is directly testable.

Legend: 🟢 = verified by an automated test (see traceability matrix).

---

## Personas

| Persona | Goal | Role |
|---------|------|------|
| **Agent** | Work assigned tickets, respond to customers, keep tickets moving before SLA breach | `AGENT` |
| **Support lead / Admin** | Everything an agent does, plus manage the agent roster and clean up customer data | `ADMIN` |
| **System** | Enforce SLAs without a human in the loop | — (background sweep) |

There is **no customer persona** in this MVP (no customer login) — see
[07-assumptions-and-scope.md](07-assumptions-and-scope.md).

---

## User stories

- **US-1** As an agent, I sign in so that I can access the console.
- **US-2** As an agent, I record a customer and their contact details so future tickets attach to them.
- **US-3** As an agent, I raise a ticket for a customer issue with a category and priority.
- **US-4** As an agent, I see all tickets, filter and sort them, and open one.
- **US-5** As an agent, I move a ticket through its lifecycle and the system stops me making illegal jumps.
- **US-6** As an agent, I reply to the customer or leave an internal note, and the first reply counts as the response.
- **US-7** As an agent, I assign a ticket to myself or a colleague.
- **US-8** As an agent, I escalate a ticket that needs urgent attention.
- **US-9** As an agent, I see the full history of a ticket — every change, who made it, when.
- **US-10** As a support lead, I see the queue at a glance and which tickets are breaching SLA.
- **US-11** As the system, I detect SLA breaches and auto-escalate overdue tickets without manual action.
- **US-12** As a support lead, I add, deactivate and re-role agents.
- **US-13** As a support lead, I delete a customer once none of their tickets are open.

---

## REQ-AUTH — Authentication & session

| ID | Requirement (EARS) | Acceptance criteria |
|----|--------------------|---------------------|
| **REQ-AUTH-1** | When a user submits a correct email and password to `POST /api/auth/login`, the system shall return a signed JWT and the public user object. | 🟢 200; body has `token` (string) and `user` without `passwordHash`. |
| **REQ-AUTH-2** | If the email is unknown **or** the password is wrong, then the system shall respond `401 UNAUTHENTICATED` with an identical message for both cases. | 🟢 Unknown email → 401; wrong password → 401; message does not reveal which. |
| **REQ-AUTH-3** | If the account is deactivated (`isActive = false`), then the system shall refuse login with `401`. | 🟢 Deactivated user cannot log in. |
| **REQ-AUTH-4** | While a request carries no or an invalid `Authorization: Bearer` header, the system shall respond `401 UNAUTHENTICATED` to any protected route. | 🟢 Missing token → 401; garbage token → 401. |
| **REQ-AUTH-5** | When a protected route is called with a valid token, the system shall load the user **fresh** from the database on every request, so deactivating a user revokes access immediately. | 🟢 `authenticate` re-queries; deactivated user with a still-valid token is rejected. |
| **REQ-AUTH-6** | The system shall rate-limit `POST /api/auth/login` to slow credential-stuffing. | 🟢 `express-rate-limit` on the route (20 / 15 min). |
| **REQ-AUTH-7** | The system shall provide `GET /api/auth/me` returning the current user. | 🟢 Returns the caller's user; 401 without a token. |

---

## REQ-RBAC — Roles & permissions

| ID | Requirement (EARS) | Acceptance criteria |
|----|--------------------|---------------------|
| **REQ-RBAC-1** | The system shall enforce role checks **server-side** on every route; the client is never trusted. | 🟢 Every router lists `authorize(...)`; RBAC integration test hits an admin route as an agent. |
| **REQ-RBAC-2** | If an `AGENT` calls an `ADMIN`-only route (`POST /users`, `PATCH /users/:id`, `DELETE /customers/:id`, `POST /admin/run-sla-sweep`), then the system shall respond `403 FORBIDDEN`. | 🟢 Agent → `POST /users` → 403; agent → `DELETE /customers/:id` → 403. |
| **REQ-RBAC-3** | Where the caller is `ADMIN`, the system shall permit all agent actions plus user management and customer deletion. | 🟢 Admin can create users, delete an eligible customer. |
| **REQ-RBAC-4** | The frontend shall hide admin-only navigation and controls from agents, as a convenience only (not a security boundary). | 🟢 `Layout` shows the Users link only for `ADMIN`; `/admin/users` route is role-gated by `ProtectedRoute`. |

---

## REQ-CUS — Customer management

| ID | Requirement (EARS) | Acceptance criteria |
|----|--------------------|---------------------|
| **REQ-CUS-1** | When an agent submits a valid customer (`name`, `email`, optional `phone`/`company`/`notes`), the system shall create it and return `201`. | 🟢 201; returns the created customer. |
| **REQ-CUS-2** | If the customer body fails validation (e.g. malformed `email`), then the system shall respond `400 VALIDATION_ERROR` with a `details` array of `{ path, message }`. | 🟢 Invalid email → 400, `details.length > 0`. |
| **REQ-CUS-3** | The system shall list customers with `?q` search across name / email / company / phone and `page`/`pageSize` pagination, returning `{ data, page, pageSize, total }`. | 🟢 `?q=Grace` returns only matches; response shape asserted. |
| **REQ-CUS-4** | When an agent opens a customer, the system shall include that customer's recent tickets (interaction history). | 🟢 `GET /customers/:id` includes `tickets[]`. |
| **REQ-CUS-5** | If a customer id does not exist, then the system shall respond `404 NOT_FOUND`. | 🟢 `GET /customers/missing` → 404. |
| **REQ-CUS-6** | When an agent patches a customer with a partial body, the system shall update only the supplied fields. | 🟢 `PATCH` with `{ notes }` changes only `notes`. |
| **REQ-CUS-7** | If an `ADMIN` deletes a customer that still has any non-`CLOSED` ticket, then the system shall respond `409 CUSTOMER_HAS_OPEN_TICKETS` and delete nothing. | 🟢 409 while a ticket is open; `204` after it is closed; cascade removes the customer's tickets/comments/events. |
| **REQ-CUS-8** | The frontend shall provide a customer list (search + create) and a customer detail page (editable profile + ticket history). | 🟢 `CustomersListPage`, `CustomerDetailPage`. |

---

## REQ-TKT — Ticket management (core)

| ID | Requirement (EARS) | Acceptance criteria |
|----|--------------------|---------------------|
| **REQ-TKT-1** | When an agent creates a ticket, the system shall assign a unique human `reference` (`TKT-NNNN`), set `status = OPEN`, and record a `CREATED` audit event. | 🟢 `reference` matches `/^TKT-\d+$/`; status `OPEN`; `CREATED` event present. |
| **REQ-TKT-2** | If the `customerId` on create does not exist, then the system shall respond `400 VALIDATION_ERROR`. | 🟢 Unknown `customerId` → 400. |
| **REQ-TKT-3** | When a ticket is created, the system shall compute `slaResponseDueAt` and `slaResolutionDueAt` from its priority per the [SLA table](02-design.md#sla-targets). | 🟢 `URGENT` → response +1 h, resolution +4 h (within tolerance). |
| **REQ-TKT-4** | The system shall return a full ticket (customer, assignee, creator, comments, events) plus **derived** SLA fields (`slaResponseBreached`, `slaResolutionBreached`, `*RemainingMs`) on `GET /tickets/:id`. | 🟢 Response contains derived fields and nested relations. |
| **REQ-TKT-5** | The system shall list tickets with filters `status, priority, category, channel, assigneeId, customerId, mine, unassigned, breaching, q`, `sort` ∈ {`createdAt`,`-createdAt`,`priority`,`-priority`,`slaResolutionDueAt`,`-slaResolutionDueAt`}, and pagination. | 🟢 Status filter, `mine=true`, `unassigned=true`, priority sort asc/desc, pagination shape all asserted. |
| **REQ-TKT-6** | If a list query value is invalid (e.g. `status=NOPE`), then the system shall respond `400 VALIDATION_ERROR`. | 🟢 Bad enum in query → 400. |
| **REQ-TKT-7** | When an agent patches a ticket, the system shall diff each changed field and write **one** audit event per change (`UPDATED` / `STATUS_CHANGED` / `PRIORITY_CHANGED` / `ASSIGNED` / `UNASSIGNED` / `REOPENED`). | 🟢 Priority change writes `PRIORITY_CHANGED`; subject change writes `UPDATED`. |
| **REQ-TKT-8** | While a ticket is in a given status, the system shall permit only the transitions defined in the [lifecycle](02-design.md#status-lifecycle) and shall reject the rest with `409 INVALID_TRANSITION`. | 🟢 `OPEN → CLOSED` → 409; `OPEN → IN_PROGRESS → RESOLVED → CLOSED` all 200. |
| **REQ-TKT-9** | When a ticket moves to `RESOLVED`, the system shall set `resolvedAt`; when it moves to `CLOSED`, set `closedAt`. | 🟢 `resolvedAt` / `closedAt` populated on those transitions. |
| **REQ-TKT-10** | When a `RESOLVED`/`CLOSED` ticket moves back to an active status, the system shall clear `resolvedAt`/`closedAt` and record a `REOPENED` event. | 🟢 Reopen clears both timestamps; `REOPENED` event present. |
| **REQ-TKT-11** | When the first non-internal comment is added by an agent, **or** the ticket first moves `OPEN → IN_PROGRESS`, the system shall stamp `firstRespondedAt` **once** and never overwrite it. | 🟢 First reply stamps it; a second reply does not change it; internal-only note does not stamp it. |
| **REQ-TKT-12** | When a comment is added, the system shall persist its `isInternal` flag and record a `COMMENTED` event. | 🟢 Internal comment stored with `isInternal: true`; `COMMENTED` event written. |
| **REQ-TKT-13** | When a ticket is assigned via `POST /tickets/:id/assign`, the system shall validate the assignee is an **active** user, set `assigneeId`, and record `ASSIGNED`; `assigneeId: null` records `UNASSIGNED`. | 🟢 Assign to another agent → `assignee` set + `ASSIGNED` event; assign to a non-user → `400`; `null` → `UNASSIGNED`. |
| **REQ-TKT-14** | The frontend shall provide: a filterable/sortable/paginated ticket list with URL-encoded state, a "new ticket" form with a customer picker + inline customer creation, and a ticket detail page with inline field edits, status/priority/assignee controls, an escalate button, a comment thread with an internal toggle, an activity timeline, and SLA badges. | 🟢 `TicketsListPage`, `TicketNewPage`, `TicketDetailPage`; RTL tests for list render, filter-triggered refetch, comment submit. |

---

## REQ-SLA — SLA & escalation

| ID | Requirement (EARS) | Acceptance criteria |
|----|--------------------|---------------------|
| **REQ-SLA-1** | The system shall derive `slaResponseBreached` as `firstRespondedAt == null && now > slaResponseDueAt`, and `slaResolutionBreached` as `resolvedAt == null && now > slaResolutionDueAt`, at read time. | 🟢 Pure `deriveSlaFields`; boundary unit tests (exactly at due = not breached, +1 ms = breached). |
| **REQ-SLA-2** | When a ticket's priority changes, the system shall recompute `slaResolutionDueAt` from `createdAt`, and recompute `slaResponseDueAt` **only if** `firstRespondedAt` is still null. | 🟢 `LOW → URGENT` shrinks the resolution due date; response due date untouched once responded (unit + integration). |
| **REQ-SLA-3** | When a ticket is escalated (manual or automatic), the system shall raise its priority one level (capped at `URGENT`), set `isEscalated = true`, recompute the resolution SLA, and record an `ESCALATED` event. | 🟢 `MEDIUM → HIGH`, `isEscalated` true, `ESCALATED` event; `URGENT` stays `URGENT`. |
| **REQ-SLA-4** | While the background sweep runs, when a ticket's response target has passed with no response, the system shall record a `SLA_RESPONSE_BREACHED` event **once** per ticket. | 🟢 Sweep run twice on the same clock → exactly one `SLA_RESPONSE_BREACHED` event. |
| **REQ-SLA-5** | While the background sweep runs, when a ticket's resolution target has passed, it is unresolved and `isEscalated == false`, the system shall auto-escalate it and record `SLA_RESOLUTION_BREACHED` + `ESCALATED`, **without re-escalating** on later runs. | 🟢 One escalation, one `ESCALATED` event across repeated runs; already-resolved/already-escalated tickets untouched. |
| **REQ-SLA-6** | The system shall run the sweep automatically on an interval (`SLA_SWEEP_MS`, default 60 s, `0` disables) **and** expose `POST /api/admin/run-sla-sweep` (ADMIN) for on-demand runs and deterministic tests. | 🟢 Interval wrapper in `index.ts`; admin route returns the sweep result. |
| **REQ-SLA-7** | The frontend shall show SLA badges — green (on track), amber (< 25 % of the window left), red (breached) — for response and resolution on the ticket detail page. | 🟢 `SlaBadge` + `slaTone`; unit-tested tone logic. |

---

## REQ-AUD — Audit / history

| ID | Requirement (EARS) | Acceptance criteria |
|----|--------------------|---------------------|
| **REQ-AUD-1** | The system shall record every ticket state change as an immutable `TicketEvent` (never updated or deleted), capturing the actor, the field, and the from/to values where applicable. | 🟢 All mutating ticket operations create events; no update/delete path exists for events. |
| **REQ-AUD-2** | The system shall expose the audit trail via `GET /tickets/:id/events`, newest first, and include it in `GET /tickets/:id`. | 🟢 Events endpoint returns the trail; detail response includes `events[]`. |
| **REQ-AUD-3** | The frontend shall render the audit trail as a human-readable activity timeline (friendly labels, resolved user names, from → to). | 🟢 `EventLine` component; shown on `TicketDetailPage`. |

---

## REQ-DASH — Dashboard

| ID | Requirement (EARS) | Acceptance criteria |
|----|--------------------|---------------------|
| **REQ-DASH-1** | The system shall provide `GET /api/dashboard/stats` returning `byStatus`, `byPriority`, `myOpen`, `unassigned`, `breachingResolution`, `breachingResponse`, `resolvedLast7d`. | 🟢 Integration test asserts each number against a hand-built fixture. |
| **REQ-DASH-2** | `myOpen` shall count active-status tickets assigned to the caller; `unassigned` shall count active-status tickets with no assignee; resolved tickets shall not appear in either. | 🟢 Asserted with mixed fixture data. |
| **REQ-DASH-3** | The frontend dashboard shall show stat cards, queue counts by status and by priority (each a link into the filtered ticket list), and lists of "breaching SLA soonest" and "unassigned, highest priority first". | 🟢 `DashboardPage` renders all sections from live data. |

---

## REQ-USR — User administration

| ID | Requirement (EARS) | Acceptance criteria |
|----|--------------------|---------------------|
| **REQ-USR-1** | Where the caller is `ADMIN`, the system shall allow creating a user (`name`, `email`, `password ≥ 8`, `role`) and patching `name` / `role` / `isActive` / `password`. | 🟢 Admin creates a user (201); admin deactivates a user (`isActive: false`). |
| **REQ-USR-2** | If a user is created with an email that already exists, then the system shall respond `409`. | 🟢 Duplicate email → 409. |
| **REQ-USR-3** | The system shall let any authenticated user list users for assignment pickers, returning **active users only to agents** and **all users (incl. deactivated) to admins**. | 🟢 Deactivated user hidden from an agent's `GET /users`, visible to an admin's. |
| **REQ-USR-4** | The frontend shall provide an admin-only users page: list, create, change role inline, deactivate/reactivate. | 🟢 `AdminUsersPage`, route gated to `ADMIN`. |

---

## REQ-API — API conventions (cross-cutting)

| ID | Requirement (EARS) | Acceptance criteria |
|----|--------------------|---------------------|
| **REQ-API-1** | The system shall return a single error envelope for every failure: `{ error: { code, message, details? } }`. | 🟢 Asserted across auth, validation, 404, 409, 403 tests. |
| **REQ-API-2** | The system shall use `200` (read/update), `201` (create), `204` (delete) on success and `400/401/403/404/409` with a stable `code` on failure. | 🟢 Status + code asserted per endpoint. |
| **REQ-API-3** | The system shall validate **every** request body, query and param at the edge with Zod before the handler runs. | 🟢 `validate()` middleware on every route; handlers read `req.valid.*` only. |
| **REQ-API-4** | If an unexpected error is thrown, then the system shall log it with a stack and respond `500 INTERNAL` with a generic body (no leak). | 🟢 Central `errorHandler`; unknown errors mapped to 500 generic. |
| **REQ-API-5** | The system shall map known Prisma errors (`P2025` → 404, `P2002` → 409 `UNIQUE_VIOLATION`, `P2003` → 409 `FOREIGN_KEY_VIOLATION`). | 🟢 Duplicate-email 409 goes through this path. |
| **REQ-API-6** | Every list endpoint shall accept `page` (≥1, default 1) and `pageSize` (1–100, default 20) and return `{ data, page, pageSize, total }`. | 🟢 Customers and tickets lists asserted. |

---

## REQ-NFR — Non-functional

| ID | Requirement (EARS) | Acceptance criteria |
|----|--------------------|---------------------|
| **REQ-NFR-1 (Security)** | The system shall hash passwords with bcrypt (cost ≥ 10), sign JWTs HS256 with an env secret and an 8 h expiry, and never commit secrets. | 🟢 `password.ts`, `jwt.ts`, `.env` git-ignored, `.env.example` committed. |
| **REQ-NFR-2 (Security)** | The system shall apply `helmet`, a CORS origin allow-list, and a JSON body-size limit. | 🟢 Configured in `app.ts` from validated env. |
| **REQ-NFR-3 (Config)** | The system shall validate all environment variables on boot and refuse to start if any are missing/invalid. | 🟢 `config/env.ts` throws a descriptive error; `JWT_SECRET` must be ≥ 16 chars. |
| **REQ-NFR-4 (Observability)** | The system shall log every request (method, path, status, duration) in non-test environments. | 🟢 `morgan` in `app.ts`; silenced under `NODE_ENV=test`. |
| **REQ-NFR-5 (Lifecycle)** | On `SIGINT`/`SIGTERM` the system shall stop the sweep, close the HTTP server, and disconnect Prisma before exit. | 🟢 Shutdown handler in `index.ts`. |
| **REQ-NFR-6 (Testability)** | Core logic (SLA math, status transitions, sweep, RBAC decision) shall be pure functions taking `now`/dependencies as arguments. | 🟢 `lib/sla.ts`, `transitions.ts`, `runSlaSweep({ now, client })`, `canAccess()`. |
| **REQ-NFR-7 (Data)** | The schema shall be managed by committed migrations; a seed shall create a known dataset (admin + 2 agents + 8 customers + 25 tickets incl. breaching). | 🟢 `prisma/migrations/`, `prisma/seed.ts`. |
| **REQ-NFR-8 (Frontend UX)** | Every async view shall render explicit loading, empty, and error states; 401 responses shall drop the session and route to `/login`. | 🟢 `Spinner` / empty rows / `ErrorBanner` on every page; `authEvents` 401 handler in `AuthContext`. |
| **REQ-NFR-9 (Frontend state)** | The frontend shall use TanStack Query for server state (cache + invalidation) and React Hook Form + Zod for forms. | 🟢 `api/hooks.ts`, form pages. |
