# Security posture

The controls in place for this MVP, where they live, and what is deliberately
deferred. Requirement IDs refer to
[specs/01-requirements.md](specs/01-requirements.md).

## Authentication

| Control | Implementation | Requirement |
|---------|----------------|-------------|
| Password hashing | bcrypt, cost from `BCRYPT_ROUNDS` (≥10) — `server/src/lib/password.ts` | REQ-NFR-1 |
| Session tokens | JWT **HS256**, secret from `JWT_SECRET` (validated ≥16 chars on boot), 8 h expiry — `server/src/lib/jwt.ts` | REQ-NFR-1 |
| Token transport | `Authorization: Bearer` only; stored client-side in `localStorage` (`crm.token`), never in a cookie → no CSRF surface | — |
| Live revocation | `authenticate` re-loads the user from the DB on **every** request; a deactivated account with a still-valid token is rejected immediately — `server/src/middleware/authenticate.ts` | REQ-AUTH-5 |
| Brute-force resistance | `express-rate-limit` on `POST /auth/login` (20 / 15 min) — `server/src/modules/auth/auth.routes.ts` | REQ-AUTH-6 |
| No user enumeration | Unknown email and wrong password return the identical `401` — `server/src/modules/auth/auth.service.ts` | REQ-AUTH-2 |

## Authorization

| Control | Implementation | Requirement |
|---------|----------------|-------------|
| Server-side RBAC | `authorize(...roles)` on every protected route; the pure decision `canAccess()` is unit-tested — `server/src/middleware/authorize.ts` | REQ-RBAC-1 |
| Admin-only actions | `POST/PATCH /users`, `DELETE /customers/:id`, `POST /admin/run-sla-sweep` → `403 FORBIDDEN` for agents (integration-tested) | REQ-RBAC-2 |
| Client is not the boundary | The SPA only *hides* admin controls; every check is re-done on the server | REQ-RBAC-4 |

## Input handling

| Control | Implementation | Requirement |
|---------|----------------|-------------|
| Edge validation | Every body / query / param parsed with Zod via `validate()` before the handler runs; handlers read `req.valid.*` only — `server/src/middleware/validate.ts` | REQ-API-3 |
| SQL injection | No raw SQL; all access through Prisma's parameterised query builder | — |
| Body size limit | `express.json({ limit: '1mb' })` — `server/src/app.ts` | REQ-NFR-2 |
| Error leakage | Central handler maps known errors to stable codes; anything else → `500 INTERNAL` with a generic body, full stack logged server-side only — `server/src/middleware/errorHandler.ts` | REQ-API-4 |
| Consistent 404 | Missing resources return a plain `404 NOT_FOUND` with no hint about existence | REQ-CUS-5 |

## Transport & headers

| Control | Implementation |
|---------|----------------|
| Security headers | `helmet()` (default set: `X-Content-Type-Options`, `X-Frame-Options`, HSTS when over TLS, etc.) — `server/src/app.ts` |
| CORS | Origin **allow-list** from `CORS_ORIGIN` (comma-separated), `credentials: true`; no wildcard |
| `x-powered-by` | Disabled |

## Secrets & configuration

- `.env` is git-ignored; only `.env.example` with dummy values is committed
  (`git ls-files | grep -E '\.env'` → examples only).
- All env vars are validated on boot (`server/src/config/env.ts`); the server
  refuses to start on a missing/short `JWT_SECRET` or a malformed value.
- Seed data is entirely fictional (`*.example` email domains).

## Data lifecycle

- **Audit:** every ticket mutation writes an immutable `TicketEvent`
  ([ADR-0004](specs/adr/0004-immutable-audit-log.md)); no update/delete path.
- **Cascade deletes** are explicit in the schema (`Customer → Ticket → Comment /
  Event`), and customer deletion is blocked while any ticket is open
  (REQ-CUS-7).

## Testing for security & edge cases

Covered by the automated suite (see
[specs/04-acceptance-criteria.md](specs/04-acceptance-criteria.md)):

- wrong password / unknown email / deactivated user / missing token / garbage
  token → `401`
- agent → admin route → `403`
- malformed bodies → `400` with a `details[]` array
- illegal state transitions → `409 INVALID_TRANSITION`
- delete-guard conflict → `409`
- SLA boundary conditions (exactly at due vs. 1 ms over)
- sweep idempotency (no duplicate escalations / events on repeated runs)
- duplicate unique values → `409` (Prisma `P2002` mapping)

## Known limitations / deferred

| Area | Status | Path |
|------|--------|------|
| Refresh tokens / logout-all | Not implemented | Add a `tokenVersion` column checked in `authenticate` |
| HTTPS termination | Out of scope (deploy concern) | Terminate at the load balancer / reverse proxy; `helmet` HSTS then applies |
| Account lockout / MFA | Not implemented | Add failed-attempt tracking + TOTP |
| Rate limiting beyond login | Only `/auth/login` is limited | Add a global limiter tuned to the SPA's request pattern |
| Dependency scanning | CI runs lint/tests/build; no `npm audit` gate | Add `npm audit --production` / Dependabot |
| Audit-log tamper-proofing | App-level immutability only | Append-only store / periodic hash chaining if required |

## Reporting

This is an assessment project, not a deployed service. For real use, route
disclosures to a monitored security contact and add a `SECURITY.txt`.
