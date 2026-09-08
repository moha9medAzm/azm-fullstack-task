# v2 — Design

Builds on [specs/02-design.md](../02-design.md) (v1). Only the deltas are here.
Decisions with alternatives: [specs/v2/adr/](adr/).

---

## 1. Layered architecture (unchanged shape, new seams)

```
web/ (React) ──► server/ Express
                   middleware:  authenticate → resolveScope → requirePermission(x) → validate(Zod)
                   modules:     <feature>/ { routes, service, schemas }
                   ports:       src/ports/{channel,ai,erp,notify}/  (interface + real + mock)
                   engine:      src/automation/  (pure rule engine + assignment strategies)
                   i18n:        src/messages/{en,ar}.ts   (error-code → text)
                   jobs:        slaSweep (now rule-driven) + webhookDispatcher + reminderSweep
                   db:          Prisma → SQLite (FTS5 for search)
```

New middleware **`resolveScope`** runs after `authenticate`: reads `req.user`,
loads the user's permissions, and attaches `req.scope = { userId, role, branchId,
permissions: Set<string>, seeAllBranches: boolean }`. `requirePermission('x')`
replaces `authorize(role)` (a role→permissions default map keeps existing routes
working).

---

## 2. New entities (Prisma)

Fields shown are additive; all new FKs are indexed. `?` = nullable.

### Platform (Story 01)
- **Branch**: `id, name, code @unique, isActive, createdAt, updatedAt`
- **Department**: `id, name, branchId→Branch, isActive, timestamps` `@@unique([branchId, name])`
- **User** += `branchId→Branch` (required), `departmentId?→Department`
- **Ticket** += `branchId→Branch` (required), `departmentId?→Department`
- **Branding**: `id, scope ("workspace" | branchId), name, logoUrl?, primaryColor, accentColor, updatedAt` `@@unique([scope])`

### Security & Admin (Story 02)
- **Permission**: `key @unique, description` (seeded catalog)
- **UserPermission**: `userId, permissionKey, grantedBy, createdAt` `@@id([userId, permissionKey])`
- **AdminEvent**: `id, actorId?, type, entity, entityId?, before? Json, after? Json, note?, createdAt` (immutable)
- **SystemConfig**: `key @unique, value Json, updatedBy, updatedAt` (typed accessors in `config/systemConfig.ts`)
- `Role` enum values += `SUPERVISOR`, `CUSTOMER`

### Customer Management (Story 03)
- **Attachment**: `id, kind ("customer"|"ticket"|"message"|"kb"), ownerId, filename, mimeType, sizeBytes, storageKey, uploadedById, createdAt`
- **Customer** += `tags String[]` (json), `vipLevel`, `preferredChannel?`, `locale?`, `metadata? Json`
- **Conversation**: `id, customerId→Customer, channel, subject?, status ("open"|"closed"), branchId→Branch, createdAt, updatedAt`
- **Message**: `id, conversationId→Conversation, direction ("IN"|"OUT"), channel, body, authorUserId?, ticketId?→Ticket, externalId?, meta? Json, createdAt`

### Ticket Management (Story 04)
- **Tag**: `id, name, color, branchId?→Branch (null = global)` `@@unique([branchId, name])`
- **TicketTag**: `ticketId, tagId` `@@id([ticketId, tagId])`
- **TicketWatcher**: `ticketId, userId, createdAt` `@@id([ticketId, userId])`
- `TicketEventType` += `MERGED`, `SPLIT_FROM`, `KB_LINKED`, `AI_CATEGORIZED`, `AI_SUMMARY`, `TAGGED`, `WATCH`, `BULK`
- `Ticket` += `mergedIntoId?→Ticket`, `splitFromId?→Ticket`

### Channels (Story 05)
- **ChatSession**: `id, customerId?→Customer, visitorKey?, branchId→Branch, status ("queued"|"active"|"ended"), agentId?→User, ticketId?→Ticket, startedAt, endedAt?`
- **ChatMessage**: `id, sessionId→ChatSession, sender ("visitor"|"agent"|"bot"), body, createdAt`
- **WebForm**: `id, formKey @unique, branchId→Branch, name, autoCreateTicket, defaultCategory?, routingRuleId?, isActive`
- reuses **Conversation/Message**; `channel` values: `WEB, EMAIL, PHONE, CHAT, WHATSAPP, SMS, PORTAL, WEBFORM, API`

### Automation (Story 06)
- **AutomationRule**: `id, name, trigger, conditions Json, actions Json, branchId?→Branch, orderIndex, isActive, createdBy, timestamps`
- **RuleRun**: `id, ruleId, ticketId, trigger, matched, actionsApplied Json, createdAt` (idempotency + audit)
- **Notification**: `id, userId→User, type, title, body, entity, entityId?, readAt?, createdAt`
- **AgentWorkload** (view or maintained counter): `userId, activeAssigned`

### Knowledge Base (Story 07)
- **KbArticle**: `id, title, slug, body, type, category?, tags String[], status, visibility, authorId→User, branchId?→Branch, version, usefulCount, createdAt, updatedAt` `@@unique([branchId, slug])`
- **KbArticleVersion**: `id, articleId→KbArticle, version, title, body, editorId, createdAt`
- **KbArticleFts**: FTS5 virtual table `(articleId UNINDEXED, title, body)` synced by the KB repository
- **TicketArticle**: `ticketId, articleId, linkedBy, createdAt` `@@id([ticketId, articleId])`

### AI (Story 08)
- **AiInteraction**: `id, kind, userId?, ticketId?, model, inputHash, tokensIn?, tokensOut?, latencyMs, costUsd?, outcome ("ok"|"error"|"low_confidence"), createdAt`

### Portal (Story 09)
- **CustomerUser**: `id, customerId→Customer, email @unique, passwordHash, isActive, lastLoginAt?, createdAt`
- **CsatResponse**: `id, ticketId→Ticket @unique, customerId, score Int (1..5), comment?, token @unique, createdAt`

### Agent workspace (Story 10)
- **Task**: `id, title, notes?, dueAt?, status ("open"|"done"), assigneeId→User, createdById→User, ticketId?→Ticket, completedAt?, createdAt`
- **QuickReply**: `id, title, body, category?, scope ("global"|"branch"|"personal"), branchId?, ownerId?, createdAt`
- **Mention**: `id, commentId→TicketComment, mentionedUserId→User, byUserId, createdAt`

### Reports (Story 11)
- **SavedReport**: `id, ownerId→User, name, kind, filters Json, createdAt`
- (reports are query-time aggregations; no fact tables in this MVP — documented ceiling)

### Integrations (Story 12)
- **ApiKey**: `id, label, hashedKey @unique, prefix, scopes String[], branchId?→Branch, createdById→User, lastUsedAt?, revokedAt?, createdAt`
- **Webhook**: `id, url, events String[], secret (encrypted), isActive, createdById, createdAt`
- **WebhookDelivery**: `id, webhookId→Webhook, event, payloadHash, status ("pending"|"ok"|"failed"), attempts, lastAttemptAt?, responseCode?, createdAt`
- **ErpLink**: `id, localKind ("customer"|"ticket"), localId, erpId, provider, syncedAt` `@@unique([localKind, localId, provider])`

Enum values are added to `server/src/types/enums.ts` (+ `web/src/api/types.ts`) —
never native Prisma enums ([ADR-0002](../adr/0002-enums-as-validated-strings.md)).

---

## 3. Ports (interfaces)

```ts
// src/ports/channel/ChannelProvider.ts
export interface NormalizedMessage {
  channel: Channel; direction: 'IN' | 'OUT'; body: string;
  fromExternalId?: string; toExternalId?: string; externalId?: string;
  ticketRef?: string; inReplyTo?: string; meta?: Record<string, unknown>;
}
export interface ChannelProvider {
  readonly channel: Channel;
  send(msg: NormalizedMessage): Promise<{ externalId?: string }>;
  parseInbound(payload: unknown, headers: Record<string, string>): Promise<NormalizedMessage>;
  verifySignature(payload: unknown, headers: Record<string, string>): boolean;
}

