# v2 — Requirements (all 12 areas)

Continues the `REQ-*` scheme from [specs/01-requirements.md](../01-requirements.md)
(v1, ~65 requirements — still in force). EARS style; each row is testable and will be
mapped in the v2 traceability matrix. 🟢 = has an automated test once its story ships.

Personas add **Supervisor** (branch-level lead: sees their whole branch, manages
agents in it, views branch reports) and **Customer** (portal user).

---

## Area 12 — Platform (`platform-foundation`, Story 01)

### Branch & Department
| ID | Requirement (EARS) | Acceptance |
|----|--------------------|-----------|
| REQ-PLAT-1 | The system shall model `Branch` (name, code unique, isActive) and `Department` (name, branchId, isActive) with admin CRUD. | CRUD endpoints + screens; code unique → 409. |
| REQ-PLAT-2 | Every `User` shall belong to exactly one branch (`branchId` required) and optionally one department. | Migration backfills existing users to a default branch; create-user requires `branchId`. |
| REQ-PLAT-3 | When a ticket is created, the system shall set its `branchId` from the creating agent's branch unless an admin overrides it. | New ticket → `branchId` populated; audit event records it. |
| REQ-PLAT-4 | While a non-admin without `branch:all` lists or reads tickets / users / reports, the system shall restrict results to their own branch. | Agent in Branch A cannot see or fetch a Branch B ticket (404, not 403 — no existence leak). |
| REQ-PLAT-5 | The scoping decision shall be a single reusable helper (`scopeWhere`) applied by every list/read service, unit-tested in isolation. | 🟢 unit tests for admin / branch-limited / `branch:all` cases. |

### i18n + RTL
| ID | Requirement | Acceptance |
|----|-------------|-----------|
| REQ-PLAT-6 | The frontend shall support English and Arabic via a catalog; all visible strings resolve through it (no hard-coded copy on the main screens). | A missing key is visible in dev; `grep` finds no bare user strings in the audited screens. |
| REQ-PLAT-7 | When the user selects Arabic, the system shall set `<html dir="rtl" lang="ar">`, mirror the layout, and localise dates/numbers; the choice persists across reloads. | Toggling to Arabic flips the app RTL with no layout break on Login, Dashboard, Tickets list, Ticket detail. |
| REQ-PLAT-8 | The API shall return error messages resolved from an `{en,ar}` catalog keyed by the error `code`, honouring `Accept-Language` (default `en`). | Same request with `Accept-Language: ar` returns the Arabic `message`; `code` unchanged. |

### Branding
| ID | Requirement | Acceptance |
|----|-------------|-----------|
| REQ-PLAT-9 | The system shall store workspace branding (name, logo, primaryColor, accentColor) with an admin editor, and optional per-branch overrides. | Admin edits branding → login page + header reflect it after reload. |
| REQ-PLAT-10 | The frontend shall apply branding colors as CSS variables at startup and fall back to defaults if branding is unset or fails to load. | With branding unset the app renders with default palette; no crash. |

### Responsive
| ID | Requirement | Acceptance |
|----|-------------|-----------|
| REQ-PLAT-11 | Below ~640px the layout shall collapse to a single column; wide tables scroll inside their own container and the page body never scrolls horizontally. | Login, Dashboard, Tickets list, Ticket detail usable at 375px width. |

---

## Area 10 — Security & Administration (`security-admin`, Story 02)

