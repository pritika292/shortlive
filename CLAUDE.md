# Project standards — read this before writing any code

This file is loaded automatically by Claude Code when working in this repository.
**Anything you write here must follow these rules.** This repo is public — assume anyone
reading the source will scan the README, the commit history, the tests, and the
architecture. Each artifact should hold up under that level of scrutiny.

Anything you want to leave as a note that *shouldn't* be public goes in `CLAUDE.local.md`
(gitignored, not committed). Claude Code auto-loads it the same way as this file.

---

## Identity for commits

- **Author**: `Pritika Priyadarshini <pritika98@gmail.com>`
- This is set per-repo via `git config user.name` / `user.email` in `bootstrap-repo.sh`.
- Verify before pushing: `git log --format='%an <%ae>' -3` — all three must be Pritika.
- **Never** add `Co-Authored-By: Claude` or `🤖 Generated with Claude Code` footers.

---

## Commit style

Make commits that read like a careful engineer typed them in flow.

- **One logical change per commit.** Don't squash 5 features into one.
- **Imperative, capitalized subject. No trailing period.** ≤72 chars.
  - ✅ `Add retry logic with exponential backoff to webhook worker`
  - ✅ `Switch from polling to SSE for flag config updates`
  - ❌ `feat: added retry logic 🎉`
  - ❌ `Updates`
- **Body when the "why" isn't obvious.** 2-4 lines max. Wrap at 72 chars. No essays.
- **No AI fingerprints.** No emoji-heavy messages, no "comprehensive", "robust",
  "production-ready", "let me", "I've added". Read your message out loud — if it sounds
  like an LLM, rewrite it.
- **No dead commits.** No `wip`, `fix typo` chains, `try again`, `oops`. Rebase locally
  before pushing if a working session got messy.
- **Aim for 10-40 commits per project as it grows.** Not one giant blob at the end.

---

## Tests — same PR as the code

**Every PR that adds or changes behavior must include tests for that change in the same PR.**
Not "follow-up PR." Not "we'll add tests once it's working." Same PR.

What to ship:
- **Unit tests** for core business logic — pure functions, calculations, parsers,
  validators, state-machine transitions. Run in milliseconds.
- **Integration tests** for the critical API paths — boots a real Postgres + Redis from
  `docker-compose.test.yml` (no mocks where a real dep would do). Tests the happy path of
  every public endpoint the README claims works.
- **CI gate**: GitHub Actions runs lint + unit + integration on every push and PR.
  **Merging to `main` is blocked if any of these fail.** Branch protection enforces this.

When fixing a bug:
1. Write the failing test first.
2. Commit it as `Reproduce bug: <description>`.
3. Fix the bug.
4. Commit the fix as `Fix <bug>`.
5. The PR shows red→green, which is *the* signal of a real fix.

Tools:
- Node/TS: `vitest` (unit) + `supertest` (HTTP integration)
- Python: `pytest` + `httpx`

Coverage target is not a percentage. Test what would embarrass us if it broke during a demo:
retries, concurrency, idempotency, validation, error paths.

---

## README — first impression for anyone visiting the repo

The README is the GitHub landing page. Anyone evaluating the code — a reviewer, a
collaborator, someone who found the repo from a link — decides in 30 seconds whether
to keep reading or click the live demo. It must do more than list features.

Required sections, in this order:
1. **One-line tagline** — plain English, no buzzwords.
2. **Live demo link** + GIF/screencast under the title.
3. **The 10-second pitch** — 2 sentences. What problem, what's the demo experience.
4. **Why this exists** — the motivation. What real-team problem does this solve? Be specific.
5. **Architecture diagram** — required. ASCII art inside a fenced code block is preferred
   because it renders identically across GitHub web, mobile, terminals, and IDEs. Mermaid
   is acceptable if a diagram is too complex for ASCII, but ASCII is the default.
