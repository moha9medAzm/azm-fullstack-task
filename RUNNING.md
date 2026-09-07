# Running the Customer Support CRM

A step-by-step runbook: local development, a production-style build, the test
suites, and troubleshooting. For _what the app is_ and _how it's designed_, see
[README.md](README.md) and the [`specs/`](specs/) folder.

---

## 1. Prerequisites

| Tool    | Version           | Check                | Notes                                              |
|---------|-------------------|----------------------|----------------------------------------------------|
| Node.js | **>= 18.13**      | `node --version`     | 18 or 20 LTS both work                             |
| npm     | **>= 8**          | `npm --version`      | ships with Node                                    |
| git     | any               | `git --version`      | only needed to clone                              |

No database server is required — the app uses **SQLite** (a local file).

> Windows: run the commands below in **Git Bash** or **WSL**. In PowerShell,
> replace `cp` with `Copy-Item` and `&&` chaining still works in PowerShell 7+.

---

## 2. Get the code

```bash
git clone https://github.com/moha9medAzm/azm-fullstack-task.git
cd azm-fullstack-task
```

(If you already have the folder, just `cd` into it.)

---

## 3. Install dependencies

From the **repo root** (this is an npm workspaces monorepo — one install covers
both `server/` and `web/`):

```bash
npm install
```

This also generates the Prisma client automatically (via `@prisma/client`'s
post-install). If you ever see _"@prisma/client did not initialize yet"_, run:

```bash
npm run prisma:generate --workspace server
```

---

## 4. Create the environment files

Both workspaces ship a committed `.env.example`. Copy each to `.env`:

```bash
cp server/.env.example server/.env
cp web/.env.example web/.env
```

The defaults work out of the box for local development. What each key does:

### `server/.env`

| Key             | Default                              | Purpose                                                        |
|-----------------|--------------------------------------|---------------------------------------------------------------|
| `DATABASE_URL`  | `file:./dev.db`                      | SQLite file, relative to `server/prisma/`                     |
| `JWT_SECRET`    | `dev-only-change-me-…`               | signs JWTs — **use a long random string in any real deploy**  |
| `JWT_EXPIRES_IN`| `8h`                                 | token lifetime                                                |
| `PORT`          | `4000`                               | API HTTP port                                                 |
| `CORS_ORIGIN`   | `http://localhost:5173`              | comma-separated list of allowed browser origins (the web app) |
| `SLA_SWEEP_MS`  | `60000`                              | how often the background SLA sweep runs (`0` disables it)     |
| `BCRYPT_ROUNDS` | `10`                                 | password hash cost                                            |
| `NODE_ENV`      | `development`                        | `development` \| `test` \| `production`                       |

### `web/.env`

| Key            | Default                          | Purpose                        |
|----------------|----------------------------------|--------------------------------|
| `VITE_API_URL` | `http://localhost:4000/api`      | base URL the frontend calls    |

---

## 5. Create the database + load seed data

```bash
npm run db:reset
```

This runs `prisma migrate reset --force`, which:

1. drops and recreates `server/prisma/dev.db`,
2. applies all migrations in `server/prisma/migrations/`,
3. regenerates the Prisma client,
4. runs the seed script (`server/prisma/seed.ts`).

You should see:

```
Seeded 25 tickets, 8 customers, 3 users.
Login with:
  admin@example.com / Admin123!
  alice@example.com / Agent123!
  bilal@example.com / Agent123!
```

Re-run `npm run db:reset` any time to get back to a clean, known state.
To re-seed **without** wiping the schema: `npm run seed`.

---

## 6. Run it (development)

```bash
npm run dev
```

Starts both processes together (colour-coded via `concurrently`):

| Process | URL                     | Notes                                             |
|---------|-------------------------|--------------------------------------------------|
| API     | http://localhost:4000   | `GET /health` → `{ "status": "ok" }`             |
| Web     | http://localhost:5173   | Vite dev server with hot reload                  |

Open **http://localhost:5173** and sign in with a seeded account.

Run them separately if you prefer two terminals:

```bash
npm run dev:server   # API only
npm run dev:web      # web only
```

Stop with `Ctrl+C`. The server handles `SIGINT`/`SIGTERM` gracefully (stops the
SLA sweep, closes the HTTP server, disconnects Prisma).

### Seeded accounts

| Email                | Password    | Role  | Can…                                                        |
|----------------------|-------------|-------|-----------------------------------------------------------|
| `admin@example.com`  | `Admin123!` | ADMIN | everything, incl. manage users + delete customers        |
| `alice@example.com`  | `Agent123!` | AGENT | tickets, customers, comments, assign, escalate           |
| `bilal@example.com`  | `Agent123!` | AGENT | same as Alice                                            |

---

## 7. A 2-minute smoke walkthrough

After signing in as **admin@example.com**:

1. **Dashboard** — stat cards (my open / unassigned / SLA breaching / resolved-7d),
   queue counts by status and priority, and lists of the tickets breaching SLA
   soonest and the highest-priority unassigned ones.
2. **Tickets** → open any ticket:
   - change **Status** to `In Progress` → the activity timeline gains a
     `Status changed` entry and `firstRespondedAt` is stamped.
   - change **Priority** to `Urgent` → the resolution SLA due date is recomputed
     and a `Priority changed` entry appears.
   - post a **comment** (toggle _Internal note_ to see the styling difference).
   - click **Escalate** → priority bumps one level, the ticket is flagged
     _Escalated_, and an `Escalated` entry is logged.