// src/ports/ai/AiProvider.ts
export interface AiProvider {
  summarize(input: { text: string }): Promise<{ summary: string }>;
  suggestReply(input: { ticketText: string; lastCustomerMessage: string; kb: string[] }): Promise<{ draft: string }>;
  categorize(input: { text: string }): Promise<{ category: TicketCategory; priority: TicketPriority; confidence: number }>;
  suggestSolutions(input: { text: string; candidates: { id: string; title: string; body: string }[] }): Promise<{ articleIds: string[] }>;
  chat(input: { history: { role: 'user' | 'assistant'; content: string }[]; kb: string[] }): Promise<{ reply: string; wantsHuman: boolean }>;
}

// src/ports/erp/ErpProvider.ts
export interface ErpProvider {
  lookupCustomer(externalId: string): Promise<Partial<CustomerDto> | null>;
  pushTicket(t: TicketDto): Promise<{ erpId: string }>;
  pullUpdates(since: Date): Promise<ErpUpdate[]>;
}

// src/ports/notify/Notifier.ts
export interface Notifier { send(n: NotificationInput): Promise<void>; }
```

Provider selection: `src/ports/registry.ts` reads `SystemConfig` + env
(`AI_PROVIDER`, `SMTP_URL`, `TWILIO_*`, `ERP_PROVIDER`) and returns the active
instance; `NODE_ENV=test` always returns the mock. Every port has a **contract
test** (`ports/<x>/contract.test.ts`) run against real + mock.

---

## 4. Scoping helper

```ts
// src/lib/scope.ts  (pure)
export type Scope = {
  userId: string; role: Role; branchId: string;
  permissions: Set<string>; seeAllBranches: boolean;
};
export function scopeWhere<T extends { branchId?: string }>(
  scope: Scope, base: T,
): T & { branchId?: string } {
  if (scope.seeAllBranches) return base;
  return { ...base, branchId: scope.branchId };
}
export function assertInScope(scope: Scope, entityBranchId: string): void; // throws NotFoundError
```

Used by every list/read in `customers`, `tickets`, `reports`, `users`, `kb`,
`tasks`. Writes call `assertInScope` after load. Unit tests:
admin / branch-limited / `branch:all`.

---

## 5. i18n mechanics

- **Server**: `src/messages/index.ts` — `t(code: string, lang: 'en'|'ar', vars?) → string`,
  falling back `ar → en → code`. `errorHandler` calls it with `req.language`
  (from `Accept-Language`, default `en`). The `code` in the envelope never changes.
- **Client**: `react-i18next`, `web/src/locales/{en,ar}.json`, `<I18nProvider>` in
  `App.tsx`, `useT()` hook, a `<LangSwitcher>` in `Layout`. On change:
  `i18n.changeLanguage`, `document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr'`,
  persist to `localStorage('crm.lang')`. CSS uses logical properties
  (`margin-inline-start`, `padding-inline`, `inset-inline`) so RTL mirrors for free;
  a few explicit `[dir=rtl]` overrides where needed.

