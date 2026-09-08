# Story 01 — Platform foundation: multi-branch/department, i18n (AR/EN + RTL), branding, responsive

## Prerequisites

- None (first story of the v2 build). Branch: `v2-full-scope`, forked from `main` at
  the working 5-area MVP.
- Read `specs/v2/00-overview.md`, `specs/v2/01-requirements.md` (§Area 12,
  `REQ-PLAT-1..11`), `specs/v2/02-design.md` (§1, §2 Platform, §4 scoping, §5 i18n).
- No sibling plans exist yet; follow the tone of `specs/03-task-plan.md` and the v1
  ADRs for structure.

---

## Story Goal

Make the app **branch-aware, bilingual (English + Arabic with RTL), brandable, and
responsive** — the cross-cutting foundation every later v2 story depends on.

User-visible outcomes:

1. Admin can create **branches** and **departments**; every user belongs to a branch
   (and optionally a department); every ticket carries a branch.
2. A non-admin agent only sees **their own branch's** tickets and users; an admin sees
   all branches.
3. A **language switcher** flips the whole app between English and Arabic; Arabic
   renders **right-to-left** with translated labels and no broken layout on Login,
   Dashboard, Tickets list, Ticket detail.
4. An admin can set **workspace branding** (name, logo, primary/accent color); the
   header and login page reflect it; a branch can override it.
5. The main screens are usable on a **375px-wide** phone viewport.

**Not in scope:** the permissions layer (Story 02 — keep `authorize(role)` here, but
introduce `req.scope`), any per-department routing/assignment (Story 06), uploaded
logo files (Story 03 attachments — accept a `logoUrl` string for now).

---

## Context — Read These Files First

1. `server/prisma/schema.prisma` — models at `model User` (~line 23, `role String
   @default("AGENT")` line 28), `model Customer` (~39), `model Ticket` (~54),
   `model TicketEvent` (~106). Add `Branch`, `Department`, `Branding`; add `branchId`
   / `departmentId` to `User` and `Ticket`.
2. `server/src/types/enums.ts` — `ROLES = ['ADMIN','AGENT'] as const` (line 8),
   `type Role` (line 9). Add `SUPERVISOR` to `ROLES`; add `VIP_LEVELS` later (Story 03,
   not here). No `CUSTOMER` yet (Story 09).
3. `server/src/middleware/authorize.ts` — `canAccess(userRole, allowed)` (line 9),
   `authorize(...allowed)` (line 14), `req.user.role` (line 20). **Do not remove**;
   add the new `resolveScope` middleware alongside.
4. `server/src/types/express.d.ts` — `interface Request` (line 5), `user?` (line 13).
   Add `scope?: Scope`.
5. `server/src/app.ts` — middleware order: `helmet()` (17), `cors()` (18),
   `express.json` (24), `morgan` (27), `app.use('/api', apiRouter)` (34),
   `notFoundHandler` (36), `errorHandler` (37). Insert `acceptLanguage` parsing
   before the router; `resolveScope` is mounted per-router (after `authenticate`),
   not globally.
6. `server/src/middleware/authenticate.ts` — sets `req.user = { id, email, role }`.
   `resolveScope` runs right after it and needs the DB.
7. `server/src/middleware/errorHandler.ts` — the central handler that builds
   `{ error: { code, message, details? } }`. Change it to resolve `message` through
   the i18n catalog by `code` + `req.language`.
8. `server/src/lib/errors.ts` — `AppError` subclasses carry `code`. Keep `message` as
   the English default / fallback.
9. `server/src/modules/*/*.routes.ts` and `*.service.ts` — every list/read service
   (`tickets.service.ts` `listTickets` / `getTicketFull`, `customers` list/get,
   `users` list, `dashboard.service.ts`). Wrap their Prisma `where` with `scopeWhere`.
10. `server/prisma/seed.ts` — `prisma.user.create` calls at lines 21/29/37 with
    `role: 'ADMIN'|'AGENT'`. Add branch/department creation first; give every user a
    `branchId`; give every ticket a `branchId`.
