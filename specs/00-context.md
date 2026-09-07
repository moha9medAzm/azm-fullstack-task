# 00 — Context

## Problem statement

A support organisation needs one place for agents to manage customer issues:
capture the customer, log a ticket, categorise and prioritise it, assign it to an
agent, track it through a status lifecycle against **service-level targets**, and
keep a complete history of everything that happened to it. Supervisors need an
at-a-glance view of the queue and where SLAs are at risk.

## The product brief vs. this MVP

The brief (`azm_squad_customer_support_crm.pdf`) lists **12 feature areas**. A
faithful implementation of all 12 in the time available would be shallow
everywhere. This MVP implements the **core support loop** — the 5 areas below —
to production shape (validation, RBAC, errors, audit, tests, docs), and states the
rest as explicit out-of-scope items with a migration path.

| Brief area | In this MVP? | Notes |
|------------|--------------|-------|
| 1. Customer Management | ✅ Full | Profiles, contact details, notes, per-customer interaction history |
| 2. Ticket Management | ✅ Full | CRUD, categories, priorities, status lifecycle, assignment, escalation, immutable history |
| 3. Communication Channels | ⚪ Partial | `channel` is a field on the ticket; **no** outbound Email/WhatsApp/SMS/chat |
| 4. Agent Dashboard | ✅ Core | My open tickets, queue counts, SLA-breaching + unassigned lists, quick filters |
| 5. SLA & Automation | ✅ Core | Priority-driven response/resolution targets, derived breach flags, manual + automatic escalation, alerts as dashboard lists |
| 6. Knowledge Base | ❌ | Out of scope |
| 7. AI Features | ❌ | Out of scope (migration path noted) |
| 8. Customer Portal | ❌ | Agents/admins only; no customer login |
| 9. Reports & Management | ⚪ Partial | Dashboard stats only; no BI/exports |
| 10. Security & Administration | ✅ Core | Users & roles (ADMIN/AGENT), JWT auth, server-side RBAC, audit log |
| 11. Integrations | ❌ | No ERP/external integrations |
| 12. Platform | ⚪ Partial | Web, responsive; single-tenant; English only |

Full rationale and the follow-up milestone list: [07-assumptions-and-scope.md](07-assumptions-and-scope.md).

## Glossary

| Term | Meaning |
|------|---------|
| **Agent** | Support staff who work tickets. Role `AGENT`. |
| **Admin** | Support lead. Role `ADMIN`. Superset of agent plus user management and customer deletion. |
| **Ticket** | A single customer issue. Has a human `reference` like `TKT-0042`. |
| **SLA** | Service-Level Agreement. Here: a **response** target (time to first agent reply) and a **resolution** target (time to `RESOLVED`), both derived from priority. |
| **Response SLA** | Deadline for `firstRespondedAt`. Breached if unmet and no response yet. |
| **Resolution SLA** | Deadline for `resolvedAt`. Breached if unmet and not resolved yet. |
| **Breach** | An SLA deadline passed while the corresponding milestone was still unmet. Computed at read time; also recorded once as an event by the sweep. |
| **Escalation** | Raising a ticket's priority one level (capped at `URGENT`) and flagging `isEscalated`. Manual (button/endpoint) or automatic (sweep, on resolution breach). |
| **Sweep** | The background job (`runSlaSweep`) that flags breaches and auto-escalates. Runs on an interval and via `POST /api/admin/run-sla-sweep`. |
| **Audit event** | An immutable `TicketEvent` row recording one state change (created, status/priority change, assignment, escalation, comment, SLA breach, reopen). |
| **Derived field** | A value computed per request and never stored, e.g. `slaResolutionBreached`. |
| **Active status** | `OPEN`, `IN_PROGRESS`, or `PENDING` (i.e. not `RESOLVED`/`CLOSED`). |