| ID | Requirement | Acceptance |
|----|-------------|-----------|
| REQ-PERM-1 | Authorization shall check **permission strings** (e.g. `ticket:delete`, `kb:publish`, `report:view`, `user:manage`, `branch:all`, `config:manage`), not bare roles. | `requirePermission('x')` middleware; `canAccess(perms, 'x')` pure + unit-tested. 🟢 |
| REQ-PERM-2 | Each role shall map to a default permission set; an admin shall grant or revoke individual permissions per user. | Admin grants `report:view` to an agent → that agent can now open Reports. |
| REQ-PERM-3 | Roles shall be `ADMIN`, `SUPERVISOR`, `AGENT`, `CUSTOMER`; `SUPERVISOR` defaults to branch-scoped management + reports. | Supervisor in Branch A manages Branch A agents, not Branch B. |
| REQ-PERM-4 | The system shall provide an audit-log viewer: filter the immutable `TicketEvent` + a new `AdminEvent` stream by actor, type, date, entity; read-only. | Admin filters "all ESCALATED events in the last 7 days"; export to CSV. |
| REQ-PERM-5 | Admin-significant actions (user create/deactivate, permission change, config change, branding change) shall write an `AdminEvent`. | Each such action produces exactly one `AdminEvent` with actor + before/after. 🟢 |
| REQ-PERM-6 | The system shall expose editable **system configuration** (SLA default targets, sweep interval, business-hours toggle, max attachment MB, allowed channels) with validation and an audit trail. | Changing the MEDIUM resolution target reflects on the next created ticket. |
| REQ-PERM-7 | If a permission-gated route is called without the permission, the system shall respond `403 FORBIDDEN` regardless of role. | Agent without `ticket:delete` → `DELETE` → 403. 🟢 |

---

## Area 1 — Customer Management (`customer-management`, Story 03)

| ID | Requirement | Acceptance |
|----|-------------|-----------|
| REQ-CUSX-1 | The system shall support file attachments on customers and tickets: upload (size/type limited by config), list, download, delete; stored on disk under a configurable root with a DB `Attachment` row. | Upload a 1 MB PNG to a ticket → appears in its attachment list; oversize → 400. |
| REQ-CUSX-2 | The customer profile shall add: `tags`, `vipLevel` (NONE/SILVER/GOLD), `preferredChannel`, `locale`, and a free-form `metadata` JSON. | Editable in the profile screen; returned by `GET /customers/:id`. |
| REQ-CUSX-3 | The system shall show a **unified interaction history** per customer: tickets, channel messages (`Conversation`/`Message`), chat sessions, portal feedback — merged and sorted by time. | Customer detail shows an email reply and a ticket comment interleaved chronologically. |
| REQ-CUSX-4 | The system shall model `Conversation` (customerId, channel, subject, status) and `Message` (conversationId, direction IN/OUT, body, ticketId?, meta) as the substrate for channels (Story 05) and portal (Story 09). | Migration + repository + tests; a message can be linked to a ticket. 🟢 |
| REQ-CUSX-5 | Merging two customer records shall move their tickets/conversations/attachments to the survivor and write an `AdminEvent`; blocked if either has an in-progress chat. | Merge A→B: B now owns A's 3 tickets; A is gone; event recorded. |

---

## Area 2 — Ticket Management (`ticket-management`, Story 04)

