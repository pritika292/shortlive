import { UAParser } from "ua-parser-js";
import { getPool } from "../db/pool.js";
import { lookup } from "./geo.js";
import { hashIp } from "./ip.js";

export interface ClickContext {
  urlId: number;
  ip: string;
  userAgent: string | undefined;
  referrer: string | undefined;
}

function deviceFromUa(ua: string | undefined): string | null {
  if (!ua) return null;
  const parsed = new UAParser(ua).getResult();
  return parsed.device.type ?? "desktop";
}

const pending: Set<Promise<unknown>> = new Set();

export async function logClick(ctx: ClickContext): Promise<void> {
  const geo = lookup(ctx.ip);
  const ipHash = hashIp(ctx.ip);
  const device = deviceFromUa(ctx.userAgent);
  await getPool().query(
    `INSERT INTO clicks(url_id, country, lat, lon, user_agent, device, referrer, ip_hash)
       VALUES($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      ctx.urlId,
      geo.country,
      geo.lat,
      geo.lon,
      ctx.userAgent ?? null,
      device,
      ctx.referrer ?? null,
      ipHash,
    ],
  );
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