6. **Data model** — Postgres tables (with indexes) + Redis key shapes. One paragraph each.
7. **Tech stack & rationale** — one sentence per choice explaining *why this tool over
   alternatives*. This is how a reader judges design quality.
8. **Run locally** — exact commands. Copy-paste-able.
9. **Tests** — how to run unit + integration. CI badge.
10. **Performance characteristics** — p50/p99 numbers if measured, honest "haven't measured"
    if not. **Don't fake numbers.**
11. **Limitations & honest scope** — what would need to change for production. Naming the
    MVP's edges builds trust faster than hiding them.
12. **What I'd do next** — 3-5 bullets of how this evolves toward a real product.

Tone: write like an engineer explaining their work to a peer they respect. No "exciting,"
"innovative," "cutting-edge." No emoji in headings. No bold-every-other-word. Specifics
beat adjectives.

---

## Code style

- **TypeScript strict mode on.** No `any` unless commented why.
- **Lint + format**: `eslint` + `prettier` (Node) or `ruff` (Python). Pre-commit hook
  enforces both.
- **Named functions over arrow blob soup.** Files ≤300 lines unless there's a real reason.
- **No dead code, no half-implemented features.** Each commit should leave `main`
  shippable.
- **Comments**: write WHY, not WHAT. Skip if the code is self-evident. Never reference the
  current task, fix, or callers in code comments.

---

## Secrets — never commit

- Every repo has `.env.example` with placeholders. The real `.env` is gitignored.
- For Azure resources: **no API keys.** Use `DefaultAzureCredential` (managed identity on
  the VM, `az login` locally). The AI Foundry account has `disableLocalAuth=true` — API
  keys structurally don't work even if leaked.
- For non-Azure secrets (e.g., GitHub App private key for `prbot`): Azure Key Vault. Read
  at startup via managed identity.
- pre-commit `gitleaks` scans staged changes before every commit. CI re-scans the diff in
  case `--no-verify` was used.

---

## Workflow for adding a feature

1. Branch from `main`: `git checkout -b add-X` (or similar imperative name).
2. Write the test that proves X works (or fails as expected for a bug fix).
3. Implement.
4. Run locally: `npm test && npm run lint && npm run typecheck` (or `uv run pytest`).
5. Commit with a clear imperative subject and a body if the "why" needs explaining.
6. Push, open PR. CI runs lint + unit + integration. If green, merge.
7. Merge to `main` → GitHub Actions deploys via OIDC → `az vm run-command` → `deploy.sh`
   on the VM → ~60 seconds later the live demo updates.

---

## Pre-commit hooks (configured in `.pre-commit-config.yaml`)

Already wired up by `bootstrap-repo.sh`:
- `gitleaks` — block leaked secrets
- `detect-private-key` — block SSH/TLS private keys
- `check-added-large-files` — block files >500 KB
- `check-merge-conflict`, `check-yaml`, `check-json`, `end-of-file-fixer`,
  `trailing-whitespace`, `mixed-line-ending`
- `shellcheck` — bash lint on `*.sh` files

Per-language hooks (eslint, tsc, ruff, mypy) are added when the project's tooling is
scaffolded.

---

<!--
PROJECT-SPECIFIC SECTION
=======================
Below this line: what this project actually is, the architecture, the data flow,
implementation choices that must not drift, and the explicit feature scope. This is the
context a fresh session needs to pick up the right design instantly.
-->

## About this project — shortlive

**One-liner**: URL shortener with sub-second live click analytics and rule-based
webhook automation.

**Port**: 3010 on the VM, `http://<VM_IP>:3010/`.

### What it does (locked feature scope)

1. **URL shortening** (login required) — nanoid by default; optional vanity slug,
   `expires_at`, password gate. Owner attribution to the logged-in user.
2. **Click tracking** (public redirect endpoint) — GET `/:short` returns 302 first,
   logs asynchronously (PG insert + Redis ZSET + pub/sub + rule eval).
3. **Real-time analytics dashboard** — demo mode (public, pre-seeded link at `/demo`)
   and interactive mode (login + ownership at `/a/:short`). Live counter, map, time
   series, country / referrer / device breakdowns, recent-clicks feed.