11. `server/tests/helpers/app.ts` (`createApp`, line 8; `makeUser`, `makeCustomer`
    factories), `server/tests/helpers/db.ts` (`resetDb`, line 4),
    `server/tests/helpers/globalSetup.ts` (`prisma migrate deploy`, line 18). New
    factories need a branch; `resetDb` must also clear the new tables.
12. `web/src/App.tsx` — routes at lines 27–39; `ProtectedRoute`, `Layout`. Wrap the
    tree in an `<I18nProvider>` and a `<BrandingProvider>`. Add `/admin/branches`,
    `/admin/departments`, `/admin/branding` (ADMIN).
13. `web/src/components/Layout.tsx` — `NavLink`s at lines 13–18,
    `user?.role === 'ADMIN'` gate (line 18). Add `<LangSwitcher>` and the branding
    logo/name; add the new admin links.
14. `web/src/styles.css` — the hand-written stylesheet. Convert directional
    properties (`margin-left`, `padding-right`, `left`, `text-align: left`) to logical
    (`margin-inline-start`, `padding-inline-end`, `inset-inline-start`,
    `text-align: start`); add the `@media (max-width: 640px)` collapses; add
    `:root` color vars driven by branding.
15. `web/src/api/client.ts` — the `fetch` wrapper. Add an `Accept-Language` header
    from the stored language. `web/src/api/types.ts` — mirror the new enums/types.
16. Grep `grep -rn "authorize(" server/src/modules` — every current call site, so the
    `resolveScope` insertion is complete.
17. Grep `grep -rn ">[A-Z][a-z].*<" web/src/pages web/src/components` — bare visible
    strings on the screens to move into the catalog.

---

## Product rules (from story)

| Concern | Current (v1) | New (this story) |
|---|---|---|
| Tenancy | single implicit workspace | `Branch` + `Department`; user & ticket carry `branchId` |
| Visibility | every agent sees every ticket | non-admin sees own branch only; admin sees all |
| Language | English only, hard-coded strings | EN + AR catalog; switcher; RTL for AR |
| Error messages | English string on `AppError` | resolved from `messages/{en,ar}` by `code` + `Accept-Language`, `code` unchanged |
| Theming | fixed CSS `:root` palette | `Branding` row → CSS variables at runtime; per-branch override |
| Layout | desktop two-column | collapses to one column < 640px; tables scroll in-container |

---

## Backend Tasks

### 1 — Schema: Branch, Department, Branding; branch on User/Ticket

**File: `server/prisma/schema.prisma`**

Add:

```prisma
model Branch {
  id        String   @id @default(cuid())
  name      String
  code      String   @unique
  isActive  Boolean  @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  departments Department[]
  users       User[]
  tickets     Ticket[]
  branding    Branding?
}

model Department {
  id        String   @id @default(cuid())
  name      String
  branchId  String
  branch    Branch   @relation(fields: [branchId], references: [id], onDelete: Cascade)
  isActive  Boolean  @default(true)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  users     User[]
  tickets   Ticket[]
  @@unique([branchId, name])
}

model Branding {
  id           String  @id @default(cuid())
  scope        String  @unique          // "workspace" or a branchId
  name         String
  logoUrl      String?
  primaryColor String  @default("#3355dd")
  accentColor  String  @default("#1a7f4b")
  branchId     String? @unique
  branch       Branch? @relation(fields: [branchId], references: [id], onDelete: Cascade)
  updatedAt    DateTime @updatedAt
}
```

On **`model User`** add:

```prisma
  branchId     String?
  branch       Branch?     @relation(fields: [branchId], references: [id])
  departmentId String?
  department   Department? @relation(fields: [departmentId], references: [id])
  @@index([branchId])
```

`branchId` is modelled **nullable in the column** (safe migration) but treated as
**required by the API** after backfill — the create-user schema requires it and a
runtime invariant check rejects a null on write paths.

On **`model Ticket`** add the same `branchId?` + `branch` relation + `departmentId?`
+ `department` relation + `@@index([branchId])`.

