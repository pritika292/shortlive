import { UAParser } from "ua-parser-js";
import { getPool } from "../db/pool.js";
import { lookup } from "./geo.js";
import { hashIp } from "./ip.js";
import { recordClickEvent } from "./redis.js";
import { evaluateRulesForClick } from "./rule_engine.js";

export interface ClickContext {
  urlId: number;
  short: string;
  ip: string;
  userAgent: string | undefined;
  referrer: string | undefined;
  // Synthetic sources (simulator, seeder) pass an override so the click row
  // has a real country even without GeoLite2 installed on the host.
  geoOverride?: { country: string | null; lat: number | null; lon: number | null };
}

function deviceFromUa(ua: string | undefined): string | null {
  if (!ua) return null;
  const parsed = new UAParser(ua).getResult();
  return parsed.device.type ?? "desktop";
}

const pending: Set<Promise<unknown>> = new Set();

export async function logClick(ctx: ClickContext): Promise<void> {
  const geo = ctx.geoOverride ?? lookup(ctx.ip);
  const ipHash = hashIp(ctx.ip);
  const device = deviceFromUa(ctx.userAgent);
  const ts = Date.now();
  const pg = getPool();
  const {
    rows: [inserted],
  } = await pg.query<{ id: string }>(
    `INSERT INTO clicks(url_id, ts, country, lat, lon, user_agent, device, referrer, ip_hash)
       VALUES($1, to_timestamp($2 / 1000.0), $3, $4, $5, $6, $7, $8, $9)
     RETURNING id`,
    [
      ctx.urlId,
      ts,
      geo.country,
      geo.lat,
      geo.lon,
      ctx.userAgent ?? null,
      device,
      ctx.referrer ?? null,
      ipHash,
    ],
  );
  const clickId = inserted ? Number(inserted.id) : undefined;
  await recordClickEvent(ctx.short, {
    ts,
    country: geo.country,
    lat: geo.lat,
    lon: geo.lon,
    device,
    referrer: ctx.referrer ?? null,
  });
  await evaluateRulesForClick({
    short: ctx.short,
    click: {
      ...ctx,
      country: geo.country,
      device,
      clickId,
    },
  });
}

export function queueClickLog(ctx: ClickContext): void {
  const promise = (async () => {
    try {
      await logClick(ctx);
    } catch (err) {
      console.error("click log failed", err);
    }
  })();
  pending.add(promise);
  void promise.finally(() => pending.delete(promise));
}

export async function drainClickLogs(): Promise<void> {
  while (pending.size > 0) {
    await Promise.allSettled([...pending]);
  }
}