4. **Rule-based webhook automation** (login + ownership) — 4 rule types
   (`threshold`, `velocity`, `first_of`, `per_click`), destination handshake before
   any rule can fire, at-least-once delivery with exponential-backoff retries and
   DLQ, idempotency via `firing_id`.
5. **Login + shared auth** — reads from shared `auth.users` table on the host
   Postgres. HTTP-only session cookie scoped to port 3010. Credentials are issued out
   of band (no self-serve signup) and work across every project sharing this auth
   instance.

### Access model — public vs gated

| Surface | Public | Login | Login + own |
|---|---|---|---|
| `/` homepage | ✓ | | |
| `/demo` (pre-seeded dashboard) | ✓ | | |
| `/:short` (redirect) | ✓ | | |
| `/login`, `/logout` | ✓ | | |
| `POST /shorten` | | ✓ | |
| `/a/:short` (your analytics) | | | ✓ |
| `/a/:short/rules` | | | ✓ |
| `/api/firings/:rule_id` | | | ✓ |

The redirect endpoint is always public — that's the whole point of a URL shortener.
Everything that mutates state requires authentication.

### Data flow (high-level)

- `POST /shorten` → session check → INSERT into `urls` → return `{short, url}`.
- `GET /:short` → SELECT target → return 302 fast → async: INSERT `clicks`,
  ZADD Redis sorted set, PUBLISH pub/sub, evaluate every enabled rule on this link.
- Rule fires → INSERT a `firings` row → enqueue BullMQ job (jobId = `firing_id`).
- Webhook worker picks up the job → POST to `destination_url` with HMAC signature →
  update `firings.status` to `delivered` or retry with backoff.
- Dashboard WS subscribes to `shortlive:clicks.{short}` and `shortlive:firings.{short}`
  pub/sub channels.

### Critical implementation choices (do not drift)

- **The 302 always happens before any logging or rule evaluation.** Click logging is
  fail-soft. The user is never blocked on analytics, ever.
- **The redirect endpoint never requires authentication.** A logged-out visitor must
  be able to click the short link and reach the target.
- **Redis sorted set `shortlive:recent_clicks:{short}` is capped at 100 entries** via
  `ZREMRANGEBYRANK ... 0 -101` after each insert. The dashboard hydrates from this
  ZSET on tab connect — not from Postgres. New clicks arrive via pub/sub.
- **GeoIP lookup is via a local GeoLite2-City.mmdb file**, not an external HTTP API.
  No per-click network call.
- **BullMQ jobId equals `firing_id`** — this is what makes the webhook delivery
  idempotent. The same firing is never enqueued twice, even on retries.
- **Destination URLs are verified via handshake before any rule fires.** A POSTed
  nonce must be echoed back in the response body within 5 seconds. Without
  verification, the rule sits in a "pending verification" state and won't fire.
- **Sessions live in Postgres**, not Redis. Slower per-request validation but
  simpler reasoning about expiry, multi-replica safety, and TTL.
- **Passwords for `urls.password_hash` and `auth.users.password_hash`
  use bcrypt.** Cost factor 12.
- **IP addresses are hashed** (SHA-256 with a server-side pepper) before storage —
  raw IPs never hit the database.

### File layout (target — none exist yet)