Add to **`TicketEventType`** doc comment / `server/src/types/enums.ts`
`TICKET_EVENT_TYPES`: no new value needed here (branch is set at create; if an admin
moves a ticket's branch later, reuse `UPDATED` with `field: "branchId"`).

**Migration:** `npx prisma migrate dev --name 01_platform_foundation`. In the same
migration directory add a data step, or create
`server/prisma/backfills/01_hq_branch.ts`:

```ts
// create an "HQ" branch + "General" department, assign every existing user & ticket
```

Wire the backfill into `db:reset` (run after `migrate reset`, before `seed`) and
document it in `RUNNING.md`.

### 2 — enums + scope type

**File: `server/src/types/enums.ts`** — `ROLES = ['ADMIN', 'SUPERVISOR', 'AGENT'] as const;`
(add `SUPERVISOR`). Export nothing else here yet.

**Create file: `server/src/lib/scope.ts`** (pure, per `specs/v2/02-design.md` §4):

```ts
import type { Role } from '../types/enums';
import { NotFoundError } from './errors';

export type Scope = {
  userId: string;
  role: Role;
  branchId: string;
  seeAllBranches: boolean;
};

/** Narrow a Prisma `where` to the caller's branch unless they may see all. */
export function scopeWhere<T extends Record<string, unknown>>(scope: Scope, base: T): T {
  if (scope.seeAllBranches) return base;
  return { ...base, branchId: scope.branchId };
}

/** Guard a single loaded entity; 404 (not 403) to avoid leaking existence. */
export function assertInScope(scope: Scope, entityBranchId: string | null | undefined): void {
  if (scope.seeAllBranches) return;
  if (entityBranchId !== scope.branchId) throw new NotFoundError('Resource');
}

export function seeAllBranches(role: Role): boolean {
  return role === 'ADMIN'; // Story 02 will also honour a `branch:all` permission
}
```

### 3 — middleware: resolveScope + Accept-Language

**Create file: `server/src/middleware/resolveScope.ts`** — runs after `authenticate`;
loads the user's `branchId`; builds `req.scope`. If the user has no branch (shouldn't
happen post-backfill) → `500` with code `USER_WITHOUT_BRANCH` logged.

**File: `server/src/types/express.d.ts`** — add `scope?: import('../lib/scope').Scope;`
to `interface Request`.

**File: `server/src/app.ts`** — before `app.use('/api', apiRouter)` add a tiny
`app.use((req, _res, next) => { req.language = pickLanguage(req.headers['accept-language']); next(); })`
(`pickLanguage` returns `'ar'` or `'en'`, default `'en'`). Mount `resolveScope` inside
each authenticated router (in `*.routes.ts`, after `authenticate`, before the
handlers), **not** globally (public routes have no user).

**File: every `server/src/modules/<x>/<x>.routes.ts`** that currently does
`router.use(authenticate, authorize(...))` → `router.use(authenticate, resolveScope, authorize(...))`.

### 4 — i18n message catalog (server)

**Create files:**
- `server/src/messages/en.ts` — `export const en = { VALIDATION_ERROR: 'Request validation failed', UNAUTHENTICATED: 'Authentication required', FORBIDDEN: 'You do not have permission to perform this action', NOT_FOUND: '{resource} not found', INVALID_TRANSITION: 'Cannot move a ticket from {from} to {to}', CUSTOMER_HAS_OPEN_TICKETS: '…', /* every code currently thrown */ } as const;`
- `server/src/messages/ar.ts` — the same keys, Arabic values.
- `server/src/messages/index.ts` — `t(code, lang, vars?)`: look up `catalog[lang][code]`
  → fall back to `en[code]` → fall back to `code`; interpolate `{var}` from `vars`.
  Unit-tested.

**File: `server/src/middleware/errorHandler.ts`** — where it builds the body, set
`message: t(err.code, req.language ?? 'en', err.messageVars)`. Keep `err.message` as
the dev/log string. `AppError` gains an optional `messageVars?: Record<string,string>`
so `NotFoundError('Ticket')` passes `{ resource: 'Ticket' }`.

### 5 — modules: branches, departments, branding

For each, the standard `routes + service + schemas` trio under
`server/src/modules/`:

