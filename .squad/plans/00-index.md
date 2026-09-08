# Plans index

One row per feature folder under `.squad/plans/`. `NN` continues as a global
execution sequence across all features.

The **12 stories** for the v2 full-12-area build. Intakes are complete for all;
plans are authored **just before** each story is implemented (Squad-Kit's "plan one,
execute, plan the next"). See `specs/v2/00-overview.md` §3 for the roadmap and
dependency order, and `specs/v2/01-requirements.md` for the acceptance criteria each
story delivers.

| NN | Feature | Overview | Area | Status |
|----|---------|----------|------|--------|
| 01 | [platform-foundation](platform-foundation/00-overview.md) | Branch/Department + scoping, i18n AR/EN + RTL, branding, responsive | 12 | plan ready |
| 02 | security-admin | Permissions layer, audit-log viewer, system config | 10 | intake ready |
| 03 | customer-management | Attachments, richer profiles, Conversation/Message, merge | 1 | intake ready |
| 04 | ticket-management | Tags, watchers, merge & split, bulk actions | 2 | intake ready |
| 05 | channels | ChannelProvider port, web forms, live chat, email, WhatsApp/SMS | 3 | intake ready |
| 06 | sla-automation | Rule engine, auto-assignment, escalation rules, notifications | 5 | intake ready |
| 07 | knowledge-base | Articles, FTS5 search, versioning, public read | 6 | intake ready |
| 08 | ai-features | AiProvider port (Claude + mock): summaries, replies, categorize, chatbot | 7 | intake ready |
| 09 | customer-portal | CUSTOMER role, portal auth, submit/track/FAQ/CSAT | 8 | intake ready |
| 10 | agent-workspace | Tasks & reminders, quick replies, @mentions | 4 | intake ready |
| 11 | reports-management | Ticket/SLA/agent/CSAT reports, dashboards, CSV export | 9 | intake ready |
| 12 | integrations | Public API + API keys, webhooks, ERP connector | 11 | intake ready |