```
src/
  server/
    index.ts                  # Express app entry; wires middleware + routes
    middleware/
      session.ts              # cookie → session lookup → req.user
      requireLogin.ts         # 401/redirect if no session
      requireOwner.ts         # 403 if req.user doesn't own the link
    routes/
      auth.ts                 # GET /login, POST /login, POST /logout
      shorten.ts              # POST /shorten (login required)
      redirect.ts             # GET /:short (always public)
      dashboard.ts            # GET /demo, GET /a/:short
      rules.ts                # CRUD for /a/:short/rules
      firings.ts              # GET /api/firings/:rule_id
    services/
      db.ts                   # pg pool + helpers
      redis.ts                # Redis client + sorted-set + pub/sub helpers
      geo.ts                  # GeoLite2 mmdb lookup
      rule_engine.ts          # evaluate enabled rules per click
      webhook_worker.ts       # BullMQ consumer for webhook deliveries
      handshake.ts            # destination URL verification
    ws/
      server.ts               # WebSocket upgrade handler
      subscriber.ts           # Redis pub/sub → WS fan-out
  client/
    main.tsx                  # React + Vite entry
    pages/
      Home.tsx                # /
      Login.tsx               # /login
      Demo.tsx                # /demo
      Analytics.tsx           # /a/:short
      Rules.tsx               # /a/:short/rules
    components/
      Map.tsx                 # Leaflet wrapper
      TimeSeriesChart.tsx
      CountryBreakdown.tsx
      RecentClicksFeed.tsx
      RuleForm.tsx            # rule create / edit form (4 types)
      FiringsLog.tsx          # delivery log + retry buttons
migrations/
  001_auth_schema.sql         # CREATE SCHEMA auth + users
  002_urls_clicks.sql
  003_rules_firings.sql
  004_sessions.sql
tests/
  unit/
    nanoid.test.ts
    rule_matchers.test.ts     # rule eval against synthetic clicks
    sliding_window.test.ts    # ZADD/ZREMRANGEBYSCORE math
    hmac_sig.test.ts          # webhook signature
    bcrypt.test.ts
  integration/
    shorten.test.ts           # POST /shorten with session
    redirect.test.ts          # GET /:short happy + expired + password-gated
    login.test.ts             # /login happy + bad creds + session expiry
    rule_lifecycle.test.ts    # create rule → handshake → click → webhook delivery
    websocket.test.ts         # dashboard receives click + firing events
```

### Tech stack (locked)

- Node 20, TypeScript strict mode, Express 5
- PostgreSQL 16 (shared infra), Redis 7 (logical DB 1)
- React 18 + Vite, Leaflet for the map, `ws` for WebSockets
- BullMQ for webhook delivery queue
- `bcrypt` for password hashing
- `vitest` + `supertest` for tests
- MaxMind GeoLite2-City.mmdb (free, license-compliant if not redistributed via git)

### What this project should NOT become

- **Don't add user self-signup.** Credentials come from pitchpage's admin only.
  Out-of-band issuance is the whole abuse-prevention story.
- **Don't drop the destination handshake.** It's what prevents shortlive being a
  DDoS amplifier. The whole webhook story falls apart without it.
- **Don't make the redirect endpoint require auth.** It must always work for any
  visitor — that's table stakes for a URL shortener.
- **Don't introduce a state management library.** `useState` + a tiny custom
  EventSource/WebSocket hook is enough for our dashboard.
- **Don't move sessions to Redis "for speed."** Postgres-backed sessions are
  intentional — simpler expiry semantics and easier debugging.
- **Don't add a separate API gateway, BFF, or service mesh.** Express is the API.
- **Don't ship a hosted version of the dashboard.** It's a single Vite SPA served
  by the same Express server — no separate front-end build/deploy.

### Demo mode (`/demo`)

There is exactly one pre-seeded short link with `id = 'demo'`. Its `owner_id` is `NULL`.
A small seeder runs on startup to ensure it exists with:
- A realistic-looking target URL (e.g., a long Wikipedia article)
- A few pre-configured webhook rules (one of each type) pointing at
  `https://webhook.site/...` (a public sink we can replace)
- ~500 seeded historical click rows spread across the past hour, with varied
  countries / devices / referrers
- A lightweight background simulator that adds 1-3 synthetic clicks per minute to
  keep the dashboard visibly live for anonymous viewers

The demo seeder lives in `src/server/seed/demo.ts`. It runs once on startup if the
demo row doesn't exist, then idempotently reseeds clicks if the link's last click
is older than 5 minutes (so the demo never looks stale).
