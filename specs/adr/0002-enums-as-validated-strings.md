# ADR-0002 — Model enums as validated `String` columns

**Status:** Accepted · 2026-09-01

## Context

The domain has several closed value sets (`Role`, `TicketStatus`,
`TicketPriority`, `TicketCategory`, `TicketChannel`, `TicketEventType`). Prisma
supports native `enum` types — **but not on the SQLite connector**
(`the current connector does not support enums`).

## Options

1. Keep native Prisma `enum`s and switch the datasource to Postgres now.
2. Store as `String` and enforce valid values in application code.
3. Store as `Int` with a lookup — needless indirection, worse DX.

## Decision

Store as `String`. Define each value set **once** in
`server/src/types/enums.ts` as a `const` tuple + a derived union type, and enforce
it with **Zod at every edge** (`z.enum(TICKET_STATUSES)` etc.). The frontend
mirrors the same tuples in `web/src/api/types.ts`.

## Consequences

- **+** Works on SQLite today and Postgres later with no schema churn.
- **+** One source of truth; adding a value is a one-line change that the type
  system and every schema pick up.
- **+** Invalid values are rejected at the boundary with `400 VALIDATION_ERROR`,
  not deep in a query.
- **−** The database itself does not constrain the column — the guarantee lives in
  the app. Mitigated by: Zod on every write path, and unit tests over the tuples.
- **−** Two copies of the tuples (server + web) to keep in sync. Small, and the
  follow-up shared package removes it.