**`branches`** — `GET /api/branches` (list; admin sees all, others see only their own,
via `scopeWhere`), `POST /api/branches` (ADMIN; `code` unique → `409 BRANCH_CODE_TAKEN`),
`PATCH /api/branches/:id` (ADMIN; name/isActive).

**`departments`** — `GET /api/departments?branchId=`, `POST` (ADMIN),
`PATCH /:id` (ADMIN). `@@unique([branchId, name])` → `409 DEPARTMENT_NAME_TAKEN`.

**`branding`** — `GET /api/branding` (any authenticated user; returns the caller's
branch override merged over the `workspace` row), `PATCH /api/branding` (ADMIN;
`?scope=workspace` default, or `?scope=<branchId>`). Validate colors as hex.

Register all three in `server/src/routes.ts`.

### 6 — thread branchId through existing modules

- **`tickets.service.ts`** `createTicket`: set `branchId` from `actor`'s branch (look
  it up or carry it on `req.scope`); allow an admin to pass `branchId` in the body.
  `listTickets` / `getTicketFull` / `getTicketEvents`: wrap `where` with
  `scopeWhere(scope, …)`; `updateTicket` / `assignTicket` / `escalateTicket` /
  `addComment`: `assertInScope(scope, existing.branchId)` after the `getOr404` load.
  The `assignTicket` active-user check also gets `assertInScope` on the assignee's
  branch unless admin.
- **`customers`**: customers stay global (no `branchId`), but the customer-detail
  ticket list is scoped.
- **`users` service**: `GET /users` list wrapped with `scopeWhere`; `POST /users`
  requires `branchId` (validate it exists); a non-admin creating a user (Story 02
  will gate this properly) is out of scope here.
- **`dashboard.service.ts`**: every `prisma.ticket.count/groupBy` gets the scope
  `where` merged in, so a branch agent's dashboard counts only their branch.

### 7 — seed

**File: `server/prisma/seed.ts`** — before creating users: create 2 branches
(`HQ` / `BR2`) and 3 departments (`Support`, `Billing` under HQ; `Support` under BR2);
create a `workspace` `Branding` row. Give the 3 existing users branches (admin → HQ,
alice → HQ/Support, bilal → BR2/Support). Give each of the 25 tickets a `branchId`
matching its creator. Add ~10 more tickets on BR2 so scoping is visibly non-trivial.
Add a `SUPERVISOR` user on BR2. Keep the printed credentials block; add the new ones.

---

## Frontend Tasks

### 1 — i18n runtime

Add deps: `react-i18next`, `i18next`.

**Create files:**
- `web/src/locales/en.json`, `web/src/locales/ar.json` — every visible string on
  Login, Layout/nav, Dashboard, Tickets list, Ticket detail, Customers list/detail,
  Admin users, plus the new admin screens. Keys namespaced (`nav.tickets`,
  `ticket.status.OPEN`, `login.submit`, …).
- `web/src/i18n.ts` — `i18next.init({ resources, lng: stored ?? 'en', fallbackLng: 'en' })`.
- `web/src/i18n/LangSwitcher.tsx` — a two-button/`<select>` toggle; on change:
  `i18n.changeLanguage(lng)`, `document.documentElement.setAttribute('dir', lng === 'ar' ? 'rtl' : 'ltr')`,
  `document.documentElement.setAttribute('lang', lng)`, `localStorage.setItem('crm.lang', lng)`.

**File: `web/src/main.tsx`** — `import './i18n'` before `<App/>`; set the initial
`dir`/`lang` from `localStorage` synchronously.

**File: `web/src/App.tsx`** — no provider needed for `react-i18next` v13+ beyond the
import, but wrap in `<BrandingProvider>` (below). Add routes:
`/admin/branches`, `/admin/departments`, `/admin/branding` inside the
`roles={['ADMIN']}` block.

**Every touched page/component** — replace literal strings with `const { t } = useTranslation();` … `t('key')`. Dates via `Intl.DateTimeFormat(i18n.language)`;
keep `date-fns` `format` but pass the locale.

### 2 — branding runtime

