# Story intake

## Feature

- **Feature name (display):** Reports & Management
- **Feature slug (folder under `plans/`):** `reports-management`

## Tracker (metadata only)

- **Tracker type:** `none`
- **Work item id:** `AREA-09`

---

## Title

```
Reports & Management -- Story 11 of the v2 full-12-area build
```

---

## Description

```
Part of the v2 rebuild on branch v2-full-scope: evolve the working 5-area MVP into the
full 12-area product. Read these first -- they are the contract for this story:

- specs/v2/00-overview.md      -- scope, architecture evolution, the 12-story roadmap
- specs/v2/01-requirements.md  -- EARS requirements; THIS story delivers: REQ-RPT-1..7
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
Add aggregation report endpoints (ticket volume/trends, SLA performance, agent
performance, CSAT), a management dashboard screen (KPI tiles + small charts, gated by
report:view), CSV export of the underlying rows for every report, SavedReport for
stored filter sets, and branch scoping for supervisors. Queries must be aggregation SQL
(bounded, no N+1).
```

---

## Acceptance criteria

```
Every requirement in specs/v2/01-requirements.md under this story's area (REQ-RPT-1..7),
each with the automated test named in its row, plus the cross-cutting REQ-V2-1..6.
```

---

## Dependencies

- **Depends on other stories:** see the roadmap table in specs/v2/00-overview.md section 3.
