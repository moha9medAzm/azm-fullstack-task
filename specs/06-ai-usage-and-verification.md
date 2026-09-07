# 06 — AI usage & verification

How AI was used to build this project, how its output was reviewed, and the
practices that kept it safe. This maps to the rubric row *"Good AI context,
output review, testing and safe usage."*

---

## 1. Working method: spec first, then code

AI was **not** asked to "build a CRM". The sequence was:

1. **Context in:** the product brief PDF + the assessment rubric were given to the
   model as the frame.
2. **Scope decision made by a human:** 12 areas → 5 core areas, with the cut list
   written down ([07-assumptions-and-scope.md](07-assumptions-and-scope.md)).
3. **Spec authored and reviewed** ([01-requirements.md](01-requirements.md),
   [02-design.md](02-design.md)) before implementation — acceptance criteria in
   EARS form so each is testable.
4. **Plan authored** ([03-task-plan.md](03-task-plan.md)) — 7 phases, each ending
   green + committed.
5. **Implementation phase by phase**, with a verification gate after every phase.

The specs are the durable artifact; the code follows them.

---

## 2. How AI output was reviewed (not trusted blindly)

| Technique | What it caught / prevented |
|-----------|----------------------------|
| **Pure functions for all core logic** | SLA math, status transitions, the sweep, and the RBAC decision are pure (`now`/deps passed in). AI-generated logic is checked by deterministic unit tests with a frozen clock — not by reading it and hoping. |
| **Boundary tests written deliberately** | "Exactly at the due instant = not breached; +1 ms = breached" — the kind of off-by-one an LLM gets wrong. Written as an explicit test, not assumed. |
| **Integration tests against a real DB** | Every endpoint is exercised through the real Express router + Prisma + SQLite (Supertest). Catches wrong status codes, missing audit rows, broken filters — things unit tests on mocked data would miss. |
| **`tsc --noEmit` after every phase** | Type errors surface immediately; `noUncheckedIndexedAccess` and `strict` are on. |
| **Run the app for real** | After the frontend phase the whole flow was driven in a headless browser (login → dashboard → tickets → detail → customers → users). A green test suite is not proof the app runs. |
| **Read every generated file** | Especially `seed.ts`, the error handler, and the SLA recompute — the places where a subtle mistake is expensive. |

---

## 3. Corrections made to AI output

Concrete cases where the first attempt was wrong or thin and was fixed:

| Issue | Fix |
|-------|-----|
| Prisma schema used native `enum` blocks | **SQLite has no enum type.** Moved to validated `String` columns with a single source of truth in `src/types/enums.ts` + Zod at every edge ([ADR-0002](adr/0002-enums-as-validated-strings.md)). |
| Ticket filter bar reset pagination even when the `page` param itself changed | `updateParam` guarded: only clear `page` when a *different* filter changes. |
| `GET /users` returned only active users | Broke the admin "reactivate a deactivated user" flow. Changed to: agents see active only, admins see all. Added a test. |
| No `unassigned` ticket filter, but the dashboard needed one | Added `unassigned=true` to the query schema + service + a test, and mirrored it in the web hook. |
| Audit event types didn't cover plain field edits | Added `UPDATED` for subject/description/category/channel changes so *every* mutation is audited. |
| CORS allow-list was a single origin; Vite fell back to `:5174` when `:5173` was taken | Documented in `RUNNING.md` §10; `CORS_ORIGIN` accepts a comma-separated list. |

---

## 4. Safe-usage practices

- **No secrets committed.** `.env` is git-ignored; only `.env.example` with dummy
  values is tracked (`git ls-files | grep .env` → only the examples).
- **No credential/PII in prompts.** Seed data is fictional (`grace@compugroup.example`).
- **Deterministic, offline tests.** Tests spin up their own temporary SQLite DB;
  no external services, no network, no time-of-day flakiness (clock is injected).
- **Reproducible from zero.** `npm install && npm run db:reset && npm run dev` —
  documented and verified.
- **Dependencies pinned** with a committed `package-lock.json`; the surface is
  small and each dependency has a clear reason ([02-design.md](02-design.md)).
- **CI re-runs everything** on every push (`.github/workflows/ci.yml`) so a
  regression can't hide behind a stale local pass.

---

## 5. What a reviewer can check quickly

```bash
git log --oneline                 # incremental, message-per-phase history
npm run typecheck && npm test && npm run test:web && npm run build
cat specs/05-traceability-matrix.md   # every requirement → code → test
```

Each phase commit is self-contained and green; the traceability matrix shows
nothing is missing on the frontend or the backend.
