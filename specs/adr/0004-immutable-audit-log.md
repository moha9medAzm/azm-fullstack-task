# ADR-0004 — Immutable `TicketEvent` audit log

**Status:** Accepted · 2026-09-01

## Context

The brief calls for **ticket history** and **interaction history**. Support teams
need to answer "who changed this, to what, and when" — including SLA breaches and
reopens — after the fact.

## Options

1. **Derive history from `updatedAt` + diffs** — no real trail; can't show
   intermediate states or who acted.
2. **A generic changelog table** written by a Prisma middleware/hook — implicit,
   easy to get wrong, hard to give good `note` text.
3. **An explicit `TicketEvent` row written by the service** at each mutation.

## Decision

Option 3. `TicketEvent { ticketId, actorId?, type, field?, fromValue?, toValue?,
note?, createdAt }`. Written explicitly in the ticket service for every mutating
path: `CREATED`, `UPDATED`, `STATUS_CHANGED`, `PRIORITY_CHANGED`, `ASSIGNED`,
`UNASSIGNED`, `ESCALATED`, `COMMENTED`, `REOPENED`, `SLA_RESPONSE_BREACHED`,
`SLA_RESOLUTION_BREACHED`. **No update or delete path exists** for events.

## Consequences

- **+** Complete, ordered, attributable trail; drives the UI activity timeline and
  the sweep's idempotency ("has this ticket already got a `SLA_*_BREACHED`
  event?").
- **+** Tests assert on events, which makes "did the rule fire?" explicit.
- **−** Write amplification: a multi-field PATCH writes several rows in the
  transaction. Fine at this scale; batched via `createMany`.
- **−** The service must remember to log. Mitigated by colocating the write with
  the mutation and asserting it in integration tests.
