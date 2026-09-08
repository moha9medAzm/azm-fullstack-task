# v2 — Full 12-area Customer Support CRM: overview & roadmap

**Branch:** `v2-full-scope` (forked from the working 5-area MVP on `main`).
**Goal:** evolve the MVP into the full product from `azm_squad_customer_support_crm.pdf`
— **all 12 feature areas** — using the [Squad-Kit](https://github.com/AzmSquad/Squad-Kit)
SDD workflow (`.squad/stories/` → `.squad/plans/` → implement, one story at a time).

v1 docs stay valid for what's already built:
[specs/01-requirements.md](../01-requirements.md), [specs/02-design.md](../02-design.md),
[specs/adr/](../adr/). This folder adds everything v2.

---

## 1. Scope: what "all 12" means here

A few areas need paid third-party accounts/keys that aren't available in this
environment (live WhatsApp/SMS/Email gateways, a real ERP). The build interpretation
(agreed with the owner) is:

> **Every area is a real, tested module with a clean interface.** Real provider where
> it's free/feasible; a working **mock provider + a real-provider skeleton** where it
> needs paid infra.

| # | Brief area | v1 | v2 delivery |
|---|-----------|----|-------------|
| 1 | Customer Management | core | + attachments, richer profile, **cross-channel** interaction history |
| 2 | Ticket Management | full | + tags, watchers/followers, merge & split, bulk actions |
| 3 | Communication Channels | field only | **`ChannelProvider` port**: Web Forms (real), Live Chat (real, polling), Email (real SMTP out + inbound webhook parser; mock for demo), WhatsApp/SMS (mock provider + Twilio/Meta skeleton) |
| 4 | Agent Dashboard | core | + tasks & reminders, quick replies (canned responses), team collaboration (@mentions, internal threads) |
| 5 | SLA & Automation | core | + **rules engine**: automatic assignment, escalation rules, alerts & notifications (in-app real + email adapter) |
| 6 | Knowledge Base | — | FAQs, help articles, solutions/guides, **full-text search**, article ↔ ticket linking |
| 7 | AI Features | — | **`AiProvider` port** (Claude API real + deterministic mock): ticket summaries, suggested replies, auto-categorization, suggested solutions (retrieval over the KB), AI chatbot |
| 8 | Customer Portal | — | `CUSTOMER` role + portal auth; submit / track / history / FAQs / feedback (**CSAT**) |
| 9 | Reports & Management | dashboard only | ticket reports, SLA performance, agent performance, CSAT, management dashboards, **CSV export** |
| 10 | Security & Administration | core | **granular permissions** (permission strings, not just role), audit-log viewer UI, system-configuration screen |
| 11 | Integrations | — | **public REST API + API keys/tokens**, **webhooks** (outbound), ERP connector (`ErpProvider` port + mock) |
| 12 | Platform | English SPA | **i18n Arabic + English + RTL**, responsive/mobile, **multi-department & multi-branch** data model + scoping, **custom branding** (per workspace / per branch) |

Full acceptance criteria: [01-requirements.md](01-requirements.md).

---

## 2. Architecture evolution (from v1)

Everything in [specs/02-design.md](../02-design.md) still holds. v2 adds:

### 2.1 Multi-tenancy-lite: Branch / Department + scoping
- New entities **`Branch`**, **`Department`**. `User.branchId` (required),
  `User.departmentId?`. `Ticket.branchId` (required), `Ticket.departmentId?`.
- A request **`scope`** derived from `req.user` + granted permissions. `ADMIN` and
  anyone with `branch:all` see everything; others are limited to their branch.
- Enforced by a **`scopeWhere(scope, resource)`** helper used by every list/read
  service — never ad-hoc per query. ([ADR v2-0001](adr/v2-0001-branch-scoping.md))

### 2.2 Permissions layer (area 10)
- Keep `Role` (`ADMIN` / `AGENT` / `SUPERVISOR` / `CUSTOMER`) as the coarse grouping,
  but authorization checks a **permission string** (`ticket:delete`, `kb:publish`,
  `report:view`, `branch:all`, …). A role maps to a default permission set; an admin
  can grant/revoke individual permissions per user.
- `authorize()` becomes `requirePermission('ticket:delete')`; `canAccess()` stays the
  pure, unit-tested decision. ([ADR v2-0002](adr/v2-0002-permissions.md))

### 2.3 Provider ports (areas 3, 7, 11)
A small **hexagonal** seam per external concern:

```
src/ports/
  channel/   ChannelProvider  (send, parseInbound)   + WebFormProvider, LiveChatProvider,
                                                        EmailProvider(SMTP+mock), TwilioProvider(skeleton), MockProvider
  ai/        AiProvider  (summarize, suggestReply, categorize, suggestSolutions, chat)
                                                      + ClaudeProvider, MockAiProvider
  erp/       ErpProvider  (lookupCustomer, pushTicket) + MockErpProvider
  notify/    Notifier  (send)                          + InAppNotifier(real), EmailNotifier(adapter)
```

The active provider is chosen from config/env; tests always use the mock.
([ADR v2-0003](adr/v2-0003-provider-ports.md))

### 2.4 i18n (area 12)
- **Server:** error messages come from a `messages/{en,ar}.ts` catalog keyed by the
  error `code`. The envelope stays code-first so the client can also translate.
- **Client:** `react-i18next` + `locales/{en,ar}.json`; a header switcher; persisted in
  `localStorage`; `<html dir>` + a mirrored layout for Arabic. Every visible string
  moves to the catalog. ([ADR v2-0004](adr/v2-0004-i18n-rtl.md))

### 2.5 Full-text search (areas 6, 1)
- SQLite **FTS5** virtual tables for KB articles and (optionally) tickets, kept in sync
  by triggers or a thin repository. Postgres path documented (`tsvector`).

### 2.6 New top-level modules
`branches`, `departments`, `permissions`, `system-config`, `branding`, `channels`,
`chat`, `kb`, `tasks`, `quick-replies`, `notifications`, `automation-rules`, `ai`,
`portal`, `reports`, `api-keys`, `webhooks`, `erp`. Same `routes + service + schemas`
pattern; provider-backed modules also have a `*.provider.ts` under `src/ports/`.

### 2.7 Data model additions (summary)
`Branch`, `Department`, `Permission` (grant table `UserPermission`), `SystemConfig`,
`Branding`, `Attachment`, `Tag` (+ `TicketTag`), `TicketWatcher`, `Conversation` +
`Message` (channel threads), `ChatSession` + `ChatMessage`, `KbArticle` +
`KbArticleFts`, `Task`, `QuickReply`, `Notification`, `AutomationRule`, `AiInteraction`,
`CustomerUser` (portal login), `CsatResponse`, `SavedReport`, `ApiKey`, `Webhook` +
`WebhookDelivery`, `ErpLink`. Full field list: [02-design.md](02-design.md) §3.

---

## 3. Roadmap — 12 Squad-Kit stories, in execution order

Each story = a folder under `.squad/stories/<slug>/` (intake) and a plan under
`.squad/plans/<slug>/NN-story-<slug>.md`. Plans are authored **just before** their
story is implemented (Squad-Kit's "plan one, execute, plan the next"), not all up
front — so a later plan reflects the code the earlier stories actually produced.

| NN | Story slug | Area | Depends on | Why this order |
|----|-----------|------|-----------|----------------|
| 01 | `platform-foundation` | 12 | — | Branch/Department + scoping + i18n + branding touch every table and screen; must be first. |
| 02 | `security-admin` | 10 | 01 | Permissions layer replaces bare role checks that stories 03+ will rely on. |
| 03 | `customer-management` | 1 | 01 | Attachments infra + `Conversation`/`Message` model that channels (05) and portal (08) reuse. |
| 04 | `ticket-management` | 2 | 01, 02 | Tags/watchers/merge — small, unblocks automation (06) and reports (11). |
| 05 | `channels` | 3 + 11(comms) | 03 | The `ChannelProvider` port + Web Form + Live Chat + Email/WhatsApp adapters. |
| 06 | `sla-automation` | 5 | 02, 04, 05 | Rules engine (assignment/escalation) + notifications; needs permissions, tags, channels. |
| 07 | `knowledge-base` | 6 | 02 | Articles + FTS search; consumed by AI (08) and portal (09). |
| 08 | `ai-features` | 7 | 07 | `AiProvider` port; suggested-solutions retrieves over the KB. |
| 09 | `customer-portal` | 8 | 03, 05, 07 | `CUSTOMER` role, portal auth, submit/track/FAQ/CSAT. |
| 10 | `agent-workspace` | 4 | 04, 06 | Tasks, quick replies, @mentions — polish on top of a working ticket flow. |
| 11 | `reports-management` | 9 | 04, 06, 09 | Aggregations over everything above + CSV export. |
| 12 | `integrations` | 11 | 02, 04 | Public API + API keys + webhooks + `ErpProvider` mock. |

### Definition of done per story
`tsc --noEmit` clean · new unit + integration tests green · `npm run lint` + `format:check`
clean · `npm run build` clean · CI green · `specs/v2/` requirements + traceability
updated · a git commit `feat(<area>): …` · the app still runs end-to-end.

### Definition of done for v2 (merge to `main`)
All 12 stories done · every `REQ-*` (v1 + v2) in the traceability matrix implemented +
tested on frontend and backend · `RUNNING.md` updated · a short demo script per area.

---

## 4. Squad-Kit usage notes

- Workspace initialised: `.squad/config.yaml` (planner: anthropic, agents: claude-code).
- `squad new-plan --api` is **non-functional in this environment** (Node 18.13 vs. the
  Claude Agent SDK's resource-management API — `Object not disposable`). Plans are
  produced in **copy-paste mode**: `squad new-plan --copy` composes Squad-Kit's bundled
  `generate-plan.md` meta-prompt with the intake into `.squad/.last-copy-prompt.md`, and
  the plan file is authored to that exact spec (`# Story NN — …`, Prerequisites, Story
  Goal, Context — Read These Files First, Backend/Frontend Tasks, Edge Cases & Failure
  Modes, Test Plan, Migration/Rollback, Verification Steps, Done Criteria).
- `.squad/secrets.yaml` is git-ignored; no keys are committed.
- On a machine with Node ≥ 20 and a Claude login, `squad new-plan --api` would generate
  these plans directly.