---

## 6. New / changed endpoints (summary — full list per story plan)

```
# Platform
GET/POST/PATCH  /api/branches        /api/departments
GET/PATCH       /api/branding
# Security
GET/POST/DELETE /api/users/:id/permissions
GET             /api/admin/events                 (audit viewer, filters + CSV)
GET/PATCH       /api/system-config
# Customers
POST/GET/DELETE /api/tickets/:id/attachments  /api/customers/:id/attachments
GET             /api/customers/:id/history       (unified)
POST            /api/customers/:id/merge
# Tickets
GET/POST        /api/tags        POST /api/tickets/:id/tags
POST/DELETE     /api/tickets/:id/watchers
POST            /api/tickets/:id/merge   /api/tickets/:id/split
POST            /api/tickets/bulk
# Channels
POST (public)   /public/forms/:formKey
POST            /webhooks/email   /webhooks/twilio     (signature-verified)
GET/POST        /api/chat/sessions   /api/chat/sessions/:id/messages
POST            /api/tickets/:id/reply   { channel, body }
# Automation
GET/POST/PATCH  /api/automation-rules      POST /api/admin/run-sla-sweep (kept)
GET/PATCH       /api/notifications         POST /api/notifications/read-all
# KB
GET/POST/PATCH  /api/kb        GET /api/kb/search
POST            /api/tickets/:id/articles
GET (public)    /public/kb     /public/kb/:slug
# AI
POST            /api/ai/summarize/:ticketId   /api/ai/suggest-reply/:ticketId
POST            /api/ai/categorize            /api/ai/suggest-solutions
POST (public)   /public/chat
# Portal
POST            /portal/auth/login
GET/POST        /portal/tickets   /portal/tickets/:id/replies
GET             /portal/kb        POST /portal/csat/:token
# Agent workspace
GET/POST/PATCH  /api/tasks        /api/quick-replies
# Reports
GET             /api/reports/tickets  /sla  /agents  /csat  /overview   (+ ?format=csv)
GET/POST        /api/saved-reports
# Integrations
GET/POST/DELETE /api/api-keys      /api/webhooks
GET             /api/webhooks/:id/deliveries   POST /api/webhooks/:id/deliveries/:did/resend
/api/v1/*  (API-key auth)  +  GET /api/v1/openapi.json
POST            /api/erp/sync/customer/:id
```

---

## 7. Testing additions

- **Port contract tests** — one spec per port, run against real + mock, asserting
  the same shape/behaviour. No network in tests (real providers guarded by env that
  is unset under `NODE_ENV=test`).
- **Rule engine** — pure unit tests: condition matching truth table, action list
  bounded, idempotency (same trigger twice → one `RuleRun`).
- **Assignment strategies** — pure: round-robin cursor, least-loaded tie-break,
  skip inactive/over-capacity.
- **Scoping** — pure, as §4.
- **i18n resolver** — `ar` hit, `ar` miss → `en`, both miss → `code`.
- **FTS** — integration: index 3 articles, `search('refund')` ranks the right one,
  snippet contains `<mark>`.
- **Webhooks** — signing round-trip (pure) + integration: create ticket →
  `WebhookDelivery` row; target 500 → retried, status `failed` then `ok` on resend.
- **Portal isolation** — a `CUSTOMER` token → 403 on any `/api/*` agent route;
  internal comments never appear in `/portal/tickets/:id`.
- Everything keeps running against a **fresh temp SQLite DB** per test file.

---

## 8. Migration & rollback posture

- One Prisma migration **per story**, named `NN_<slug>`. Additive columns are
  **nullable** or have defaults; a data-backfill step (e.g. assign every existing
  user/ticket to a seeded "HQ" branch) runs in the same migration or a follow-up
  `prisma/backfills/NN_*.ts` invoked by `db:reset`.
- Rollback = `prisma migrate resolve --rolled-back` + revert the code commit; since
  new columns are nullable/defaulted, a half-applied state degrades to "feature
  absent", not "app broken".
- `main` (v1) is the fallback the whole time.
