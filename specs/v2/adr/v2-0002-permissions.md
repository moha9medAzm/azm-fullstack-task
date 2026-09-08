# ADR V2-0002- — Permission strings over bare role checks

**Status:** Accepted · 2026-09-08 · branch `v2-full-scope`

## Context
v1 has `authorize('ADMIN')`. v2 needs finer control (a supervisor who can view
reports but not manage config; granting one agent `report:view`).

## Options
1. Add more roles — combinatorial explosion.
2. **Permission strings** (`ticket:delete`, `report:view`, `branch:all`, …); a role
   maps to a default set; admins grant/revoke per user.
3. Full policy engine (CASL/oso) — overkill for this scope.

## Decision
Option 2. `requirePermission('x')` replaces `authorize(role)` via a role→permissions
default map (existing routes keep working). `canAccess(perms, 'x')` stays the pure,
unit-tested decision. Grants live in `UserPermission`.

## Consequences
+ Extensible without new roles; per-user overrides; still simple.
- A second lookup per request (permissions) — cached on `req.scope` for the request.
