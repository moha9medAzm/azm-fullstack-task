# Customer Support CRM — MVP

A working slice of the Customer Support CRM: the **core support loop** (customers →
tickets → assignment → SLA → resolution) built end-to-end with auth, RBAC,
validation, an immutable audit log, background SLA automation, tests, and a React
agent console.

> Scope, assumptions, and the full API contract live in **[SPEC.md](SPEC.md)**.
> Architecture and the task-by-task build plan live in **[PLAN.md](PLAN.md)**.

_README is filled in during Phase 6 (setup, scripts, seeded credentials,
architecture, testing, out-of-scope). This is the scaffold placeholder._

## Quick start (once implemented)

```bash
npm install
cp server/.env.example server/.env
cp web/.env.example web/.env
npm run db:reset      # migrate + seed
npm run dev           # API on :4000, web on :5173
```
