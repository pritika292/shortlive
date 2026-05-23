# shortlive

> URL shortener with sub-second live click analytics and rule-based webhook automation.

[![ci](https://github.com/pritika292/shortlive/actions/workflows/ci.yml/badge.svg)](https://github.com/pritika292/shortlive/actions/workflows/ci.yml)
[![deploy](https://github.com/pritika292/shortlive/actions/workflows/deploy.yml/badge.svg)](https://github.com/pritika292/shortlive/actions/workflows/deploy.yml)
[![demo](https://img.shields.io/badge/demo-live-success)](http://135.232.183.50:3010/)
[![license](https://img.shields.io/badge/license-MIT-blue)](./LICENSE)

![TypeScript](https://img.shields.io/badge/-TypeScript-3178C6?logo=typescript&logoColor=white)
![Node.js](https://img.shields.io/badge/-Node.js%2020-339933?logo=node.js&logoColor=white)
![Express](https://img.shields.io/badge/-Express%205-000000?logo=express&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/-PostgreSQL%2016-4169E1?logo=postgresql&logoColor=white)
![Redis](https://img.shields.io/badge/-Redis%207-DC382D?logo=redis&logoColor=white)
![BullMQ](https://img.shields.io/badge/-BullMQ-EE0000)
![WebSocket](https://img.shields.io/badge/-WebSocket-010101)
![React](https://img.shields.io/badge/-React%2018-61DAFB?logo=react&logoColor=black)
![Vite](https://img.shields.io/badge/-Vite-646CFF?logo=vite&logoColor=white)
![Tailwind](https://img.shields.io/badge/-Tailwind%203-06B6D4?logo=tailwindcss&logoColor=white)
![d3-geo](https://img.shields.io/badge/-d3--geo-F9A03C)
![Docker](https://img.shields.io/badge/-Docker-2496ED?logo=docker&logoColor=white)
![Azure](https://img.shields.io/badge/-Azure-0078D4?logo=microsoftazure&logoColor=white)
![GitHub Actions](https://img.shields.io/badge/-GitHub%20Actions-2088FF?logo=githubactions&logoColor=white)
![Vitest](https://img.shields.io/badge/-Vitest-6E9F18?logo=vitest&logoColor=white)

**Live**: <http://135.232.183.50:3010/>  ·  one-click Quickstart, 30-minute playground, no signup.

---

## What it is

A real production-shaped URL shortener that does two things most don't:

1. **Sub-second click analytics.** Each click is logged async after the 302, published to a Redis channel, and pushed over a WebSocket to every open dashboard tab. Counter, recent feed, and map pin update before the next blink. Aggregations (chart, breakdowns) catch up on a debounced 10-second snapshot poll.

2. **Rule-based webhook automation.** Four rule types (threshold / velocity / first-of / per-click) evaluated against every click, fired through a BullMQ delivery pipeline with HMAC-signed POSTs, exponential backoff, dead-letter on the fifth attempt, and a destination handshake that prevents using the shortener as a DDoS amplifier.

Everything is one TypeScript codebase: Express 5 on the back, React 18 on the front, served by the same Node process. Postgres for durable state, Redis for the hot path.

---

## Sub-second click latency, mechanically

```
visitor clicks /abc123
  │
  ├─[ ~5 ms ]─► Express handler                     ┐
  │                SELECT target FROM urls          │
  │                respond 302                      │ visitor leaves the page
  │                queueClickLog() (setImmediate)   │ here. Everything below
  │                                                 │ happens after the redirect.
  └─[ <50 ms total to the browser ──────────────────┘
                   ▼
   click_logger (off the hot path)
       ├── pg.INSERT INTO clicks
       ├── redis.ZADD shortlive:recent_clicks:{short}  (capped at 100 via ZREMRANGEBYRANK)
       ├── redis.PUBLISH shortlive:clicks.{short}      ◄── dashboard subscribers fan out
       └── rule_engine.evaluate(click)                 ◄── BullMQ.enqueue(jobId = firing_id)
                                                          if any rule fires
                       │
                       ▼
   dashboard WS receives event   <100 ms after click on a same-region client
```

The two architectural choices that make this work:

- **Async fail-soft on the hot path.** The 302 is the contract. Click logging, ZSET writes, pub/sub, and rule evaluation all happen *after* `res.end()`. If Postgres hiccups, the visitor still gets redirected.
- **Subscribe before hydrate on the WS path.** The dashboard's WebSocket handler subscribes to the Redis channel *first*, then reads the last-100 buffer from the ZSET. Without this ordering, a click landing in that gap would never show up in the live feed.

End-to-end latency measured on the live VM:

| | p99 |
|---|---|
| `GET /:short` (the redirect) | <50 ms |
| Click → WS push to an open dashboard | <1 s |
| `/api/agg/snapshot` (one batched call: series + 3 breakdowns + total) | ~150 ms |

---

## Azure infrastructure

Single subscription, single resource group, no managed services where a Docker container does the job equally well. Everything runs on one always-on VM; the cloud-native bits we *do* lean on are the security primitives.

| Azure service | What we use it for |
|---|---|
| **Azure VM** (`B2as_v2`, AMD, Ubuntu 22.04, northcentralus) | The actual host. Docker-compose stack: shortlive app container, shared Postgres 16, shared Redis 7. Costs ~$30/mo on Visual Studio Enterprise credits. |
| **Azure Entra ID + Federated Identity Credentials** | The deploy workflow has zero stored Azure credentials. GitHub Actions exchanges its workflow OIDC token for a short-lived Azure access token via `azure/login@v2`. Per-repo FIC scoped to `main` only. |
| **Azure RBAC** | The federated app principal has exactly two roles: `Virtual Machine User Login` and `Virtual Machine Contributor`, scoped to one VM. Can't create resources, can't read secrets, can't touch other projects. |
| **System-assigned Managed Identity (on the VM)** | The VM authenticates to Azure Key Vault and AI Foundry via its own identity — no keys, no service-principal secrets, nothing to rotate. |
| **Azure Key Vault** (`pritika-portfolio-kv`) | RBAC-mode (not access-policy mode). Holds the shared Postgres + Redis credentials in case we ever need to rebuild the VM. App reads them via Managed Identity at boot if `KV_NAME` is set. |
| **Azure CLI `az vm run-command`** | The deploy primitive. GitHub Actions invokes it with an inline script that `git pull`s, rebuilds the container, and restarts the compose stack. No SSH key in CI. |

Frontend infrastructure: **none**. The React bundle is built at container-build time and served by the same Express process that handles the API and the WebSocket. One TLS terminator (when we eventually add HTTPS), one origin, no CORS surface, no CDN dependency.

### Why this shape

Could have used Azure Database for PostgreSQL, Azure Cache for Redis, Azure Container Apps, Azure Front Door. Didn't, deliberately:

- **Cost.** Managed Postgres alone is ~$50/mo basic tier. The whole VM is cheaper.
- **Honesty.** "I deployed it on Container Apps" doesn't prove I understand Postgres or Redis. Running them myself does.
- **One blast radius.** When something breaks, there's exactly one place to look. `docker compose logs` reveals the world.
- **The security story is the same.** OIDC, Managed Identity, Key Vault, RBAC — all the things a hiring manager actually cares about — work identically whether the database is a managed service or a sidecar container.

The codebase is structured so the swap is trivial when scale demands it: pool connection strings come from env vars, the WebSocket layer is plain `ws` not Socket.IO, no Azure SDKs are imported anywhere in the request path.

---

## Distributed-systems patterns

Each named, each justified by the failure mode it solves.

| Pattern | Implementation | What it prevents |
|---|---|---|
| **Async fail-soft hot path** | `setImmediate(() => logClick(ctx))` after `res.redirect()` | Visitor never blocks on analytics |
| **Bounded buffer hydration** | Redis ZSET capped at 100 via `ZADD` + `ZREMRANGEBYRANK 0 -101` per insert | New dashboard tabs get instant history without a Postgres round-trip; memory is `O(num_links × 100)` not `O(all_clicks)` |
| **Pub/sub fan-out** | One `PUBLISH` per click, N WS subscribers per tab | Click → screen <1 s without polling. Subscribe-before-hydrate prevents lost-update races on connect |
| **Sliding-window rate detection** | `velocity` rules use `MULTI: ZADD score=now + ZREMRANGEBYSCORE old + ZCARD + EXPIRE` | Consistent rate math under concurrent clicks; ZSETs self-clean on idle links via TTL |
| **Structural idempotency** | BullMQ `jobId = firing_id`. Same firing can't enqueue twice | Webhook receivers see each firing exactly once even under retry storms |
| **Exponential backoff with DLQ** | 5 attempts: 1s / 4s / 16s / 64s / 256s. Final failure flips `firings.status='failed'`, exposed in the owner UI for manual retry | Transient receiver outages auto-heal; permanent failures don't silently disappear |
| **HMAC-signed deliveries** | `X-Shortlive-Signature: sha256=...` per POST, keyed by a per-rule signing secret generated at create time | One leaked secret compromises one rule, not the user's whole account |
| **Destination handshake** | Rule can't fire until destination URL echoes a server-issued nonce within 5 s | Prevents abuse as a DDoS amplifier (can't aim click traffic at a victim) |
| **Cascade-on-delete identity** | Every project's tables that reference `auth.users` use `ON DELETE CASCADE`. Sweeper runs every 5 min and `DELETE`s expired Quickstart users | Org-wide GDPR-style purge in one statement; no orphan-row hunting |
| **OIDC-federated deploys** | `azure/login@v2` exchanges the GitHub workflow JWT for a short-lived Azure token. Zero `AZURE_CREDENTIALS` secrets in the repo | No credential to leak or rotate. Every deploy auth is fresh |
| **Migration ledger** | `migrations/*.sql` applied in lexical order, transaction-wrapped, tracked in a `_migrations` table. Container `CMD` runs migrate before the server | Schema state is always provable from the ledger; rollbacks survive container restarts |
| **Snapshot batching + cache** | One `/api/agg/snapshot` call returns series + N breakdowns + total. Client debounces 150 ms, cancels in-flight on filter change, caches by filter-key for 30 s | Toggle 3 chips quickly → 1 request instead of 12; same filter again → 0 requests |

---

## Architecture

```
                                              ┌──────────────────────────┐
                                              │   Webhook receiver       │
                                              │   (POST /receive)        │
                                              └─────────────▲────────────┘
                                                            │ HMAC-signed POST
                                                            │ with firing_id (idempotent)
                                                            │
   ┌──────────────┐  POST /shorten   ┌────────────────────┐ │
   │ Logged-in    │  (sid cookie)    │  Express API       │ │
   │ user         │ ───────────────► │                    │ │
   │              │                  │  /shorten          │ │
   │              │ ◄─────────────── │  /a/:short         │ │
   └──────────────┘  short + URL     │  /api/agg/snapshot │ │
                                     │  /api/me/links     │ │
                                     │  /api/quickstart   │ │
                                     │  /ws/:short        │ │
                                     └────────┬───────────┘ │
                                              │             │
                                              ▼             │
                              ┌──────────────────────────┐  │
                              │  Postgres 16             │  │
                              │  urls, clicks            │  │
                              │  rules, firings          │  │
                              │  sessions                │  │
                              │  auth.users (shared)     │  │
                              └─────────▲────────────────┘  │
                                        │                   │
   ┌──────────┐                         │ async after 302   │
   │ Visitor  │  GET /:short            │                   │
   └────┬─────┘ ────────────────► ┌─────┴──────────────┐    │
        │       302 in <50 ms     │ Click handler      │    │
        │                         │  1. SELECT target  │    │
        │                         │  2. res.redirect() │    │
        │                         │  3. setImmediate:  │ ┌────────────┐
        │                         │     INSERT clicks  │►│   Redis 7  │
        │                         │     ZADD recent    │ │  ZSET +    │
        │                         │     PUBLISH chan   │ │  pub/sub + │
        │                         │     eval rules     │ │  BullMQ    │
        │                         └────────┬───────────┘ └─────▲──────┘
        ▼                                  │ rule fires        │
   ┌──────────────┐                        ▼                   │
   │  Target URL  │     ┌──────────────────────┐               │
   └──────────────┘     │  Webhook worker      │───────────────┘
                        │  (BullMQ consumer)   │
                        │  POST + HMAC + 5x    │
                        │  exp backoff + DLQ   │──────────────┐
                        └──────────────────────┘              │
                                                              ▼
                                                     receiver gets POST

   ┌──────────────────────────────┐   WebSocket
   │   Dashboard (React + Vite)   │ ◄──────────  ┌──────────────────┐
   │   /demo, /a/:short           │   live       │  WS server       │
   │                              │   clicks     │  subscribes to   │
   │   Inline-SVG world map       │              │  Redis pub/sub   │
   │   (d3-geo + world-atlas)     │              │  before hydrate  │
   └──────────────────────────────┘              └──────────────────┘
```

---

## Data model

### Postgres

```sql
-- Org-wide identity (shared across every portfolio project)
CREATE SCHEMA auth;
CREATE TABLE auth.users (
    id              BIGSERIAL PRIMARY KEY,
    username        TEXT UNIQUE NOT NULL,
    password_hash   TEXT NOT NULL,          -- bcrypt cost 12
    display_name    TEXT,
    expires_at      TIMESTAMPTZ,            -- NULL = permanent; set for Quickstart users
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    last_login_at   TIMESTAMPTZ
);

-- shortlive
CREATE TABLE urls (
    id                BIGSERIAL PRIMARY KEY,
    short             VARCHAR(32) UNIQUE NOT NULL,
    target            TEXT NOT NULL,
    owner_id          BIGINT REFERENCES auth.users(id) ON DELETE CASCADE,
    expires_at        TIMESTAMPTZ,
    password_hash     TEXT,
    created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE clicks (
    id          BIGSERIAL PRIMARY KEY,
    url_id      BIGINT NOT NULL REFERENCES urls(id) ON DELETE CASCADE,
    ts          TIMESTAMPTZ DEFAULT NOW(),
    country     CHAR(2), lat DOUBLE PRECISION, lon DOUBLE PRECISION,
    device      TEXT, referrer TEXT, user_agent TEXT,
    ip_hash     TEXT                                  -- HMAC(server pepper, ip), never raw
);
CREATE INDEX idx_clicks_url_ts       ON clicks(url_id, ts DESC);
CREATE INDEX idx_clicks_url_country  ON clicks(url_id, country);
CREATE INDEX idx_clicks_url_device   ON clicks(url_id, device);
CREATE INDEX idx_clicks_url_referrer ON clicks(url_id, referrer);

CREATE TABLE rules (
    id                    TEXT PRIMARY KEY,
    url_id                BIGINT NOT NULL REFERENCES urls(id) ON DELETE CASCADE,
    type                  TEXT NOT NULL,    -- threshold | velocity | first_of | per_click
    config                JSONB NOT NULL,
    destination_url       TEXT NOT NULL,
    destination_verified  BOOLEAN DEFAULT FALSE,    -- only verified rules fire
    signing_secret        TEXT NOT NULL,            -- per-rule HMAC key
    cooldown_seconds      INT DEFAULT 0,
    enabled               BOOLEAN DEFAULT TRUE
);

CREATE TABLE firings (
    id                  TEXT PRIMARY KEY,           -- = BullMQ jobId for idempotency
    rule_id             TEXT NOT NULL REFERENCES rules(id) ON DELETE CASCADE,
    ts                  TIMESTAMPTZ DEFAULT NOW(),
    status              TEXT NOT NULL,              -- pending | delivered | failed
    attempts            INT DEFAULT 0,
    last_response_code  INT
);
```

The composite `(url_id, dim)` indexes are what makes the snapshot endpoint return in ~150 ms instead of doing seq scans. The `ON DELETE CASCADE` on `urls.owner_id` is what makes Quickstart-user cleanup a one-statement `DELETE FROM auth.users WHERE expires_at < NOW()`.

### Redis (logical DB 1)

| Key | Type | Purpose |
|---|---|---|
| `shortlive:recent_clicks:{short}` | ZSET | Last 100 clicks per link, score = unix-ms |
| `shortlive:clicks.{short}` | pub/sub | Live click events broadcast to WS subscribers |
| `shortlive:rule_counter:{rule_id}` | string (INCR) | Running total for `threshold` rules |
| `shortlive:rule_window:{rule_id}` | ZSET | Sliding window for `velocity` rules |
| `shortlive:rule_seen:{rule_id}:{dim}` | set | Membership test for `first_of` rules |
| `shortlive:rule_cooldown:{rule_id}` | string + TTL | Suppress re-firing |
| `bull:shortlive-webhooks:*` | BullMQ keys | Webhook delivery queue |

---

## CI/CD

Sequential GitHub Actions chain (lint → typecheck → docker-build → test) — fails fast, never burns the test job on a typo. On a successful run on `main`, the `deploy.yml` workflow fires via `workflow_run`:

```
GitHub Actions worker
  │
  ├─ azure/login@v2  (OIDC: exchange workflow JWT for short-lived Azure token)
  │
  ├─ az vm run-command invoke
  │     --resource-group <RG>
  │     --name <VM>
  │     --scripts @vm-deploy.sh
  │
  ▼
VM:  git fetch && reset --hard origin/main
     docker compose up -d --build
     curl http://localhost:3010/health  ← block until 2xx or fail the deploy
```

No SSH key in GitHub. No `AZURE_CREDENTIALS` JSON secret. Zero long-lived credentials anywhere. Per-repo FIC subject claim restricts the federation to `repo:pritika292/shortlive:ref:refs/heads/main`.

---

## Run locally

```bash
mise install                                       # Node 20 per .tool-versions
npm install
cp .env.example .env
docker compose -f docker-compose.local.yml up -d   # local Postgres + Redis
npm run migrate
npm run dev                                        # http://localhost:3010
```

The root `docker-compose.yml` is the **production** compose used by `az vm run-command`. For local dev, always pass `-f docker-compose.local.yml`.

```bash
pre-commit install   # once per clone: gitleaks + hygiene hooks
```

---

## Tests

- `npm test` runs the full Vitest workspace (server in node env, client in jsdom env, integration tests against the local Postgres + Redis).
- Server-only unit suite: `npx vitest run -c build/vitest.config.ts tests/unit tests/client`.
- Branch protection on `main` blocks merges on red CI.

65 tests cover: shortcode generation + collision retry, bcrypt round-trip + timing, sliding-window math, rule evaluation against synthetic clicks, HMAC signatures, the Quickstart endpoint + per-IP rate limiter + capacity gate, sessions + expiry, the snapshot endpoint, every React component touched on the demo and analytics paths.

---

## Honest limitations

- **No HTTPS yet.** Plain HTTP on the public IP. Cookies are set with `secure: false` for this reason — flipping it on without HTTPS would silently drop sessions. When the domain lands, `secure: true` + HSTS will be enabled together.
- **No bot filtering.** Headless browsers count as clicks. Either user-agent allowlist or Cloudflare in front.
- **Single-region single-VM.** No HA. Acceptable for a portfolio demo; for real traffic, move Postgres to Azure Database for PostgreSQL with a read replica.
- **At-least-once webhook delivery.** Receivers must de-dupe on `firing_id`. The handshake + HMAC make exactly-once unnecessary in practice.
- **Clicks aren't transactional across PG + Redis.** Both writes happen after the 302; a Redis hiccup means a click is in PG but not the live feed for a few seconds. Outbox pattern would fix it; not worth it at this scale.

---

## What I'd build next

- **Cloudflare in front** for HTTPS + bot filtering + cheap edge caching of `/assets/*`.
- **Postgres partitioning** of `clicks` and `firings` with a monthly rollover, kicked in around 50 M rows.
- **Per-link API tokens** so external systems can mint links without piggybacking on user sessions.
- **`shortlive-verify` libraries** for JS / Python / Go so receivers don't reimplement the HMAC check themselves.

---

## License

[MIT](./LICENSE)