**Create file: `web/src/branding/BrandingProvider.tsx`** — on mount (and after login)
`GET /api/branding`; on success set CSS variables on `document.documentElement`
(`--primary`, `--accent`) and expose `{ name, logoUrl }` via context; on failure keep
the defaults already in `styles.css`. A `useBranding()` hook.

**File: `web/src/components/Layout.tsx`** — show `logoUrl` (or the name) from
`useBranding()`; add `<LangSwitcher/>`; add the three admin `NavLink`s under the
existing `user?.role === 'ADMIN'` gate; wrap link labels in `t(...)`.

**File: `web/src/pages/LoginPage.tsx`** — show the branding name/logo; the seeded-
accounts hint stays but its label goes through `t`.

### 3 — new admin screens

`web/src/pages/AdminBranchesPage.tsx`, `AdminDepartmentsPage.tsx`,
`AdminBrandingPage.tsx` — same shape as `AdminUsersPage.tsx` (table + inline form,
TanStack Query hooks in `web/src/api/hooks.ts`: `useBranches`, `useCreateBranch`,
`useUpdateBranch`, `useDepartments…`, `useBranding`, `useUpdateBranding`).
`web/src/api/types.ts` — add `Branch`, `Department`, `Branding`, extend `User`,
`Ticket` with `branchId`/`departmentId`; add `'SUPERVISOR'` to `ROLES`.

### 4 — CSS: logical properties + responsive

**File: `web/src/styles.css`** —
- swap directional props for logical ones (see Context #14);
- `--primary` / `--accent` stay as defaults but are overridden at runtime by
  `BrandingProvider`;
- add `@media (max-width: 640px)`: `.app-header-inner` wraps; `.app-nav` becomes a
  horizontal scroll row; `.ticket-layout` / `.two-col` / `.field-row` become one
  column; `.data-table` already sits in `.table-wrap { overflow-x: auto }` — verify
  every table does;
- `[dir='rtl']` overrides only where a logical property can't express it (e.g. an
  icon that must not flip).

### 5 — client Accept-Language

**File: `web/src/api/client.ts`** — add
`headers['Accept-Language'] = localStorage.getItem('crm.lang') ?? 'en'` so API error
messages come back translated.

---

## Edge Cases & Failure Modes

- **User with no branch after migration** — backfill assigns `HQ`; `resolveScope`
  still guards: null branch → `500 USER_WITHOUT_BRANCH`, logged, so it's caught in
  staging not prod. Enforced in `server/src/middleware/resolveScope.ts`.
- **Agent requests a ticket in another branch** — `assertInScope` throws
  `NotFoundError` → `404`, **not** `403` (no existence leak). Enforced in each ticket
  write path in `tickets.service.ts` and in `getTicketFull`.
- **Admin creates a ticket for another branch** — allowed; `createTicket` accepts
  `branchId` in the body only when `scope.seeAllBranches`. Else the body value is
  ignored and the agent's branch is used.
- **Branch `code` collision / Department name collision** — Prisma `P2002` →
  `409 BRANCH_CODE_TAKEN` / `DEPARTMENT_NAME_TAKEN` via the existing `errorHandler`
  Prisma mapping (`server/src/middleware/errorHandler.ts`).
- **Deactivating a branch that has active users/tickets** — allowed (soft flag); the
  branch just stops appearing in create-pickers. Document; do not cascade.
- **Missing i18n key** — `t()` returns the raw `code`/key (visible, not a crash);
  server `t()` falls back `ar → en → code`. Unit-tested in
  `server/tests/unit/messages.test.ts`.
- **`Accept-Language` with quality values / unknown locale** (`fr-FR,fr;q=0.9`) —
  `pickLanguage` returns `'en'` unless `ar` appears. Unit-tested.
