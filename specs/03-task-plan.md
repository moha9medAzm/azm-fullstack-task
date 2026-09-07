# 03 — Task plan

The work was broken into **7 phases / 34 tasks**, ordered so every task ends with
`tsc --noEmit` + the full test suite green and a descriptive commit. Status is
recorded below with the commit that delivered each phase.

| Commit | Phase | Date |
|--------|-------|------|
| `58abae5` | Phase 0–1 — scaffold, schema, env/errors/auth primitives, SLA lib | 2026-09-01 |
| `e942eab` | Phase 2–4 — customers, tickets, dashboard, admin, SLA sweep, seed | 2026-09-01 |
| `0c985dd` | Phase 5 — React agent console | 2026-09-01 |
| `f3e406b` | Phase 6 — hardening review, full README, timeline polish | 2026-09-01 |
| `20eedba` | Docs — RUNNING.md runbook | 2026-09-01 |

Legend: ✅ done · addresses `REQ-*` from [01-requirements.md](01-requirements.md).

---

## Phase 0 — Scaffold  (`58abae5`)

| # | Task | Status |
|---|------|--------|
| T0.1 | Root `package.json` (npm workspaces `server`,`web`), `.gitignore`, `.editorconfig`, README skeleton, `git init` | ✅ |
| T0.2 | `server` scaffold: TS + Express + tsx + Vitest + `tsconfig`; `/health`, `createApp()`, `index.ts`; smoke test | ✅ |
| T0.3 | `web` scaffold: Vite React-TS + router + TanStack Query + RHF/Zod + Vitest/Testing Library; routed shell | ✅ |

## Phase 1 — Data & auth (backend)  (`58abae5`)

| # | Task | REQ | Status |
|---|------|-----|--------|
| T1.1 | `schema.prisma` (all entities/enums), initial migration, `db/prisma.ts` | REQ-NFR-7 | ✅ |
| T1.2 | `config/env.ts` (Zod), `lib/errors.ts`, `middleware/errorHandler.ts`, `middleware/validate.ts`, `lib/pagination.ts` + unit tests | REQ-API-1/3/4/5, REQ-NFR-3 | ✅ |
| T1.3 | `lib/password.ts`, `lib/jwt.ts`, `middleware/authenticate.ts`, `middleware/authorize.ts` + RBAC/JWT unit tests | REQ-AUTH-4/5, REQ-RBAC-1, REQ-NFR-1 | ✅ |
| T1.4 | `auth` module: `POST /auth/login` (+ rate limit), `GET /auth/me` + integration tests | REQ-AUTH-1..3/6/7 | ✅ |
| T1.5 | `prisma/seed.ts` (admin + 2 agents + 8 customers + 25 tickets incl. breaching); `db:reset` | REQ-NFR-7 | ✅ |

## Phase 2 — Customers (backend)  (`e942eab`)

| # | Task | REQ | Status |
|---|------|-----|--------|
| T2.1 | `customers` module: list (`q` + pagination), create, get (+recent tickets), patch, delete with open-ticket guard | REQ-CUS-1..7 | ✅ |
| T2.2 | Integration tests: CRUD, `q`, pagination shape, delete 409→204, validation 400 shape, agent-vs-admin 403 | REQ-CUS-*, REQ-RBAC-2 | ✅ |

## Phase 3 — Tickets (backend, core)  (`e942eab`)

| # | Task | REQ | Status |
|---|------|-----|--------|
| T3.1 | `lib/sla.ts` pure functions + unit tests (per priority, boundary, priority-change recompute) | REQ-TKT-3, REQ-SLA-1/2 | ✅ |
| T3.2 | `tickets/transitions.ts` matrix + `assertTransition` + `isReopen` + unit tests (every pair) | REQ-TKT-8/10 | ✅ |
| T3.3 | `tickets` service + routes: create (SLA, `reference`, `CREATED`), get (full + derived), list (all filters/sort/pagination), patch (per-field diff → events, transition guard, SLA recompute, first-response) | REQ-TKT-1..11, REQ-API-6 | ✅ |
| T3.4 | `POST /comments` (first-response stamp, `COMMENTED`), `POST /assign` (active-user check, `ASSIGNED`/`UNASSIGNED`), `POST /escalate`, `GET /events` | REQ-TKT-12/13, REQ-SLA-3, REQ-AUD-2 | ✅ |
| T3.5 | Integration tests: SLA on create, first-response once, priority recompute + event, illegal transition 409, escalate effects, assign audit, comment internal flag, filters/sort/pagination, auth required | REQ-TKT-*, REQ-AUD-1 | ✅ |

