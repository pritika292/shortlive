import { getPool } from "../db/pool.js";
import { getRedis, recentClicksKey } from "../services/redis.js";

const DEMO_SHORT = "demo";
const DEMO_TARGET = "https://en.wikipedia.org/wiki/Distributed_computing";

interface DemoRuleSeed {
  id: string;
  type: "threshold" | "velocity" | "first_of";
  config: Record<string, unknown>;
  destinationUrl: string;
  cooldownSeconds: number;
}

const DEMO_RULES: DemoRuleSeed[] = [
  {
    id: "demo-threshold",
    type: "threshold",
    config: { count: 500 },
    destinationUrl: "https://webhook.site/00000000-demo-threshold",
    cooldownSeconds: 0,
  },
  {
    id: "demo-velocity",
    type: "velocity",
    config: { count: 50, window_seconds: 60 },
    destinationUrl: "https://webhook.site/00000000-demo-velocity",
    cooldownSeconds: 300,
  },
  {
    id: "demo-first-of-country",
    type: "first_of",
    config: { dimension: "country" },
    destinationUrl: "https://webhook.site/00000000-demo-first-of",
    cooldownSeconds: 0,
  },
];

async function urlId(): Promise<number | null> {
  const { rows } = await getPool().query<{ id: string }>("SELECT id FROM urls WHERE short = $1", [
    DEMO_SHORT,
  ]);
  return rows[0] ? Number(rows[0].id) : null;
}

async function seedDemoRules(urlIdValue: number): Promise<void> {
  for (const r of DEMO_RULES) {
    await getPool().query(
      `INSERT INTO rules(id, url_id, type, config, destination_url,
                         destination_verified, cooldown_seconds, signing_secret)
       VALUES($1, $2, $3, $4, $5, FALSE, $6, $7)
       ON CONFLICT (id) DO NOTHING`,
      [
        r.id,
        urlIdValue,
        r.type,
        JSON.stringify(r.config),
        r.destinationUrl,
        r.cooldownSeconds,
        "demo-placeholder-signing-secret",
      ],
    );
  }
}

export interface SeedResult {
  created: boolean;
  reseeded: boolean;
  totalClicks: number;
}

// The /demo dashboard runs entirely client-side now (see issue #117): the
// browser holds a small in-memory simulation so the page feels snappy and we
// don't pay a VM round-trip for chip toggles or burst clicks.
//
// What we still need server-side:
//  - the `urls` row so /demo redirects to the wikipedia target
//  - the rule rows so the rules tab on /demo has content to show
//  - the Redis ZSET wipe so any stale null-country entries from earlier
//    deploys aren't lingering
//
// Everything else (historical click rows, the background simulator) is gone.
export async function seedDemo(): Promise<SeedResult> {
  let id = await urlId();
  let created = false;

  if (id === null) {
    const { rows } = await getPool().query<{ id: string }>(
      `INSERT INTO urls(short, target, owner_id) VALUES($1, $2, NULL) RETURNING id`,
      [DEMO_SHORT, DEMO_TARGET],
    );
    const inserted = rows[0];
    if (!inserted) throw new Error("demo INSERT returned no row");
    id = Number(inserted.id);
    created = true;
  }

  // Drop any historical click rows the previous deploys may have left behind.
  await getPool().query("DELETE FROM clicks WHERE url_id = $1", [id]);
  await getRedis().del(recentClicksKey(DEMO_SHORT));
  await seedDemoRules(id);

  return { created, reseeded: true, totalClicks: 0 };
}
