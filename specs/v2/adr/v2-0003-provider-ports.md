# ADR V2-0003- — Hexagonal provider ports for channels / AI / ERP

**Status:** Accepted · 2026-09-08 · branch `v2-full-scope`

## Context
Areas 3, 7, 11 need external services (WhatsApp/SMS/Email, an LLM, an ERP). Paid
infra isn't available in this environment, but the architecture must be real.

## Decision
A small port (interface) per concern under `src/ports/` with: a **real provider**
(used when its env/config is present) and a **deterministic mock** (always used under
`NODE_ENV=test`). A `registry` picks the active one from `SystemConfig` + env. Each
port has a **contract test** run against real + mock.

- channel: `ChannelProvider` — WebForm (real), LiveChat (real), Email (SMTP real +
  mock), Twilio (skeleton) + MockSms
- ai: `AiProvider` — ClaudeProvider (real, `@anthropic-ai/sdk`) + MockAiProvider
- erp: `ErpProvider` — MockErpProvider + documented real shape
- notify: `Notifier` — InAppNotifier (real) + EmailNotifier (adapter)

## Consequences
+ Every area is a real, tested module; a real provider drops in by setting env.
+ The test suite makes no network calls.
- One extra indirection per external call. Worth it for testability and for showing
  the integration design without paid accounts.
