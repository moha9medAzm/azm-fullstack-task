# ADR-0005 — SLA as pure functions + an idempotent background sweep

**Status:** Accepted · 2026-09-01

## Context

SLA behaviour has two halves: **compute** targets and breach state (needed on
every read), and **act** on breaches without a human (flag + auto-escalate).
Time-based logic is a classic source of flaky tests and off-by-one bugs.

## Options

- Compute breach state in SQL on each query — hard to unit-test, dialect-specific.
- Persist a `breached` boolean and keep it current with triggers — drift risk.
- Store the due dates; **derive** breach state in pure TS at read time; run a
  separate job for the "act" half.

## Decision

- `lib/sla.ts` is pure: `computeSlaDueDates(priority, anchor)`,
  `recomputeSlaOnPriorityChange(...)`, `isResponseBreached(now, ...)`,
  `isResolutionBreached(now, ...)`, `deriveSlaFields(now, ticket)`,
  `bumpPriority`. `now` is always a parameter.
- Only the due-date timestamps are stored. Breach flags are computed per request
  by `attachDerived()`.
- `jobs/slaSweep.ts` exports `runSlaSweep({ now, client })` — also pure over its
  inputs. `startSlaSweep()` wraps it in `setInterval` (`SLA_SWEEP_MS`), and
  `POST /api/admin/run-sla-sweep` runs it on demand.

**Idempotency:** a response breach is only flagged if no `SLA_RESPONSE_BREACHED`
event exists yet; a resolution breach only matches `isEscalated == false`, and
escalating pushes the due date out — so a second run on the same clock is a no-op.

## Consequences

- **+** Every SLA rule is unit-tested with a frozen clock, including the exact
  boundary. The sweep is integration-tested for "run twice → no duplicates".
- **+** No stored derived state to drift; no DB triggers.
- **+** Safe to call the sweep repeatedly (cron, retries, manual) — proven.
- **−** Breach state is recomputed on every read. Negligible (arithmetic on a few
  timestamps); indexed `slaResolutionDueAt` keeps the sweep's query cheap.
- **−** In-process interval doesn't fan out across instances. Documented as
  [AS-3](../07-assumptions-and-scope.md); move to an external runner + lock for
  multi-instance.
