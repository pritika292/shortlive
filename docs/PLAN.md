# Plan: shortlive end-to-end build (phase × feature roadmap)

## Context

Scaffolding for `shortlive` is done (commit `4e6999a` on `pritika292/shortlive`'s `main`).
The repo now has README, CLAUDE.md, .gitignore, .pre-commit-config.yaml, .tool-versions.

This plan is the build-out: how we go from the empty scaffold to a fully-featured,
live-deployed URL shortener with rule-based webhook automation, in one day, organized
as **23 feature blocks across 9 phases**. Each block is independently testable, has tests
in the same PR(s) as its code, passes CI before merging, and lands a verifiable
feature increment.

**Why feature blocks not PR numbers**: PR counts will deviate (some features will need
a fix-up PR, others will land in one). Tracking by feature ID (e.g. `5.2`) stays stable
regardless of how many PRs implement it. One block can be 1 PR or 5 PRs: whatever the
work needs.

This plan replaces the previous plan (the README-reframe: that work is shipped).

The plan itself will be committed as `shortlive/docs/PLAN.md` (public: shows the roadmap,
marks done vs planned, with no private context). The first deploy lands at block **6.1**
(after the live channel is wired); every subsequent merge to `main` auto-deploys via
the OIDC pipeline.

---

## Pre-step (tiny, not a PR, not a block)

Before block 1.1: add one sentence to `shortlive/README.md` under the access-model
section:

> _If you've received an invite, see the email for your username and password. There is
> no self-serve signup._

Single direct-to-main commit. Branch protection isn't on yet (block 1.6 enables it).

---

## Conventions

- **Feature blocks** are numbered `<phase>.<block>` (e.g. `4.1`).
- **PRs** carry the block ID in their title, e.g. `[5.2] Wire up WebSocket fan-out`.
- A block is **done** when: its code is on `main`, its tests are green in CI, and the
  block's manual verification (below) passes.
- Multiple PRs per block are fine: they all reference the same block ID.
- Branch names: short imperative, e.g. `add-login-route`. No need to encode block ID
  in branch names.
- **Tests ship in the same PR as the code.** No "follow-up PR" exceptions.
- `gh pr merge --squash` keeps `main` linear; one squash-commit per PR, message starts
  with the block ID.

---

## CI gate (set up in block 1.6)

After 1.5 (Vitest + smoke test), 1.6 introduces:
- `.github/workflows/ci.yml` running lint, typecheck, unit, integration, docker build.
- Branch protection on `main` requiring all CI checks to pass.

From block 2.1 onward, every merge to `main` requires green CI.

---

## Deployment

First deploy: **block 6.1** (live-channel infrastructure complete). It adds:
- `Dockerfile` (multi-stage; production image)
- `docker-compose.prod.yml` (joins the shared `pritika` network on the VM)
- `.github/workflows/deploy.yml` (OIDC → `az vm run-command` → `/opt/pritika/deploy.sh shortlive`)

From block 6.1 onward, every merge to `main` triggers a deploy. The live URL
`http://135.232.183.50:3010/` should respond after each deploy.

---

## The 23 feature blocks

For each block: **scope**, **tests** that ship with it, **verify** (how to confirm it
works locally + post-merge).

### Phase 1: Bootstrap

**1.1: Initialize Node project + Express skeleton + /health**
- Scope: `package.json`, `tsconfig.json` (strict), `src/server/index.ts` (Express on
  3010, GET `/health` returns `{ok: true}`), npm scripts (`dev`, `build`, `start`).
- Tests: none yet (1.5 introduces vitest).
- Verify: `npm install && npm run dev` → `curl localhost:3010/health` returns `{"ok":true}`.

**1.2: Linting + formatting**
- Scope: `.eslintrc.cjs`, `.prettierrc`, `.editorconfig`, `npm run lint`/`format`.
- Tests: none (this block adds the tools other blocks depend on).
- Verify: `npm run lint` exits 0 on a clean tree.

**1.3: Dotenv + config validation**
- Scope: `src/server/config.ts` reads env with Zod validation (`DATABASE_URL`,
  `REDIS_URL`, `PORT`, `SESSION_SECRET`); `.env.example` committed; `.env` gitignored.
- Tests: unit: config validation rejects empty `DATABASE_URL`, accepts a valid one.
- Verify: missing `DATABASE_URL` makes `npm start` fail with a clear error.

**1.4: Local Postgres + Redis via docker-compose**
- Scope: `docker-compose.yml` running `postgres:16-alpine` + `redis:7-alpine` for local
  dev (separate from the prod compose introduced in 6.1). README "Run locally" updated.
- Tests: none (infra only).
- Verify: `docker compose up -d && psql $DATABASE_URL -c 'SELECT 1'` returns `1`.

**1.5: Vitest scaffold + smoke test**
- Scope: `vitest.config.ts`, `tests/smoke.test.ts` asserting 1+1=2 + config module
  loads. Scripts `test` and `test:watch`.
- Tests: the smoke test itself.
- Verify: `npm test` exits 0 with ≥ 1 test passing.

**1.6: CI workflow + branch protection**
- Scope: `.github/workflows/ci.yml` (lint + typecheck + test + docker build).
  Branch protection on `main` via `gh api` (all required checks must pass).
- Tests: workflow runs green on the PR itself.
- Verify: open a PR with a broken test → CI fails → merge button blocked. Fix → green → merge enabled.

### Phase 2: Auth foundation

**2.1: Migration runner + `auth.users` table**
- Scope: tiny migration runner (`node-pg-migrate` or hand-rolled), `migrations/001_auth_users.sql`
  with `CREATE SCHEMA auth` + `CREATE TABLE auth.users (...)` per the README schema.
  `npm run migrate` script.
- Tests: integration: `npm run migrate` against a fresh test DB creates the table.
- Verify: `psql ... -c '\dt auth.*'` shows `auth.users`.

**2.2: bcrypt utility + `sessions` table**
- Scope: `src/server/services/passwords.ts` (`hash`, `verify`, cost 12);
  `migrations/002_sessions.sql`.
- Tests: unit: `hash("x") |> verify("x")` is true, `verify("y")` is false; round-trip
  ≥ 100ms.
- Verify: `\dt sessions` shows the new table; `npm test` green.

**2.3: `POST /login` + session creation**
- Scope: `src/server/routes/auth.ts` POST `/login`, SELECT user by username, bcrypt-verify,
  INSERT session, set HTTP-only cookie. 401 on bad creds.
- Tests: integration: happy path returns 200 + cookie; bad password → 401.
- Verify: insert a test user via psql, `curl -c cookie.txt -X POST localhost:3010/login ...`
  → 200 + cookie present.

**2.4: Session middleware + `POST /logout`**
- Scope: middleware reading cookie, SELECT session, attach `req.user`. POST `/logout`
  deletes session row + clears cookie. Helper `requireLogin` returns 401 if `!req.user`.
- Tests: integration: protected route returns 401 without cookie, 200 with valid cookie,
  401 with expired session row.
- Verify: hit a temporary `/whoami` endpoint with the cookie, see your username back.

### Phase 3: URL shortening + redirect

**3.1: `urls` table + nanoid generator**
- Scope: `migrations/003_urls.sql`, `src/server/services/shortcode.ts` generating 7-char
  nanoid with retry-on-collision (max 3 retries).
- Tests: unit: 1000 generations all unique; collision retry covered (stubbed PG
  returning duplicate twice then succeeding).
- Verify: `\d urls` shows expected columns + UNIQUE index on `short`.

**3.2: `POST /shorten` (login required)**
- Scope: `src/server/routes/shorten.ts` validates body, generates shortcode, INSERTs
  with `owner_id = req.user.id`, returns `{short, url}`. Wrapped in `requireLogin`.
- Tests: integration: anonymous → 401; authed valid URL → 200 + 7-char short; invalid
  URL → 400.
- Verify: log in, `curl -b cookie.txt -X POST localhost:3010/shorten -d '{"target":"https://example.com"}'`.

**3.3: `GET /:short` happy-path redirect**
- Scope: `src/server/routes/redirect.ts` SELECT target, return 302 with `Location` header.
  404 if unknown.
- Tests: integration: POST then GET returns 302 to original target; unknown shortcode → 404.
- Verify: in a browser, hit `localhost:3010/<short>` and watch it redirect.

**3.4: Vanity shortcodes (custom slug)**
- Scope: optional `custom_short` field in POST `/shorten`; validate 3–32 chars,
  `[a-zA-Z0-9-]`; 409 on collision (the UNIQUE constraint surfaces it).
- Tests: unit (slug validation), integration (custom slug works, duplicate → 409).
- Verify: POST with `custom_short: "hello-world"` → `GET /hello-world` redirects.

**3.5: Link expiry + password-gated links**
- Scope: optional `expires_at` (link returns 410 after) and `password` (bcrypt-hashed;
  visitor sees a password form, correct entry sets a `link_unlocked_<short>` cookie).
- Tests: integration: expired link returns 410; correct password unlocks; wrong password
  re-renders form; cookie persists across requests.
- Verify: create a link with `expires_at` 1 min from now → 410 after a minute. Create a
  password-gated link → form shown → submit → redirect succeeds.

### Phase 4: Click logging + GeoIP

**4.1: `clicks` table + GeoLite2 + async click logging**
- Scope: `migrations/004_clicks.sql`. `src/server/services/geo.ts` reads
  `GeoLite2-City.mmdb` (path from env; fetched at startup by a small script,
  gitignored). `src/server/services/ip.ts` hashes IPs with a server-side pepper.
  Redirect handler fires `setImmediate(() => logClick(...))` AFTER calling
  `res.redirect(302)`.
- Tests: unit (geo lookup for known IP, ip hashing deterministic with pepper, missing
  mmdb falls back gracefully); integration (POST /shorten + GET /:short results in a
  clicks row with country + lat/lon).
- Verify: `psql ... -c 'SELECT * FROM clicks LIMIT 5'` shows recent rows after hits.

### Phase 5: Live channel

**5.1: Redis ZSET helpers + publish on click**
- Scope: `src/server/services/redis.ts` connects via `ioredis`. Click logger does
  `ZADD shortlive:recent_clicks:{short}` (score=ts), `ZREMRANGEBYRANK ... 0 -101`,
  `PUBLISH shortlive:clicks.{short}` with click JSON.
- Tests: integration: POST /shorten + GET /:short → ZSET has 1 entry; 101 hits → ZSET
  still has 100 (oldest evicted); subscriber receives the message.
- Verify: `redis-cli ZRANGE shortlive:recent_clicks:<short> 0 -1 WITHSCORES`.

**5.2: WebSocket server + pub/sub fan-out**
- Scope: `src/server/ws/server.ts` upgrades on `/ws/:short`, subscribes to the matching
  pub/sub channel, forwards messages to connected sockets. On connect, sends the last
  100 from the ZSET (hydration).
- Tests: integration: open WS client, POST a click, client receives the event with
  matching fields.
- Verify: in two terminals: `websocat ws://localhost:3010/ws/<short>` in one, `curl <short>`
  in the other → JSON appears instantly in the websocat terminal.

### Phase 6: Deploy infrastructure (FIRST DEPLOY)

**6.1: Dockerfile + deploy pipeline + first prod deploy**
- Scope: multi-stage Dockerfile (build → run). `docker-compose.prod.yml` joining the
  shared `pritika` network and reading creds from `/opt/pritika/_infra/.env`.
  `.github/workflows/deploy.yml` runs after CI green on `main`, OIDC-authenticates,
  invokes `az vm run-command` with `/opt/pritika/deploy.sh shortlive`.
- Tests: locally: `docker build -t shortlive . && docker run --rm shortlive sh -c
  "node -e 'require(\"./dist/server/index.js\")'"` succeeds.
- Verify: merge to `main` → GitHub Actions deploy job goes green → `curl
  http://135.232.183.50:3010/health` returns `{"ok":true}`. **Live URL is reachable.**

### Phase 7: Dashboard UI

**7.1: Vite + React scaffold + Tailwind**
- Scope: client codebase under `src/client/`, Vite config, Tailwind + shadcn/ui init,
  Express serves the Vite-built bundle in production.
- Tests: smoke component test: `<App />` renders without crashing.
- Verify: `npm run dev` opens Vite dev server, base route shows "shortlive".

**7.2: `/demo` route + demo seeder**
- Scope: seeder runs on startup if `urls.short = 'demo'` doesn't exist: creates it,
  inserts ~300 historical click rows with varied countries/UAs. `/demo` route serves
  the React app with `:short = "demo"`.
- Tests: integration: startup creates the demo row; `GET /demo` returns 200 with the
  React bundle.
- Verify: hit `http://135.232.183.50:3010/demo`: page loads.

**7.3: Live click counter + recent-clicks feed**
- Scope: React component subscribes to the WS, displays counter + a scrolling list of
  the last 20 clicks (timestamp + country).
- Tests: component test for `RecentFeed` rendering 20 mock clicks.
- Verify: open `/demo` in two tabs; click `/:short` in one terminal; counter ticks and
  feed updates in real time.

**7.4: Leaflet map with click pins**
- Scope: Leaflet + OpenStreetMap tiles, pin per click from the WS, pins fade out after
  60s. Hydrates from the initial-100 snapshot on connect.
- Tests: component test for `<Map />` mounting + adding/removing pins.
- Verify: drop pins via clicks, watch the map cluster them. Pins fade after a minute.

**7.5: Time-series chart + breakdown tables**
- Scope: aggregation endpoints `GET /api/agg/series?short=...&window=1h&bucket=1m`,
  `GET /api/agg/breakdown?short=...&dim=country`. Recharts components.
- Tests: integration: series endpoint returns correctly-bucketed data; breakdown
  endpoint groups + percentages correctly.
- Verify: chart fills out as the demo simulator fires clicks; country table shows top 5.

**7.6: Background click simulator (demo only)**
- Scope: in-process job that adds 1–3 simulated clicks to `demo` every 20s if the demo
  link has no real click in the last 5 min. Never runs for non-demo links.
- Tests: unit: generator produces clicks with valid country codes; integration
  simulator increments click count over time.
- Verify: leave `/demo` open for a minute, see the counter climb without any user input.

### Phase 8: Rule engine

**8.1: `rules` + `firings` tables + rule CRUD API (owner-only)**
- Scope: migrations + REST endpoints `GET/POST/PATCH/DELETE /api/links/:short/rules`,
  all `requireLogin + requireOwner`. Per-type config schema validation.
- Tests: integration: anonymous → 401; other-owner → 403; owner creates rule → 200;
  invalid config → 400.
- Verify: log in, POST a `threshold` rule via curl, see it listed.

**8.2: Rule evaluator: threshold + per_click + first_of**
- Scope: `src/server/services/rule_engine.ts`. For each enabled rule on the click's
  link: evaluate; on fire INSERT into `firings`, enqueue BullMQ job with
  `jobId = firing_id` (we wire up BullMQ here but the worker comes in 9.1).
- Tests: unit: each evaluator matches the documented semantics; integration: create
  a `threshold:N=5` rule, fire 5 clicks, observe exactly one `firings` row.
- Verify: tail the firings table while hitting `/:short` in a loop.

**8.3: Velocity rule (sliding window) + cooldowns**
- Scope: Redis ZSET-backed sliding window per rule, ZREMRANGEBYSCORE old entries on
  each click. Cooldown TTL key prevents re-firing for `cooldown_seconds`.
- Tests: unit (window math with simulated time), integration (fire ≥ N clicks within T
  seconds → exactly 1 firing during cooldown).
- Verify: create `velocity:N=10,T=30s,cooldown=60s`, hammer the link, see exactly 1
  firing per minute.

### Phase 9: Webhook delivery

**9.1: BullMQ worker + HTTP POST + retries + DLQ + HMAC**
- Scope: `src/server/services/webhook_worker.ts`. POSTs to `destination_url` with body
  `{firing_id, rule_id, short, type, ts, matched_clicks}` and header
  `X-Shortlive-Signature: sha256=...`. 5-attempt exponential backoff. Failed jobs
  update `firings.status = 'failed'`.
- Tests: integration: start a local sink (Express on a random port), create rule
  pointing at it, fire, sink receives the POST with valid HMAC. Then sink returns 500
  three times → worker retries → 2xx on 4th → firing marked delivered.
- Verify: with `nc -l 9999` on the VM, fire a real rule, watch the POST arrive.

**9.2: Destination handshake + rule + delivery UI**
- Scope: when a rule is created or its destination changes, POST
  `{verification_nonce: "..."}` to the URL and expect the nonce echoed back in the
  response body within 5s. Mark `destination_verified` accordingly. Block firings if
  unverified. Add React UI for rule CRUD + per-rule firings table with manual retry.
- Tests: integration: handshake against a cooperating sink succeeds; against a
  non-echoing sink fails; rule with unverified destination doesn't fire even when
  conditions match.
- Verify: open the UI, create a rule pointing at a webhook.site URL, watch verification
  succeed, watch firings deliver in real time.

---

## Manual verification checklist (run after every block lands on `main`)

```bash
# Locally after pulling main
npm install && npm run migrate && npm test && npm run lint && npm run typecheck

# After deploy (block 6.1+)
curl -s http://135.232.183.50:3010/health
```

If a block's deploy goes bad: `git revert <sha> && git push`: branch protection allows
reverts. The deploy pipeline re-runs.

---

## Acceptance criteria: "shortlive is done"

- [ ] All 23 feature blocks (1.1–9.2) have their tests green on `main` and pass their
      manual verify step
- [ ] `http://135.232.183.50:3010/demo` renders the live dashboard with map, counter,
      time-series, breakdowns, recent feed, and pre-configured firing rules
- [ ] Anonymous POST `/shorten` returns 401; logged-in works end-to-end
- [ ] A rule with verified destination fires and delivers a webhook successfully
- [ ] A rule with unverified destination does NOT fire even after matching clicks
- [ ] CI on `main` is green; branch protection blocks red merges
- [ ] All committed files pass the project's audit step (vocabulary list kept out of the
      public repo; runs as part of CI).