- **Branding fetch fails / returns 500** — `BrandingProvider` keeps the CSS defaults;
  the app renders. No error toast (it's cosmetic).
- **RTL layout regressions** — the four core screens are the acceptance gate; other
  screens are best-effort this story and tracked as follow-ups in a comment.
- **`scopeWhere` used on a model without `branchId`** (e.g. `Customer`) — never call
  it there; customers are global by design. Reviewer check.
- **Concurrent branch create with same code** — DB unique constraint is the backstop;
  the `409` mapping covers the race.

---

## Test Plan

Unit (Vitest, `server/tests/unit/`):

1. **`scope.test.ts`** — `scopeWhere`: admin (`seeAllBranches`) returns `base`
   unchanged; branch agent gets `branchId` injected; `assertInScope` throws
   `NotFoundError` for a foreign branch and passes for own / admin. `seeAllBranches`
   truth table.
2. **`messages.test.ts`** — `t('NOT_FOUND','ar',{resource:'Ticket'})` → Arabic with
   interpolation; `t('X','ar')` missing → English; `t('Y','en')` missing → `'Y'`;
   `pickLanguage('ar,en;q=0.9')` → `'ar'`, `pickLanguage('fr')` → `'en'`.

Integration (Vitest + Supertest, `server/tests/integration/`, fresh temp SQLite):

3. **`branches.test.ts`** — admin creates a branch (201); duplicate `code` → 409
   `BRANCH_CODE_TAKEN`; agent `POST /branches` → 403; agent `GET /branches` returns
   only their branch, admin returns all.
4. **`departments.test.ts`** — create under a branch; `@@unique` → 409; list filtered
   by `branchId`.
5. **`branding.test.ts`** — `GET /branding` returns the workspace row merged with a
   branch override; `PATCH` as admin updates; bad hex color → 400; agent `PATCH` → 403.
6. **`scoping.integration.test.ts`** — seed 2 branches; an agent in Branch A:
   `GET /tickets` excludes Branch B tickets; `GET /tickets/:idFromB` → 404;
   `PATCH /tickets/:idFromB` → 404; `GET /dashboard/stats` counts only Branch A;
   admin sees both.
7. **`tickets.test.ts` (extend)** — `createTicket` sets `branchId` from the actor;
   admin can override via body; non-admin body `branchId` is ignored.
8. **`errorHandler` i18n** — a request with `Accept-Language: ar` that 404s returns
   the Arabic `message`, `code` still `NOT_FOUND`.
9. Update `server/tests/helpers/app.ts` `makeUser`/`makeCustomer` to create/attach a
   branch (default: a shared test `HQ` branch created once per file); update
   `server/tests/helpers/db.ts` `resetDb` to also `deleteMany` `branding`,
   `department`, `branch` (in FK-safe order — branch last).

Frontend (Vitest + Testing Library, `web/src/`):

10. **`LangSwitcher.test.tsx`** — clicking "العربية" sets `document.documentElement.dir`
    to `rtl`, persists `crm.lang`, and a sample component's `t('nav.tickets')` renders
    the Arabic string.
11. **`BrandingProvider.test.tsx`** — mocked `GET /api/branding` → CSS var
    `--primary` is set on `:root`; a 500 → defaults retained, no throw.
12. **`AdminBranchesPage.test.tsx`** — renders the seeded branches from a mocked API;
    submitting the create form calls `POST /api/branches`.

Regression: the full existing suite (`npm test`, `npm run test:web`) must stay green
after the `authorize` → `authenticate, resolveScope, authorize` change and the
`scopeWhere` wrapping (existing tests seed a single branch, so scoped queries still
return everything for that branch's users / for admin).

---

## Migration / Rollback

- Migration `01_platform_foundation`: **additive**, all new columns nullable / with
  defaults. Backfill (`server/prisma/backfills/01_hq_branch.ts`) creates `HQ` +
  `General` and sets `branchId` on every existing `User` and `Ticket`, and inserts the
  `workspace` `Branding` row.
- **Half-applied state:** if the backfill fails mid-run, users/tickets with a null
  `branchId` hit `resolveScope`'s `USER_WITHOUT_BRANCH` 500 (visible, safe) or
  `createTicket` invariant — nothing silently corrupts. Re-run the idempotent
  backfill (`UPDATE … WHERE branchId IS NULL`).
- **Rollback:** `npx prisma migrate resolve --rolled-back 01_platform_foundation`,
  `git revert` the code commit. New columns being nullable means v1 code runs against
  the migrated DB unchanged (it just ignores `branchId`).
- `main` (v1) remains the fallback throughout.

---

## Verification Steps

1. **Backend builds:** `npm run typecheck` (repo root) — no errors.
2. **Backend tests:** `npm test` — existing 76 + new (~20) green.
3. **DB:** `npm run db:reset` — migration applies, backfill runs, seed prints branch
   assignments; `sqlite3 server/prisma/dev.db "select code,count(*) from Ticket t join Branch b on b.id=t.branchId group by 1"` shows tickets split across `HQ` / `BR2`.
4. **Frontend builds:** `npm run build --workspace web` — clean.
5. **Frontend tests:** `npm run test:web` — existing 6 + new (~4) green.
6. **Lint/format:** `npm run lint && npm run format:check` — clean.
7. **Manual — scoping:** `npm run dev`; log in as `bilal@example.com` (BR2) → the
   Tickets list shows only BR2 tickets; open a BR2 ticket URL as `alice@example.com`
   (HQ) → 404 page. Log in as admin → all branches visible; admin can pick a branch
   in the new-ticket form.
8. **Manual — i18n/RTL:** switch to العربية → the header, nav, Login, Dashboard,
   Tickets list and Ticket detail show Arabic text, the layout mirrors to RTL, dates
   render Arabic-locale, and nothing overflows at 1280px or 375px width. Reload → the
   language sticks.
9. **Manual — branding:** `/admin/branding` → change the primary color and workspace
   name → header + login reflect it after reload; set a BR2 override → a BR2 user sees
   the override, an HQ user sees the workspace default.
10. **Manual — responsive:** DevTools at 375px — Login, Dashboard, Tickets list,
    Ticket detail are single-column, tables scroll inside their card, the page body
    does not scroll sideways.
11. **CI:** push the branch; the `verify` workflow is green.

---

## Done Criteria

- [ ] `Branch`, `Department`, `Branding` models + migration `01_platform_foundation`
      committed; backfill wired into `db:reset`.
- [ ] `ROLES` includes `SUPERVISOR`; `Scope` type + `scopeWhere` / `assertInScope` /
      `seeAllBranches` in `server/src/lib/scope.ts`, unit-tested.
- [ ] `resolveScope` middleware mounted after `authenticate` in every authenticated
      router; `req.scope` typed in `express.d.ts`.
- [ ] `branches`, `departments`, `branding` modules (routes + service + schemas),
      registered in `routes.ts`, RBAC + Zod + standard envelope, integration-tested.
- [ ] `tickets`, `users`, `dashboard` list/read paths scoped via `scopeWhere`; ticket
      write paths guarded via `assertInScope`; `createTicket` sets `branchId`.
- [ ] Server i18n: `messages/{en,ar}.ts` + `t()` + `pickLanguage`; `errorHandler`
      resolves `message` by `code` + `Accept-Language`; `code` unchanged; unit-tested.
- [ ] Seed produces a coherent 2-branch / 3-department dataset incl. a `SUPERVISOR`
      and BR2 tickets; credentials block updated.
- [ ] Frontend: `react-i18next` + `en/ar` catalogs; `LangSwitcher`; `<html dir>` +
      persisted choice; every visible string on the 4 core screens (+ new admin
      screens) via `t()`.
- [ ] `BrandingProvider` applies colors as CSS vars with a safe default fallback;
      Layout + Login show the brand; `/admin/branding` editor works incl. per-branch.
- [ ] `styles.css` uses logical properties; the 4 core screens are usable at 375px;
      tables scroll in-container; body never scrolls horizontally.
- [ ] `client.ts` sends `Accept-Language`.
- [ ] `npm run typecheck`, `npm test`, `npm run test:web`, `npm run build`,
      `npm run lint`, `npm run format:check` all clean; CI green.
- [ ] `specs/v2/01-requirements.md` `REQ-PLAT-1..11` checked; v2 traceability matrix
      row added; `RUNNING.md` updated (backfill step, language switch); a
      `specs/v2/demos/01-platform-foundation.md` demo script added.
- [ ] Commit `feat(platform): multi-branch scoping, i18n AR/EN + RTL, branding, responsive`.

**STOP HERE. Report to the user and wait for confirmation before proceeding to Story 02.**
