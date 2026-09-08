# `specs/` — Spec-Driven Development package

This folder is the **specification and planning record** for the Customer Support
CRM MVP. It was written **before** implementation and kept in sync with the code.
It is the single source of truth for _what_ was built, _why_, and _how it was
verified_.

## How to read this folder

| File | Purpose | Maps to rubric row |
|------|---------|--------------------|
| [00-context.md](00-context.md) | Problem statement, the product brief and which of its 12 areas are in this MVP, glossary | Requirement & Specification |
| [01-requirements.md](01-requirements.md) | Personas, user stories, and **EARS-style acceptance criteria** with stable IDs (`REQ-*`) | Requirement & Specification |
| [02-design.md](02-design.md) | Architecture, module map, data model, full API contract, key sequence flows | Engineering Foundations · Backend/API/DB · Frontend |
| [03-task-plan.md](03-task-plan.md) | Phased task breakdown — each task with status and the commit that delivered it | Planning & Task Breakdown |
| [04-acceptance-criteria.md](04-acceptance-criteria.md) | Testable checklist, every item linked to the automated test that proves it | Testing, Security & Edge Cases |
| [05-traceability-matrix.md](05-traceability-matrix.md) | `REQ-*` → backend file → frontend file → test → status. Proves nothing is missing on either side | Correctness · Ownership |
| [06-ai-usage-and-verification.md](06-ai-usage-and-verification.md) | How AI was prompted, how output was reviewed, what was corrected, safe-usage practices | AI Usage & Verification |
| [07-assumptions-and-scope.md](07-assumptions-and-scope.md) | In/out of scope, every assumption made, and the decision log | Requirement & Specification · Ownership |
| [08-walkthrough.md](08-walkthrough.md) | Guided tour of every component (backend + frontend), the process, the domain rules, and a presentation script | orientation / all rows |
| [adr/](adr/) | Architecture Decision Records — one per significant technical choice, with alternatives considered | Technical Understanding & Ownership |

## The process that produced this

1. **Read the brief** (`azm_squad_customer_support_crm.pdf`) — 12 feature areas.
2. **Scoped** to a coherent, fully working core (5 areas) rather than 12 shallow
   ones — see [07-assumptions-and-scope.md](07-assumptions-and-scope.md).
3. **Wrote [01-requirements.md](01-requirements.md) and [02-design.md](02-design.md)**
   with acceptance criteria — before any code.
4. **Broke the work into 7 phases / ~35 tasks** — [03-task-plan.md](03-task-plan.md).
5. **Implemented phase by phase**, each ending with `tsc --noEmit` + full test
   suite green + a descriptive commit.
6. **Verified** against [04-acceptance-criteria.md](04-acceptance-criteria.md) and
   drove the running app end-to-end in a browser.
7. **Kept the specs updated** whenever an implementation detail changed the
   contract (e.g. the `GET /users` visibility rule, the `unassigned` filter, the
   `UPDATED` audit event type).

## Status

All requirements in [01-requirements.md](01-requirements.md) are **implemented and
tested** — see [05-traceability-matrix.md](05-traceability-matrix.md). Test totals:
**76 backend** (unit + integration) + **6 frontend** (React Testing Library), all
green; `npm run typecheck` and `npm run build` clean.
