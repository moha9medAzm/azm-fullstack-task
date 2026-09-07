# Architecture Decision Records

One record per significant technical decision: the context, the options
considered, the choice, and its consequences. Format is a trimmed
[MADR](https://adr.github.io/madr/).

| # | Decision | Status |
|---|----------|--------|
| [0001](0001-stack-and-database.md) | Node + Express + Prisma + SQLite; React + Vite | Accepted |
| [0002](0002-enums-as-validated-strings.md) | Model enums as validated `String` columns | Accepted |
| [0003](0003-thin-routes-service-layer.md) | Thin routes; a service layer owns business rules | Accepted |
| [0004](0004-immutable-audit-log.md) | Immutable `TicketEvent` audit log | Accepted |
| [0005](0005-sla-pure-functions-and-sweep.md) | SLA as pure functions + an idempotent background sweep | Accepted |
| [0006](0006-auth-jwt-and-server-side-rbac.md) | JWT + bcrypt + server-side RBAC on every route | Accepted |