3. **Tickets** list — try the filter bar (status / priority / assignee / _Mine_ /
   _Unassigned_ / _Breaching SLA_), the sort dropdown, and pagination. All state
   lives in the URL, so it's shareable and survives refresh.
4. **Customers** → open a customer → edit the profile, view their ticket history.
   As admin, try **Delete** on a customer that still has an open ticket → you get
   a `409` explaining why.
5. **Users** (admin only) — create a user, change a role, deactivate/reactivate.
6. Watch the API terminal: roughly once a minute the **SLA sweep** logs any
   response-breach flags and auto-escalations it performed. To trigger it on
   demand: `POST /api/admin/run-sla-sweep` with an admin bearer token.

### Quick API check from the terminal

```bash
# health
curl -s http://localhost:4000/health

# login → capture the token
TOKEN=$(curl -s -X POST http://localhost:4000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@example.com","password":"Admin123!"}' \
  | node -e 'let d="";process.stdin.on("data",c=>d+=c);process.stdin.on("end",()=>console.log(JSON.parse(d).token))')

# authenticated request
curl -s http://localhost:4000/api/dashboard/stats -H "Authorization: Bearer $TOKEN"
```

---

## 8. Tests

```bash
npm test          # server: unit + integration (Vitest + Supertest)
npm run test:web  # web: React Testing Library (Vitest + jsdom)
npm run typecheck # tsc --noEmit in both workspaces
```

- The server integration tests spin up their **own** temporary SQLite database
  (`server/prisma/test.db`), apply migrations, and wipe tables between tests —
  they never touch your `dev.db`.
- Watch mode: `npm run test:watch --workspace server` or
  `npm run test:watch --workspace web`.

---

## 9. Production-style build

```bash
npm run build
```

- `server/` → compiled JS in `server/dist/`
- `web/` → static assets in `web/dist/`

### Run the built server

```bash
cd server
npx prisma migrate deploy          # apply migrations to the target DATABASE_URL
node dist/index.js                 # starts on $PORT (default 4000)
```

Set real values for `DATABASE_URL`, `JWT_SECRET`, `CORS_ORIGIN`, and
`NODE_ENV=production` in the environment first.

### Serve the built frontend

```bash
npm run preview --workspace web    # serves web/dist on http://localhost:4173
```

`vite preview` uses port **4173**, so add `http://localhost:4173` to
`CORS_ORIGIN` in `server/.env` (comma-separated), or serve `web/dist` from any
static host and point `VITE_API_URL` at your API before building.

### Moving off SQLite (e.g. to PostgreSQL)

1. In `server/prisma/schema.prisma` set `datasource db { provider = "postgresql" }`.
2. Point `DATABASE_URL` at your Postgres instance.
3. `npx prisma migrate dev --name init-postgres` (regenerates migrations for the
   new provider), then `npx prisma migrate deploy` in other environments.

No application code changes are needed — Prisma abstracts the driver.

---

## 10. Troubleshooting

| Symptom | Cause & fix |
|---------|-------------|
| **Login does nothing / network error in the browser console** | The web app is on a port not listed in `CORS_ORIGIN`. Vite falls back to `5174`, `5175`, … if `5173` is taken — check the Vite banner, then add that origin to `CORS_ORIGIN` in `server/.env` (comma-separated) and restart the API. |
| **`Port 5173 is in use, trying another one…`** | Harmless — Vite picked the next free port. Use the URL it prints (and see the CORS note above). |
| **`EADDRINUSE: :::4000`** | Something is already on the API port. Free it: `lsof -ti:4000 -sTCP:LISTEN \| xargs -r kill`, or change `PORT` in `server/.env` **and** `VITE_API_URL` in `web/.env`. |
| **`Invalid environment configuration`** on server start | A required key is missing/short in `server/.env`. The message lists which one. `JWT_SECRET` must be ≥ 16 characters. |
| **`@prisma/client did not initialize yet`** | Run `npm run prisma:generate --workspace server` (or just `npm install` again). |
| **`table … does not exist` / migration errors** | Your `dev.db` is stale. `npm run db:reset`. |
| **`database is locked`** (SQLite) | Another process holds the file — usually a leftover `tsx watch` or a test run. Stop other processes; SQLite allows a single writer. |
| **Seed says `Unique constraint failed`** | The DB wasn't empty. `npm run db:reset` (it wipes first). |
| **Node version errors (`Unsupported engine`, syntax errors in deps)** | You're below Node 18.13. Install 18 or 20 LTS (e.g. via `nvm install 20`). |
| **Frontend loads but every request is 401** | No/invalid token. Log out and back in; the token is stored in `localStorage` under `crm.token` and is re-validated against the DB on every request, so a `db:reset` invalidates existing sessions. |
| **Changes to `server/.env` seem ignored** | `tsx watch` doesn't watch `.env`. Restart the API process. |

---

## 11. Command cheat-sheet

```bash
npm install                 # one-time, from repo root
cp server/.env.example server/.env
cp web/.env.example web/.env
npm run db:reset            # (re)create + seed the database
npm run dev                 # API :4000 + web :5173

npm test                    # server tests
npm run test:web            # web tests
npm run typecheck           # both workspaces
npm run build               # production build of both

npm run seed                # re-seed only (no schema wipe)
npm run db:migrate          # create/apply a new migration after schema edits
```
