# Story intake

## Feature

- **Feature name (display):** Integrations
- **Feature slug (folder under `plans/`):** `integrations`

## Tracker (metadata only)

- **Tracker type:** `none`
- **Work item id:** `AREA-11`

---

## Title

```
Integrations -- Story 12 of the v2 full-12-area build
```

---

## Description

```
Part of the v2 rebuild on branch v2-full-scope: evolve the working 5-area MVP into the
full 12-area product. Read these first -- they are the contract for this story:

- specs/v2/00-overview.md      -- scope, architecture evolution, the 12-story roadmap
- specs/v2/01-requirements.md  -- EARS requirements; THIS story delivers: REQ-INT-1..6
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
Add ApiKey issuance (hashed, scopes, branch, shown once) + a public /api/v1/* namespace
(customers, tickets read/create/comment, kb read) with API-key auth, per-key
scope+branch enforcement, per-key rate limiting, 429 on overflow. Outbound Webhook
(events, secret, signed JSON, retry+backoff, WebhookDelivery log, manual resend).
ErpProvider port + MockErpProvider (fixtures) + ErpLink rows + a documented real-
connector shape. Generate an OpenAPI 3 doc for /api/v1 at /api/v1/openapi.json.
Secrets stored hashed/encrypted, never returned or logged.
```

---

## Acceptance criteria

```
Every requirement in specs/v2/01-requirements.md under this story's area (REQ-INT-1..6),
each with the automated test named in its row, plus the cross-cutting REQ-V2-1..6.
```

---

## Dependencies

- **Depends on other stories:** see the roadmap table in specs/v2/00-overview.md section 3.
