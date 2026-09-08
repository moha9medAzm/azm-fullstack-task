# Story intake

## Feature

- **Feature name (display):** Agent Dashboard
- **Feature slug (folder under `plans/`):** `agent-workspace`

## Tracker (metadata only)

- **Tracker type:** `none`
- **Work item id:** `AREA-04`

---

## Title

```
Agent Dashboard -- Story 10 of the v2 full-12-area build
```

---

## Description

```
Part of the v2 rebuild on branch v2-full-scope: evolve the working 5-area MVP into the
full 12-area product. Read these first -- they are the contract for this story:

- specs/v2/00-overview.md      -- scope, architecture evolution, the 12-story roadmap
- specs/v2/01-requirements.md  -- EARS requirements; THIS story delivers: REQ-WS-1..5
- specs/v2/02-design.md        -- new entities, ports, scoping helper, i18n, endpoint map
- specs/01-requirements.md, specs/02-design.md, specs/adr/ -- v1 (still in force)
- specs/08-walkthrough.md      -- component-by-component tour of the current code

EXISTING CODE CONVENTIONS TO KEEP (do not regress):
- server/: module = {{ routes, service, schemas }}; thin routes -> service holds logic
  -> Prisma. Zod validation on every route. Central error envelope
  {{ error: {{ code, message, details? }} }}. Lists return {{ data, page, pageSize, total }}.
- RBAC: after Story 02 use requirePermission('<perm>'); before it, authorize(role).
  req.scope (from resolveScope middleware, Story 01) carries branchId + permissions.
- Enums are validated String columns in server/src/types/enums.ts, mirrored in
  web/src/api/types.ts. Never native Prisma enums (SQLite).
- Every schema change = one committed Prisma migration named NN_<slug>; new columns
  nullable or defaulted; backfill in the same migration or prisma/backfills/.
- Pure logic unit-tested with injected inputs; new endpoints integration-tested with
  Supertest against a fresh temp SQLite DB (tests/helpers/*). No network in tests --
  external providers are OFF by default with a working mock.
- web/: React + Vite + TS, TanStack Query hooks per resource, React Hook Form + Zod
  forms, hand-written CSS with logical properties (RTL-safe). i18n via the en/ar
  catalog (Story 01) -- no hard-coded visible strings on touched screens.
- Update specs/v2 requirements + the v2 traceability matrix, RUNNING.md, and add a
  short demo script for this area as part of Done Criteria.

SPECIFIC SCOPE FOR THIS STORY:
Add Task/reminders (due dates, overdue highlight, on-ticket + My Tasks panel),
QuickReply canned responses with {{{{placeholders}}}} filled from ticket/customer
(scopes: global/branch/personal), and team collaboration: @mention in an internal
comment -> Notification + auto-watch + an internal-only threaded discussion never shown
on the portal. Extend the agent dashboard with my tasks / my mentions / watched tickets
/ workload number (feeds LEAST_LOADED assignment).
```

---

## Acceptance criteria

```
Every requirement in specs/v2/01-requirements.md under this story's area (REQ-WS-1..5),
each with the automated test named in its row, plus the cross-cutting REQ-V2-1..6.
```

---

## Dependencies

- **Depends on other stories:** see the roadmap table in specs/v2/00-overview.md section 3.
