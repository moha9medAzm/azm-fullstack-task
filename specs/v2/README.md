# `specs/v2/` — Full 12-area rebuild

The plan to grow the working 5-area MVP (`main`) into the **complete 12-area
product** from the brief, on branch **`v2-full-scope`**, using the
[Squad-Kit](https://github.com/AzmSquad/Squad-Kit) SDD workflow.

| File | What |
|------|------|
| [00-overview.md](00-overview.md) | Scope (what "all 12" means here), architecture evolution, the **12-story roadmap** with dependency order, Squad-Kit usage notes |
| [01-requirements.md](01-requirements.md) | EARS requirements for all 12 areas (`REQ-PLAT-*`, `REQ-PERM-*`, `REQ-CHAN-*`, `REQ-AI-*`, …), continuing v1's `REQ-*` scheme |
| [02-design.md](02-design.md) | New entities, the provider **ports** (channel/ai/erp/notify), the `scopeWhere` helper, i18n mechanics, the full new-endpoint map, migration posture |
| [adr/](adr/) | 4 v2 decision records (branch scoping, permissions, provider ports, i18n/RTL) |
| [demos/](demos/) | One demo script per area, added as each story ships |

v1 docs still describe what's already built:
[specs/01-requirements.md](../01-requirements.md), [specs/02-design.md](../02-design.md),
[specs/adr/](../adr/), [specs/08-walkthrough.md](../08-walkthrough.md).

## Squad-Kit workspace

- `.squad/config.yaml` — planner: anthropic, agent: claude-code.
- `.squad/stories/<slug>/…/intake.md` — **12 intakes, all filled** (one per area),
  each pointing at `specs/v2/` for the contract.
- `.squad/plans/<slug>/NN-story-<slug>.md` — plan files, authored **just before** each
  story is implemented. **Story 01 (`platform-foundation`) is fully planned** →
  [`.squad/plans/platform-foundation/01-story-platform-foundation.md`](../../.squad/plans/platform-foundation/01-story-platform-foundation.md).
- `squad new-plan --api` doesn't run in this environment (Node 18.13 vs the Claude
  Agent SDK). Plans are produced in Squad-Kit's **copy-paste mode** and authored to
  its bundled `generate-plan.md` spec (Prerequisites → Story Goal → Context → Backend/
  Frontend Tasks → Edge Cases → Test Plan → Migration/Rollback → Verification → Done
  Criteria).

## Status

- ✅ Re-plan complete: `specs/v2/` + 12 Squad-Kit intakes + Story 01 plan.
- ⬜ Implementation: incremental, one story at a time, each ending green + committed
  + the app still running. Next: **Story 01 — platform-foundation**.
