# ADR-0003 — Thin routes; a service layer owns business rules

**Status:** Accepted · 2026-09-01

## Context

Ticket logic is non-trivial: SLA computation, a status-transition guard,
first-response stamping, per-field audit events, escalation. This must be
testable and must not leak into HTTP handling.

## Options

1. **Fat controllers** — logic in the route handler. Fast to write, hard to test
   (need `req`/`res`), invites duplication.
2. **Active-record models** — logic on the entity. Prisma models are plain data;
   bolting behaviour on fights the grain.
3. **Route → service → repository(Prisma)** — explicit layers.

## Decision

Each module is `routes` + `service` + `schemas`:

- **routes** — parse with `validate(schema)`, call one service function, send the
  result. No branching on domain state.
- **service** — owns the business rules; the only place that touches Prisma for
  its aggregate; writes its own `TicketEvent` rows; throws `AppError` subclasses.
- **schemas** — Zod, colocated.
- Pure sub-modules (`lib/sla.ts`, `tickets/transitions.ts`) hold clock-free logic.

## Consequences

- **+** Services are unit/integration-tested directly; routes stay boring.
- **+** One obvious place for each rule; audit writes can't be forgotten because
  they live next to the mutation.
- **+** Swapping the transport (e.g. adding a queue consumer) reuses the services.
- **−** More files per feature. Worth it for a domain with real rules; noted as
  overkill for pure CRUD, where the service is a thin pass-through (`users`).