---

## What this plan explicitly does NOT cover

- Other projects in the same org: each has its own PLAN.md
- Pitchpage's admin UI for issuing credentials: done as part of pitchpage's build, not
  shortlive. For shortlive's build, we insert test users manually via psql.
- Domain + HTTPS: defer; raw IP works for testing
- Backups, monitoring/alerting beyond `status.sh`: out of scope
- Real load testing: placeholder `npm run bench` script may land but isn't gating

---

## Critical files this plan creates (in shortlive/)

- `package.json`, `tsconfig.json`, `vitest.config.ts`, `.eslintrc.cjs`, `.prettierrc`
- `docker-compose.yml` (local dev), `docker-compose.prod.yml`, `Dockerfile`
- `migrations/001_auth_users.sql` through `migrations/006_rules_firings.sql`
- `src/server/index.ts`, `src/server/config.ts`
- `src/server/routes/{auth,shorten,redirect,dashboard,rules,firings}.ts`
- `src/server/services/{passwords,shortcode,geo,ip,redis,rule_engine,webhook_worker}.ts`
- `src/server/middleware/{session,requireLogin,requireOwner}.ts`
- `src/server/ws/{server,subscriber}.ts`
- `src/server/seed/demo.ts`
- `src/client/main.tsx`, `src/client/pages/{Home,Login,Demo,Analytics,Rules}.tsx`
- `src/client/components/{Map,TimeSeriesChart,RecentFeed,RuleForm,FiringsLog}.tsx`
- `tests/unit/*.test.ts`, `tests/integration/*.test.ts`
- `.github/workflows/{ci,deploy}.yml`
- `docs/PLAN.md` (this file, committed publicly so the roadmap is visible)