## Phase 4 — SLA automation + dashboard (backend)  (`e942eab`)

| # | Task | REQ | Status |
|---|------|-----|--------|
| T4.1 | `jobs/slaSweep.ts` pure `runSlaSweep({now,client})` + interval wrapper + `POST /admin/run-sla-sweep` (ADMIN) | REQ-SLA-4/5/6 | ✅ |
| T4.2 | Sweep tests: idempotency (run twice → no dup events), escalate only breached+unescalated, resolved/escalated untouched | REQ-SLA-4/5 | ✅ |
| T4.3 | `dashboard` module `GET /dashboard/stats` + integration test asserting each counter | REQ-DASH-1/2 | ✅ |

## Phase 5 — Frontend  (`0c985dd`)

| # | Task | REQ | Status |
|---|------|-----|--------|
| T5.1 | `api/client.ts` (JWT inject, error unwrap, 401→logout), `AuthContext`, `ProtectedRoute`, `Login` page | REQ-AUTH-*, REQ-NFR-8 | ✅ |
| T5.2 | Shared components: `StatCard`, `Badge` (SLA tone), `Spinner`, `ErrorBanner`, `Layout`, `EventLine` + SLA tone unit test | REQ-SLA-7, REQ-NFR-8 | ✅ |
| T5.3 | `Dashboard` page wired to `/dashboard/stats` + quick lists | REQ-DASH-3 | ✅ |
| T5.4 | `Tickets` list: filter bar (status/priority/category/assignee/mine/unassigned/breaching/q), sort, pagination, URL state | REQ-TKT-14 | ✅ |
| T5.5 | `TicketDetail`: inline edits, status/priority/assignee controls, escalate, comment box (internal toggle), activity timeline, SLA badges | REQ-TKT-14, REQ-AUD-3, REQ-SLA-7 | ✅ |
| T5.6 | `TicketNew` form: customer combobox + inline create, RHF/Zod validation | REQ-TKT-14 | ✅ |
| T5.7 | `Customers` list + `CustomerDetail` (edit + ticket history) | REQ-CUS-8 | ✅ |
| T5.8 | `AdminUsers` (ADMIN-gated): list, create, change role, deactivate/reactivate | REQ-USR-4 | ✅ |
| T5.9 | RTL tests: ProtectedRoute redirect, login happy/error, ticket list render + filter refetch, ticket-detail comment submit | REQ-AUTH-*, REQ-TKT-14 | ✅ |
| T5.10 | Backend follow-ups surfaced by the UI: `unassigned=true` ticket filter; `GET /users` returns deactivated users to admins only | REQ-TKT-5, REQ-USR-3 | ✅ |

## Phase 6 — Hardening & docs  (`f3e406b`, `20eedba`)

| # | Task | REQ | Status |
|---|------|-----|--------|
| T6.1 | Helmet, CORS allow-list, JSON body limit, login rate-limit, request logging, 404 handler, graceful shutdown | REQ-NFR-2/4/5, REQ-AUTH-6 | ✅ |
| T6.2 | `README.md`: setup, env, scripts, credentials, architecture, data model, API summary, testing, out-of-scope, AI-usage note, next milestones | — | ✅ |
| T6.3 | Final pass: `typecheck` + 76 server + 6 web tests + `build`, walk acceptance checklist, browser E2E screenshots | REQ-* | ✅ |
| T6.4 | `RUNNING.md` runbook (setup, dev, prod build, tests, troubleshooting) | — | ✅ |

## Phase 7 — SDD package & CI (this change)

| # | Task | Status |
|---|------|--------|
| T7.1 | `specs/` folder: context, EARS requirements, design, task plan, acceptance criteria, traceability matrix, AI-usage doc, assumptions, ADRs | ✅ |
| T7.2 | GitHub Actions CI: typecheck + server tests + web tests + build on push/PR | ✅ |
| T7.3 | ESLint + Prettier configs and `lint` scripts across both workspaces | ✅ |
| T7.4 | `SECURITY.md` consolidating the security posture | ✅ |
| T7.5 | Re-verify full suite + build; update root docs to point at `specs/` | ✅ |
