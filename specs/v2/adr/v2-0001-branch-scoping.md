# ADR V2-0001- — Branch scoping via a single `scopeWhere` helper

**Status:** Accepted · 2026-09-08 · branch `v2-full-scope`

## Context
v2 adds Branch/Department. Non-admins must only see their branch's data. Doing this
ad-hoc per query is where multi-tenancy leaks happen.

## Options
1. Row-level security in the DB — SQLite has none; Postgres-only, hard to test.
2. A Prisma middleware that injects `branchId` into every query — implicit, brittle
   with relations and aggregations, hard to reason about.
3. **An explicit pure helper** `scopeWhere(scope, where)` + `assertInScope(scope, x)`
   called by every list/read service; writes guard after load.

## Decision
Option 3. `scope` is built once by `resolveScope` middleware from `req.user`.
Foreign-branch reads return **404, not 403** (no existence leak).

## Consequences
+ Unit-testable in isolation; obvious at every call site; works for aggregations.
- Discipline required — a missed call site is a leak. Mitigated by an integration
  test that proves cross-branch isolation, and by code review of every list service.
- `branch:all` permission (Story 02) later feeds `scope.seeAllBranches`.
