# shortlive

URL shortener with sub-second live analytics and rule-based webhook automation.

> **Demo**: a pre-seeded link is live at `/demo` once deployed.
> **Repo**: [github.com/pritika292/shortlive](https://github.com/pritika292/shortlive)

---

## What it does

Two things most URL shorteners don't do:

1. **Sub-second click analytics.** Every click is pushed to the dashboard over a
   WebSocket — counter, map pin, time-series, breakdowns all update without polling.
   Most shorteners refresh analytics every 15–60 seconds, which is useless for
   reacting in real time.

2. **Rule-based webhook automation.** Configure per-link rules. shortlive POSTs to
   your endpoint when the rule fires.
   - `threshold` — fire once when total clicks crosses N
   - `velocity` — fire when ≥ N clicks arrive within a T-second sliding window,
     optionally filtered by country / referrer / device
   - `first_of` — fire on the first click matching each new dimension value (e.g.,
     each new country to click your link)
   - `per_click` — fire on every click matching filter criteria

Both halves on top of a straightforward redirect path that returns `302` first and
logs the click asynchronously, so the user is never blocked on analytics.

---

## Access model

| Surface | Public or login-gated? |
|---|---|
| `/` homepage and `/demo` (seeded demo dashboard) | Public |
| `/:short` (the actual redirect — always works) | Public |
| `/login` (form) and `/logout` | Public |
| `/shorten` (create a link) | Login required |
| `/a/:short` (analytics for your own link) | Login + must own the link |
| `/a/:short/rules` (rule management) | Login + must own the link |
| `/api/firings/:rule_id` (delivery log) | Login + must own the rule |

Credentials are issued out-of-band — there's no self-serve signup. The same
username + password works across every project using this shared auth (one
`auth.users` table on the host Postgres instance). **If you've received an
invite, see the email for your username and password.**

The redirect endpoint is always public, because that's the whole point of a URL
shortener; everything that mutates state requires authentication.

---

## Architecture

```
                                              ┌──────────────────────────┐
                                              │   Your webhook receiver  │
                                              │   (POST /receive)        │
                                              └─────────────▲────────────┘
                                                            │ HTTP POST (rule fired)
                                                            │ payload includes
                                                            │ firing_id for idempotency
                                                            │
   ┌──────────────┐  POST /shorten  ┌────────────────────┐  │
   │ Logged-in    │  (session       │  Express API       │  │
   │ user         │   cookie)       │                    │  │
   │              │ ──────────────► │  - /shorten        │  │
   │              │ ◄────────────── │  - /login /logout  │  │
   └──────────────┘  short + URL    │  - /a/:short/rules │  │
                                    │  - dashboard data  │  │
                                    └────────┬───────────┘  │
                                             │ INSERT urls  │
                                             ▼              │
                                    ┌────────────────────┐  │
                                    │  Postgres (shared) │  │
                                    │  urls              │  │
                                    │  clicks            │  │
                                    │  rules             │  │
                                    │  firings           │  │
                                    │  sessions          │  │
                                    │  auth.users        │  │  ← shared across all
                                    │                    │  │     projects in this org
                                    └────────▲───────────┘  │
                                             │              │
   ┌──────────┐                               │ logs click   │
   │ Visitor  │  GET /:short                  │              │
   └────┬─────┘ ─────────────────────────►    │              │
        │                                     │              │
        │       ┌─────────────────────────────┴────────┐     │
        │       │ Click handler                        │     │
        │       │  1. SELECT target FROM urls          │     │
        │       │  2. Return 302 (fast path)           │     │
        │       │  3. async, after the redirect:       │     │
        │       │     - INSERT clicks                  │     │
        │       │     - ZADD recent_clicks (ZSET)      │ ┌────────────┐
        │       │     - PUBLISH clicks.<short>         │►│   Redis    │
        │       │     - evaluate rules                 │ │  ZSET +    │
        │       │     - enqueue webhook jobs           │ │  pub/sub + │
        │       └──────────────┬───────────────────────┘ │  BullMQ    │
        │ 302                  │                         └─────▲──────┘
        ▼                      │ if a rule matches             │
   ┌──────────────┐            ▼                               │
   │  Target URL  │   ┌─────────────────────┐                  │ delivery
   │              │   │  Webhook worker     │──────────────────┘ status
   └──────────────┘   │  (BullMQ consumer)  │
                      │  - POST destination │──────────────┐
                      │  - retry x5 expo    │              │ POST
                      │  - DLQ on failure   │              │ to user's URL
                      │  - update PG        │              │
                      └─────────────────────┘              ▼
                                                       (the receiver)

   ┌──────────────────────────────┐   WebSocket
   │   Dashboard (React + Vite)   │ ◄──────────  ┌──────────────────┐
   │   /demo or /a/:short         │   live       │  WS server       │
   │   - live counter             │   click +    │  subscribes to   │
   │   - map (Leaflet, OSM tiles) │   delivery   │  Redis pub/sub   │
   │   - clicks/min chart         │   events     └──────────────────┘
   │   - country/ref/device       │
   │   - recent-clicks feed       │
   │   - (owner) rule manager     │
   └──────────────────────────────┘
```

### How a rule evaluates

```
   Click event arrives
        │
        ▼
   ┌────────────────────────────────────────────────────┐
   │ For each enabled rule on this short link:          │
   │                                                    │
   │   threshold → INCR shortlive:rule_counter:<id>;    │
   │               fire if value == config.count        │
   │                                                    │
   │   velocity  → ZADD shortlive:rule_window:<id>      │
   │                  score=now, member=click_id;       │
   │               ZREMRANGEBYSCORE old entries;        │
   │               ZCARD;                               │
   │               fire if ≥ count AND not in cooldown  │
   │                                                    │
   │   first_of  → SADD shortlive:rule_seen:<id>:<dim>; │
   │               fire if SADD returned 1 (new)        │
   │                                                    │
   │   per_click → if click matches config.filters →    │
   │               fire                                 │
   │                                                    │
   │   On fire:                                         │
   │     INSERT firings row in PG with new firing_id    │
   │     Enqueue BullMQ job with jobId = firing_id      │
   │       (BullMQ de-dupes on jobId, so the same       │
   │        firing is never sent twice even on retries) │
   └────────────────────────────────────────────────────┘
```

### How a webhook delivers

```
   BullMQ worker picks up a job (firing_id)
        │
        ▼
   ┌────────────────────────────────────────────────────┐
   │  1. SELECT rule, firing FROM PG (verify state)     │
   │                                                    │
   │  2. If rule.destination_verified == false:         │
   │     mark firing 'failed', DO NOT POST              │
   │                                                    │
   │  3. POST destination_url with payload:             │
   │     { firing_id, rule_id, short, type, ts,        │
   │       matched_clicks: [...] }                      │
   │     Header: X-Shortlive-Signature: HMAC-SHA256     │
   │                                                    │
   │  4. On 2xx within 10s:                             │
   │     UPDATE firings SET status='delivered'          │
   │                                                    │
   │  5. On non-2xx or timeout:                         │
   │     UPDATE firings SET attempts = attempts + 1,    │
   │       last_response_code, last_error               │
   │     If attempts < 5:                               │
   │       re-queue with backoff (1s, 4s, 16s, 64s,     │
   │       256s)                                        │
   │     Else:                                          │
   │       status='failed' → visible in owner DLQ UI    │
   │       for manual retry                             │
   └────────────────────────────────────────────────────┘
```

### Destination verification (handshake)

When a rule is created (or its destination URL changes), shortlive POSTs a one-time
nonce to the destination and expects the same nonce echoed back in the response body
within 5 seconds. Until verified, the rule won't fire. This prevents shortlive being
abused as a DDoS amplifier — you can't point a rule at a victim's URL and use real
click traffic to flood it.

---

## Data model

### Postgres

```sql
-- Shared across all projects, lives in the auth schema
CREATE SCHEMA IF NOT EXISTS auth;
CREATE TABLE auth.users (
    id              BIGSERIAL PRIMARY KEY,
    username        TEXT UNIQUE NOT NULL,
    password_hash   TEXT NOT NULL,                -- bcrypt
    display_name    TEXT,
    company         TEXT,
    email           TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    expires_at      TIMESTAMPTZ,
    last_login_at   TIMESTAMPTZ
);
CREATE INDEX idx_creds_username ON auth.users(username);

-- shortlive-specific
CREATE TABLE urls (
    id                BIGSERIAL PRIMARY KEY,
    short             VARCHAR(32) UNIQUE NOT NULL,    -- nanoid or vanity slug
    target            TEXT NOT NULL,
    owner_id          BIGINT REFERENCES auth.users(id),
    expires_at        TIMESTAMPTZ,                    -- NULL = never
    password_hash     TEXT,                           -- NULL = no password gate
    created_at        TIMESTAMPTZ DEFAULT NOW(),
    created_ip_hash   TEXT                            -- hashed, never raw
);
CREATE INDEX idx_urls_short ON urls(short);

CREATE TABLE clicks (
    id          BIGSERIAL PRIMARY KEY,
    url_id      BIGINT NOT NULL REFERENCES urls(id) ON DELETE CASCADE,
    ts          TIMESTAMPTZ DEFAULT NOW(),
    country     CHAR(2),
    lat         DOUBLE PRECISION,
    lon         DOUBLE PRECISION,
    user_agent  TEXT,
    device      TEXT,                                 -- parsed from UA
    referrer    TEXT,
    ip_hash     TEXT
);
CREATE INDEX idx_clicks_url_ts ON clicks(url_id, ts DESC);

CREATE TABLE rules (
    id                    TEXT PRIMARY KEY,           -- nanoid
    url_id                BIGINT NOT NULL REFERENCES urls(id) ON DELETE CASCADE,
    type                  TEXT NOT NULL,               -- threshold|velocity|first_of|per_click
    config                JSONB NOT NULL,
    destination_url       TEXT NOT NULL,
    destination_verified  BOOLEAN DEFAULT FALSE,
    verification_attempts INT DEFAULT 0,
    cooldown_seconds      INT DEFAULT 0,
    enabled               BOOLEAN DEFAULT TRUE,
    created_at            TIMESTAMPTZ DEFAULT NOW(),
    last_fired_at         TIMESTAMPTZ
);
CREATE INDEX idx_rules_url ON rules(url_id);

CREATE TABLE firings (
    id                  TEXT PRIMARY KEY,              -- = BullMQ jobId, for idempotency
    rule_id             TEXT NOT NULL REFERENCES rules(id) ON DELETE CASCADE,
    ts                  TIMESTAMPTZ DEFAULT NOW(),
    click_id            BIGINT REFERENCES clicks(id),  -- NULL for aggregate rules
    matched             JSONB,
    status              TEXT NOT NULL,                 -- pending|delivered|failed
    attempts            INT DEFAULT 0,
    last_attempt        TIMESTAMPTZ,
    last_response_code  INT,
    last_error          TEXT
);
CREATE INDEX idx_firings_rule_ts ON firings(rule_id, ts DESC);

CREATE TABLE sessions (
    sid           TEXT PRIMARY KEY,
    user_id       BIGINT NOT NULL REFERENCES auth.users(id),
    created_at    TIMESTAMPTZ DEFAULT NOW(),
    expires_at    TIMESTAMPTZ NOT NULL,
    last_seen     TIMESTAMPTZ DEFAULT NOW()
);
```

`clicks` will be partitioned monthly once it grows past ~50M rows. Until then,
a single table with `idx_clicks_url_ts` is fine.

### Redis (logical DB 1)

| Key | Type | What it holds |
|---|---|---|
| `shortlive:recent_clicks:{short}` | sorted set | Last 100 clicks per link, score = unix-ms ts |
| `shortlive:clicks.{short}` | pub/sub channel | Live click events for dashboard subscribers |
| `shortlive:rule_counter:{rule_id}` | string (INCR) | Running total for `threshold` rules |
| `shortlive:rule_window:{rule_id}` | sorted set | Sliding window for `velocity` rules |
| `shortlive:rule_seen:{rule_id}:{dimension}` | set | Membership test for `first_of` rules |
| `shortlive:rule_cooldown:{rule_id}` | string + TTL | Suppress re-firing during cooldown |
| `bull:shortlive-webhooks:*` | BullMQ-managed | Webhook delivery job queue |

---

## Tech stack

- **Node.js 20 + TypeScript (strict mode)** — single language across server and client.
- **Express 5** — minimal, no surprises. Fastify would shave latency that isn't our
  bottleneck.
- **PostgreSQL 16** — durable storage on the shared Postgres instance.
- **Redis 7** — sorted sets and pub/sub are the killer features here; sub-millisecond
  reads and bounded memory via `allkeys-lru`.
- **BullMQ** — Redis-backed job queue for webhook delivery. Built-in exponential
  backoff and jobId-based de-duplication.
- **`ws`** — bare WebSocket library, no framework wrappers.
- **React 18 + Vite** — fast HMR, no SSR overhead.
- **Leaflet + OpenStreetMap tiles** — no API key, no per-request cost.
- **`maxmind-db`** — local GeoLite2-City.mmdb lookup; no external API call per click.
- **`bcrypt`** — for `users.password_hash` and `urls.password_hash`.
- **`vitest` + `supertest`** — unit and integration tests; runs against a real
  Postgres + Redis from `docker-compose.test.yml`.

---

## Run locally

```bash
mise install                                    # Node 20 per .tool-versions
npm install
cp .env.example .env

docker compose -f docker-compose.local.yml up -d   # local Postgres + Redis
npm run migrate                                  # create schemas + tables
npm run dev                                      # http://localhost:3010
```

The root `docker-compose.yml` is the **production** compose (used by the VM
deploy). For local development, always pass `-f docker-compose.local.yml`.

When committing for the first time after cloning:
```bash
pre-commit install              # one-time per clone; enables gitleaks + hygiene hooks
```

---

## Project layout

```
src/
  server/           Express app, routes, services, ws, seeders
  client/           React + Vite SPA (pages, components, hooks)
migrations/         Hand-rolled .sql files applied in lexical order
tests/
  unit/             Node-env Vitest tests (services, helpers)
  integration/      Node-env tests against the docker-compose Postgres + Redis
  client/           Jsdom-env Vitest + Testing Library component tests
scripts/            Operational scripts (bootstrap-vm.sh, seed-user.ts)
build/              Build-tooling configs (Vite, Vitest, Tailwind, PostCSS)
docs/               PLAN.md, PROGRESS.md, long-form docs
.github/workflows/  CI + deploy pipelines
```

Build-tooling configs live in `build/`. npm scripts pass `-c build/<file>` to
each tool so the root stays uncluttered.

The configs that **stay** at the root are the ones their tool requires there
for default discovery (and editor integration in the case of TS and ESLint):

| File | Tool | Why at root |
|---|---|---|
| `tsconfig.json`, `tsconfig.build.json` | TypeScript | IDE Intellisense + default discovery |
| `eslint.config.js` | ESLint flat config | IDE integration |
| `Dockerfile`, `docker-compose.yml` | Docker | `deploy.sh` expects them here |
| `docker-compose.local.yml` | Docker (dev only) | Sibling of the prod compose |
| `.pre-commit-config.yaml`, `.editorconfig`, `.tool-versions` | dev tooling | Default discovery |

Prettier config is inlined in `package.json#prettier` to keep one fewer file
at the root.

---

## Tests

> CI workflow lands with the first code PR. Until then this section will read "pending."

Plan:
- **Unit tests** (`vitest`): shortcode generation, sliding-window math, password hashing,
  rule matching against synthetic click payloads, HMAC signature.
- **Integration tests** (`vitest + supertest` against a real Postgres + Redis): full
  flow tests covering `POST /shorten`, `GET /:short` (incl. expired and password-gated
  links), `/login` happy + sad paths, rule create → click → webhook delivery,
  destination handshake.

`main` is branch-protected to block merges on red CI.

---

## Performance characteristics

> Not yet measured. The targets below describe what the design supports; actual
> numbers go here after benchmarking.

| Endpoint | p99 target | Notes |
|---|---|---|
| `POST /shorten` | <30ms | One PG insert + nanoid generation |
| `GET /:short` | <50ms | One PG read; logging is fully async after 302 |
| Webhook firing latency | <500ms click → POST | Synchronous rule eval; BullMQ job enqueued before redirect returns |
| WebSocket push | <100ms click → dashboard | Pub/sub fan-out on a single Redis instance |

Capacity, given the shared B2as_v2 host (2 vCPU AMD, 8 GB RAM): low thousands of
clicks per second before Postgres connection pool saturates. Throughput-bound by PG
inserts, not by the Node process.

---

## Limitations and honest scope

- **No rate limiting yet.** A logged-in user with bad intent could create thousands
  of links or spam clicks on their own. First-priority addition for production.
- **No bot filtering.** Headless browsers count as clicks. A real product would
  user-agent-allowlist or put Cloudflare in front.
- **GeoLite2 is best-effort.** IPs behind corporate VPNs report the exit node.
- **Single Postgres instance.** No replica, no failover. Acceptable for this scope;
  for real traffic, move PG to Azure Database for PostgreSQL with a read replica.
- **Webhook delivery is at-least-once, not exactly-once.** Receivers must use the
  `firing_id` to de-dupe.
- **Clicks are not transactional across PG + Redis.** Both writes happen after the
  302; in the rare case of a Redis hiccup, a click may be in PG but not in the live
  feed for up to a few seconds. Outbox pattern would fix this; not worth it at this
  scope.
- **Sessions live in Postgres, not Redis.** Slightly slower per-request validation;
  simpler reasoning about expiry and multi-replica safety.

---

## What I'd do next

1. **Per-user rate limiting** with a Redis token bucket keyed by user + endpoint.
2. **Bot filtering** as a configurable rule type (`exclude_bots: true` on dashboards).
3. **Per-link API tokens** so external systems can mint links programmatically without
   reusing user sessions.
4. **Postgres partitioning of `clicks` and `firings`** with a monthly rollover.
5. **Webhook signature verification helper libraries** in JS/Python/Go so receivers
   don't reimplement HMAC verification themselves.

---

## Status

| | |
|---|---|
| Code | scaffolding only (this commit) |
| Tests | pending |
| CI | pending |
| Deployed | pending |
| README | done |