| ID | Requirement | Acceptance |
|----|-------------|-----------|
| REQ-TKTX-1 | The system shall support free-form `Tag`s on tickets (create-on-use, colour, per-branch or global) with filter-by-tag in the list. | Add tag "refund" → filter `?tag=refund` returns it. |
| REQ-TKTX-2 | Users shall follow/unfollow a ticket (`TicketWatcher`); watchers receive notifications for its events (Story 06). | Follow → appear in watcher list; unfollow → removed. |
| REQ-TKTX-3 | The system shall merge ticket B into ticket A: move B's comments/events/attachments/watchers to A, set B `status=CLOSED` with a `MERGED` event pointing to A, and prevent replies on B. | Merge → A's timeline shows B's comments; B is closed & locked. 🟢 |
| REQ-TKTX-4 | The system shall split a ticket: create a new ticket from selected comments, linked back via `SPLIT_FROM`. | Split 2 comments → new ticket with those comments + a link event. |
| REQ-TKTX-5 | The system shall support bulk actions on a filtered selection: assign, set priority, set status (transition-guarded per ticket), add tag, close. | Bulk-assign 5 tickets → 5 `ASSIGNED` events; any illegal transition in the set is reported, others still applied. |
| REQ-TKTX-6 | Every new bulk/merge/split operation shall respect the existing status-transition guard and RBAC, and be fully audited. | Bulk close of an `OPEN` ticket → `409` for that one (can't skip `RESOLVED`), recorded. 🟢 |

---

## Area 3 — Communication Channels (`channels`, Story 05)

| ID | Requirement | Acceptance |
|----|-------------|-----------|
| REQ-CHAN-1 | The system shall define a `ChannelProvider` port: `send(message)` and `parseInbound(payload) → NormalizedMessage`. Active providers are selected from config; tests use the mock. | 🟢 contract tests run against every provider incl. mock. |
| REQ-CHAN-2 | **Web Forms** (real): a public, unauthenticated, rate-limited, CAPTCHA-optional endpoint `POST /public/forms/:formKey` shall create a `Conversation` + inbound `Message` and (per form config) auto-create a ticket. | Submitting the demo form creates a ticket assigned by the routing rules. |
| REQ-CHAN-3 | **Live Chat** (real): a customer (portal or widget token) shall open a `ChatSession`; agents see a queue, claim a session, exchange `ChatMessage`s (polling every ~3s), and convert the session to a ticket. | Two browser contexts exchange messages; agent clicks "→ ticket" → ticket holds the transcript. |
| REQ-CHAN-4 | **Email** (real-ish): outbound via SMTP (nodemailer) when `SMTP_URL` is set, else the mock provider logs the message; inbound via `POST /webhooks/email` parsing a provider-style JSON payload into a `Message` threaded by `In-Reply-To` / ticket reference in the subject. | With SMTP unset, replying to a ticket "sends" via mock and records an OUT `Message`; posting a sample inbound payload appends to the right ticket. |
| REQ-CHAN-5 | **WhatsApp / SMS**: a `TwilioProvider` skeleton (real API shape, guarded by `TWILIO_*` env) plus a `MockSmsProvider`; inbound webhook `POST /webhooks/twilio` normalises to a `Message`. | With no Twilio env, an agent reply via the WhatsApp channel goes through the mock and is recorded; the skeleton is unit-tested for payload shape. |
| REQ-CHAN-6 | An agent replying to a ticket shall be able to choose the outbound channel (defaulting to the customer's `preferredChannel` or the ticket's origin channel); the reply is delivered via that provider and recorded as an OUT `Message` + `COMMENTED` event. | Reply on a WhatsApp-origin ticket defaults to WhatsApp; switching to Email works. |
| REQ-CHAN-7 | All inbound webhooks shall verify a shared secret / signature and reject unsigned payloads `401`. | Unsigned inbound → 401; valid → 200 + message appended. 🟢 |

---

## Area 5 — SLA & Automation (`sla-automation`, Story 06)

| ID | Requirement | Acceptance |
|----|-------------|-----------|
| REQ-AUTO-1 | The system shall model `AutomationRule` (name, trigger, conditions[], actions[], branch scope, priority order, isActive) evaluated by a pure engine. | 🟢 unit tests: a rule matches/doesn't on given ticket facts. |
| REQ-AUTO-2 | **Triggers**: `TICKET_CREATED`, `TICKET_UPDATED`, `SLA_RESPONSE_BREACHED`, `SLA_RESOLUTION_BREACHED`, `SCHEDULED` (via the sweep). | Creating a ticket runs `TICKET_CREATED` rules synchronously in the create transaction's after-commit hook. |
| REQ-AUTO-3 | **Conditions** cover priority, category, channel, customer VIP level, branch, department, tag, unassigned, business-hours. **Actions** cover assign (to user / round-robin within a department / least-loaded), set priority/category/department, add tag, escalate, notify (user/role/watchers), send canned reply. | A rule "URGENT + unassigned → assign least-loaded agent in the ticket's department" works on the demo data. |
| REQ-AUTO-4 | **Automatic assignment** shall be a first-class action with strategies `ROUND_ROBIN`, `LEAST_LOADED`, `SPECIFIC_USER`, scoped to a department/branch, skipping inactive/over-capacity agents. | 🟢 assignment strategy unit-tested; integration test: 3 new tickets round-robin across 2 agents. |
| REQ-AUTO-5 | **Escalation rules** shall let an admin define, per priority/branch, "if not responded within X / not resolved within Y → action" replacing the hard-coded sweep behaviour (which becomes the default rule seeded at migration). | Editing the URGENT escalation window changes when the sweep escalates. |
| REQ-AUTO-6 | The system shall model `Notification` (userId, type, title, body, entity ref, readAt?) and deliver via `Notifier` (in-app real + `EmailNotifier` adapter). A bell menu shows unread; mark-read / mark-all-read. | Escalating a ticket notifies its assignee + watchers; the bell count updates. 🟢 |
| REQ-AUTO-7 | Rule evaluation shall be **idempotent and bounded**: a rule fires at most once per (ticket, rule, trigger-instance); an infinite assign↔notify loop is impossible (max N actions per evaluation, no re-trigger within the same transaction). | 🟢 running the create hook twice on one ticket produces one set of actions. |

---

## Area 6 — Knowledge Base (`knowledge-base`, Story 07)

| ID | Requirement | Acceptance |
|----|-------------|-----------|
| REQ-KB-1 | The system shall model `KbArticle` (title, slug, body markdown, type FAQ/GUIDE/SOLUTION, category, tags, status DRAFT/PUBLISHED/ARCHIVED, visibility INTERNAL/PUBLIC, authorId, timestamps, version). | CRUD with `kb:write` / `kb:publish` permissions; slug unique per branch scope. |
| REQ-KB-2 | The system shall provide **full-text search** over published articles (title + body) via SQLite FTS5, ranked, with snippet highlights; Postgres `tsvector` path documented. | `GET /kb/search?q=refund` returns ranked hits with `<mark>` snippets. 🟢 |
| REQ-KB-3 | An agent shall link an article to a ticket ("attach solution"); linked articles show on the ticket and increment the article's `usefulCount`. | Attaching an article adds a `KB_LINKED` event + shows in a "Solutions" panel. |
| REQ-KB-4 | Public (`PUBLIC` + `PUBLISHED`) articles shall be readable unauthenticated at `GET /public/kb` and `GET /public/kb/:slug` for the portal (Story 09). | Anonymous request returns only public+published; internal ones 404. |
| REQ-KB-5 | Article edits shall keep prior versions (`KbArticleVersion`); an editor can view and restore a version. | Editing twice yields 2 versions; restore v1 → body reverts + audit. |

---

## Area 7 — AI Features (`ai-features`, Story 08)

| ID | Requirement | Acceptance |
|----|-------------|-----------|
| REQ-AI-1 | The system shall define an `AiProvider` port: `summarize(ticket)`, `suggestReply(ticket, context)`, `categorize(text) → {category, priority, confidence}`, `suggestSolutions(text) → KbArticle[]`, `chat(history) → reply`. Providers: `ClaudeProvider` (real, `@anthropic-ai/sdk`, model from config, key from env) and `MockAiProvider` (deterministic). Tests use the mock. | 🟢 contract tests per provider; no network in the test suite. |
| REQ-AI-2 | **Ticket summary**: an agent triggers "Summarise"; the system returns a short summary of the description + comments and caches it as an `AiInteraction` until the ticket changes. | Summarise a long ticket → 3–5 sentence summary shown; re-summarise after a new comment refreshes it. |
| REQ-AI-3 | **Suggested reply**: given the ticket + last customer message + linked KB, the system proposes a draft the agent can insert, edit, and send. Nothing is sent automatically. | "Suggest reply" fills the compose box; the agent edits then posts a normal comment. |
| REQ-AI-4 | **Auto-categorization**: on ticket create (behind a config flag), the system shall call `categorize` and set category/priority when `confidence ≥ threshold`, recording an `AiInteraction` and an audit event; below threshold it only suggests. | A billing-worded ticket lands as `BILLING` with an `AI_CATEGORIZED` event; low confidence leaves defaults + a suggestion chip. |
| REQ-AI-5 | **Suggested solutions**: the system shall retrieve top KB articles for the ticket text (FTS retrieval + optional AI re-rank) and show them in the agent view and (published only) in the portal. | Opening a ticket shows 3 relevant articles; clicking one attaches it (REQ-KB-3). |
| REQ-AI-6 | **AI chatbot**: a portal/live-chat visitor shall converse with the bot (`chat` over history + retrieved public KB); the bot shall offer "talk to an agent" which creates a `ChatSession` in the queue with the transcript. | A visitor asks a covered question → useful answer citing an article; asks for a human → session queued. |
| REQ-AI-7 | Every AI call shall be logged (`AiInteraction`: kind, inputHash, model, tokIn/tokOut, latency, cost estimate, outcome) and rate-limited per user; a provider error degrades gracefully (feature disabled, not a 500). | Provider down → "AI unavailable" toast, ticket flow unaffected. 🟢 |

---

## Area 8 — Customer Portal (`customer-portal`, Story 09)

| ID | Requirement | Acceptance |
|----|-------------|-----------|
| REQ-PORT-1 | The system shall model `CustomerUser` (customerId, email unique, passwordHash, isActive) with its own login (`POST /portal/auth/login`) issuing a JWT scoped to `role=CUSTOMER` + that customer. | Portal login works; the token cannot call any agent/admin route (403). |
| REQ-PORT-2 | A portal user shall submit a ticket (subject, description, category, attachments) → creates a ticket on the customer's default branch with channel `PORTAL`, running the automation rules. | Submitted ticket appears in the agent queue, routed by rules. |
| REQ-PORT-3 | A portal user shall list and open **only their own** tickets, see status/priority/SLA-friendly state + the **public** comments and their own replies, and post a reply (→ inbound `Message` + `COMMENTED`). | Customer sees ticket status and public replies; internal notes are never returned. |
| REQ-PORT-4 | A portal user shall browse/search the public KB (REQ-KB-4). | Portal KB search returns only public+published. |
| REQ-PORT-5 | On ticket resolution the system shall invite **CSAT** (1–5 + optional comment) via a tokenised link / portal prompt; one response per ticket; results feed reports (Story 11). | Resolving a ticket surfaces the CSAT prompt on the portal; submitting stores a `CsatResponse`. |
| REQ-PORT-6 | The portal shall be a **separate route tree / layout** (`/portal/*`) with its own nav, its own branding (the customer's branch), and full i18n/RTL. | `/portal` is visually distinct, Arabic-capable, and unreachable by agent tokens. |

---

## Area 4 — Agent Dashboard (`agent-workspace`, Story 10)

| ID | Requirement | Acceptance |
|----|-------------|-----------|
| REQ-WS-1 | The system shall model `Task` (title, notes, dueAt, status, assigneeId, ticketId?) with a "My tasks / reminders" panel; overdue tasks highlight; completing a task is audited. | Create a reminder due in 1h on a ticket → shows in the panel + on the ticket. |
| REQ-WS-2 | The system shall model `QuickReply` (canned responses: title, body with `{{placeholders}}`, scope global/branch/personal, category) and let an agent insert one into a comment/reply with placeholders filled from the ticket/customer. | Insert "Password reset steps" → body appears with the customer's name filled in. |
| REQ-WS-3 | Team collaboration: `@mention` a user in an internal comment → that user gets a `Notification` and becomes a watcher; an internal-only threaded discussion is visible to staff, never to the portal. | Mentioning @alice notifies her and adds her as a watcher. 🟢 |
| REQ-WS-4 | The agent dashboard shall add: my tasks, my mentions, tickets I watch, and a per-agent workload number used by `LEAST_LOADED` assignment (Story 06). | Dashboard shows the four lists; workload matches assigned active tickets. |
| REQ-WS-5 | Quick replies and tasks shall respect branch scope and permissions (`quickreply:manage`, `task:manage-others`). | An agent can't edit another branch's shared quick reply. |

---

## Area 9 — Reports & Management (`reports-management`, Story 11)

| ID | Requirement | Acceptance |
|----|-------------|-----------|
| REQ-RPT-1 | **Ticket reports**: volume over time, by status/priority/category/channel/branch/department/tag, created vs. resolved, backlog trend; date range + branch filter (scoped). | `GET /reports/tickets?from&to&groupBy=channel` returns series; supervisor sees only their branch. |
| REQ-RPT-2 | **SLA performance**: % response/resolution SLA met, average response/resolution time, breach count, by branch/priority/agent, for a range. | Numbers reconcile with a hand count on seed data. 🟢 |
| REQ-RPT-3 | **Agent performance**: assigned, resolved, avg first-response, avg handle time, reopen rate, CSAT average, per agent, for a range. | Table + per-agent drill-down. |
| REQ-RPT-4 | **Customer satisfaction**: CSAT distribution + trend + comments, filterable by branch/agent/category. | CSAT report shows the responses from Story 09. |
| REQ-RPT-5 | **Management dashboard**: a single screen combining the KPIs above with big-number tiles and small charts; role-gated by `report:view`. | Loads for admin/supervisor; agent without the permission → redirected. |
| REQ-RPT-6 | Every report shall support **CSV export** of its underlying rows; large exports stream. | "Export CSV" downloads the exact rows behind the current view. |
| REQ-RPT-7 | Report queries shall be aggregation SQL (not N+1) and bounded; a `SavedReport` lets a user store a filter set. | 🟢 a report endpoint issues ≤ a small fixed number of queries. |

---

## Area 11 — Integrations (`integrations`, Story 12)

| ID | Requirement | Acceptance |
|----|-------------|-----------|
| REQ-INT-1 | The system shall issue **API keys** (`ApiKey`: label, hashedKey, scopes[], branchId?, createdBy, lastUsedAt, revokedAt) via an admin screen; the plaintext key is shown once. | Create key → shown once; `Authorization: ApiKey <k>` authenticates subsequent calls. |
| REQ-INT-2 | A **public REST API** namespace `/api/v1/*` (customers, tickets read+create+comment, kb read) shall accept API-key auth, enforce the key's scopes + branch, be rate-limited per key, and share the standard error envelope. | A key scoped `tickets:read` can `GET /api/v1/tickets` but not `POST`; over-rate → 429. 🟢 |
| REQ-INT-3 | The system shall support **outbound webhooks** (`Webhook`: url, events[], secret, isActive) delivering signed JSON on `ticket.created/updated/resolved`, `csat.received`, etc., with retry + `WebhookDelivery` log + a manual "resend". | Registering a webhook and creating a ticket produces a signed POST; a 500 from the target retries with backoff and is logged. 🟢 |
| REQ-INT-4 | The system shall define an `ErpProvider` port (`lookupCustomer(externalId)`, `pushTicket(ticket)`, `pullUpdates()`) with a `MockErpProvider` (deterministic fixtures) and a documented real-connector shape; an `ErpLink` row ties a local customer/ticket to an ERP id. | With the mock, "sync from ERP" enriches a customer from a fixture and stores the `ErpLink`. |
| REQ-INT-5 | An OpenAPI 3 document shall be generated for `/api/v1/*` from the Zod schemas and served at `/api/v1/openapi.json` + a simple docs page. | The document validates and lists every v1 route with request/response shapes. |
| REQ-INT-6 | API-key and webhook secrets shall be stored hashed/encrypted, never returned after creation, and never logged. | DB holds no plaintext key; `grep` of logs finds no secret. 🟢 |

---

## Cross-cutting (all v2 stories)

| ID | Requirement |
|----|-------------|
| REQ-V2-1 | Every new endpoint keeps the v1 contract: Zod validation at the edge, permission check, the `{ error: { code, message, details? } }` envelope, `{ data, page, pageSize, total }` for lists. |
| REQ-V2-2 | Every schema change is a committed Prisma migration; `npm run db:reset` seeds a coherent multi-branch dataset that exercises every area. |
| REQ-V2-3 | Pure logic (scoping, permissions, rules engine, assignment strategies, i18n resolver, webhook signing, FTS ranking wrapper) is unit-tested with injected inputs; new endpoints are integration-tested against a fresh temp SQLite DB. |
| REQ-V2-4 | No secret is committed; external providers are off by default with a working mock; the test suite makes no network calls. |
| REQ-V2-5 | `specs/v2/` requirements + design + traceability, `RUNNING.md`, and the per-area demo script are updated as part of each story's Done Criteria. |
| REQ-V2-6 | The app runs end-to-end after every story (`npm run dev`), and CI (lint + format + typecheck + tests + build) stays green. |
