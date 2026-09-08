# Story intake

## Feature

- **Feature name (display):** Platform foundation
- **Feature slug (folder under `plans/`):** `platform-foundation`

## Tracker (metadata only)

- **Tracker type:** `none`
- **Work item id:** `AREA-12`

---

## Title

```
Platform foundation: i18n (Arabic/English + RTL), multi-department & multi-branch, custom branding, responsive/mobile
```

---

## Description

```
This is the foundational story for evolving the existing 5-area Customer Support CRM MVP
into a full 12-area product. It establishes the cross-cutting platform capabilities that
every later feature depends on. Do this story FIRST.

CURRENT STATE (branch v2-full-scope, forked from a working MVP):
- server/  Express + TypeScript + Prisma + SQLite. Modules: auth, users, customers,
  tickets, dashboard, admin. JWT auth, RBAC (ADMIN/AGENT), Zod validation on every
  route, a central error envelope { error: { code, message, details? } }, an immutable
  TicketEvent audit log, a background SLA sweep. 76 passing tests (Vitest + Supertest).
- web/  React + Vite + TypeScript. TanStack Query for server state, React Hook Form + Zod
  for forms, React Router. Hand-written CSS (CSS variables, no UI framework). 6 tests.
- Enums are stored as validated String columns (SQLite has no enum type); the source of
  truth is server/src/types/enums.ts, mirrored in web/src/api/types.ts.
- Full existing spec: specs/01-requirements.md, specs/02-design.md, specs/adr/.

WHAT THIS STORY ADDS:

1. Multi-branch & multi-department data model + scoping
   - New entities: Branch (id, name, code, isActive, timestamps) and
     Department (id, name, branchId, isActive, timestamps).
   - User gains branchId (required) and departmentId (nullable).
   - Ticket gains branchId (required, defaults from the creating agent's branch) and
     departmentId (nullable, used for routing/assignment later).
   - Customer stays global (a customer can raise tickets against any branch).
   - A request-scoped "scope" derived from req.user: ADMIN sees all branches;
     a non-admin is limited to their own branch's tickets/users/reports unless a
     future "cross-branch" permission is granted. Enforce in the service layer
     (add a scoping helper), not ad hoc per query.
   - Seed: 2 branches, 3-4 departments, users spread across them.
   - Admin CRUD screens for branches and departments.

2. Internationalization: Arabic + English, with RTL
   - Backend: an Accept-Language / ?lang aware layer is NOT required for data, but
     all user-facing server strings (error messages) must come from a small i18n
     catalog keyed by code, with en + ar. The error envelope stays code-first so the
     client can translate too.
   - Frontend: react-i18next (or a minimal equivalent) with en + ar JSON catalogs,
     a language switcher in the header, persistence in localStorage, and
     <html dir="rtl"> + a mirrored layout when Arabic is active. Every existing
     screen's visible text moves into the catalog. Dates/numbers localized.
   - Acceptance: switching to Arabic flips the whole app to RTL with translated
     labels and no layout breakage on the main screens.

3. Custom branding (per workspace / per branch)
   - A Branding record: workspace name, logo (URL or uploaded asset), primary color,
     accent color. Admin screen to edit it. Frontend reads it at startup and applies
     the colors as CSS variables and shows the logo/name in the header and on the
     login page. If per-branch branding is set, it overrides the workspace default
     for users in that branch.

4. Responsive / mobile-friendly
   - Audit the existing screens; make the layout (header nav, tables, ticket detail
     two-column) collapse cleanly to a single column under ~640px. Tables scroll
     horizontally inside their own container; the body never scrolls sideways.
   - No native mobile app — "mobile friendly" = responsive web.

CONSTRAINTS / CONVENTIONS TO KEEP:
- Keep the module = routes + service + schemas pattern.
- Keep enums as validated strings in server/src/types/enums.ts (+ web mirror).
- Every new endpoint: Zod validation, RBAC via authorize(), the standard error envelope.
- Every schema change is a Prisma migration, committed.
- Unit-test pure logic (the scoping helper, the i18n key resolver); integration-test
  new endpoints with Supertest against a fresh temp SQLite DB.
- Update specs/ (requirements + design + traceability) for what this story adds.
- SQLite stays the dev DB; design so a Postgres swap needs no app-code change.
