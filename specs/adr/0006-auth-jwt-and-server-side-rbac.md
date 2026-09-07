# ADR-0006 — JWT + bcrypt + server-side RBAC on every route

**Status:** Accepted · 2026-09-01

## Context

Two roles (`ADMIN`, `AGENT`), an agent SPA, and an API that must not trust the
client. No third-party IdP in scope.

## Options

- **Session cookies + server store** — needs a session table/store; CSRF
  handling; more moving parts for a stateless API + SPA.
- **JWT (stateless)** — no server store; scales trivially; revocation is the
  known weak point.
- RBAC: check in the UI only (insecure) vs. middleware on every route.

## Decision

- **bcrypt** (cost from `BCRYPT_ROUNDS`, ≥10) for password hashing.
- **JWT HS256**, secret from `JWT_SECRET` (≥16 chars, validated on boot), 8 h
  expiry. Returned by `POST /auth/login`, sent as `Authorization: Bearer`.
- `authenticate` middleware verifies the token **and re-loads the user from the
  DB every request** — so deactivating a user revokes access immediately despite
  a still-valid token (mitigates JWT's revocation gap).
- `authorize(...roles)` on every protected route; `canAccess()` is the pure,
  unit-tested decision. The frontend only *hides* admin controls — it is never
  the boundary.
- `POST /auth/login` is rate-limited.

## Consequences

- **+** Stateless, standard, easy to reason about. RBAC is enforced in exactly one
  place per route and tested (agent → admin route → 403).
- **+** Deactivation is effective immediately.
- **−** A per-request user lookup. Cheap (indexed PK) and worth it for the
  revocation property.
- **−** No refresh-token rotation / logout-all. Acceptable at 8 h expiry for this
  scope; add a token-version column if needed.
