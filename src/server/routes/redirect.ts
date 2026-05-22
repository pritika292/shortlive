import { Router } from "express";
import { getPool } from "../db/pool.js";
import { verify } from "../services/passwords.js";
import { queueClickLog } from "../services/click_logger.js";
import { extractIp } from "../services/ip.js";

const UNLOCK_COOKIE_PREFIX = "link_unlocked_";
const UNLOCK_TTL_MS = 30 * 60 * 1000;

export const redirectRouter: Router = Router();

interface UrlRow {
  id: string;
  target: string;
  expires_at: Date | null;
  password_hash: string | null;
}

async function loadUrl(short: string): Promise<UrlRow | null> {
  const { rows } = await getPool().query<UrlRow>(
    "SELECT id, target, expires_at, password_hash FROM urls WHERE short = $1",
    [short],
  );
  return rows[0] ?? null;
}

function scheduleClickLog(
  row: UrlRow,
  short: string,
  req: {
    headers: Record<string, string | string[] | undefined>;
    ip?: string;
    socket: { remoteAddress?: string };
  },
): void {
  const ctx = {
    urlId: Number(row.id),
    short,
    ip: extractIp(req),
    userAgent:
      typeof req.headers["user-agent"] === "string" ? req.headers["user-agent"] : undefined,
    referrer: typeof req.headers["referer"] === "string" ? req.headers["referer"] : undefined,
  };
  setImmediate(() => queueClickLog(ctx));
}

function isExpired(row: UrlRow): boolean {
  return row.expires_at !== null && row.expires_at.getTime() <= Date.now();
}

function renderPasswordForm(short: string, error?: string): string {
  const errorBanner = error ? `<p style="color:#b00020;margin:0 0 12px">${error}</p>` : "";
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Password required</title>
  <style>
    body { font: 16px/1.4 system-ui, sans-serif; max-width: 320px; margin: 6rem auto; padding: 0 1rem; }
    label { display:block; margin-bottom:.5rem; }
    input[type=password] { width: 100%; padding:.5rem; box-sizing:border-box; }
    button { margin-top:.75rem; padding:.5rem 1rem; }
  </style>
</head>
<body>
  <h1 style="font-size:1.2rem;margin:0 0 1rem">Password required</h1>
  ${errorBanner}
  <form method="post" action="/${encodeURIComponent(short)}/unlock">
    <label for="password">Enter the link password</label>
    <input id="password" name="password" type="password" autocomplete="off" autofocus required />
    <button type="submit">Continue</button>
  </form>
</body>
</html>`;
}

redirectRouter.get("/:short", async (req, res, next) => {
  const short = req.params.short;
  if (!/^[0-9A-Za-z-]{3,32}$/.test(short)) return next();

  const row = await loadUrl(short);
  if (!row) return res.status(404).json({ error: "not_found" });

  if (isExpired(row)) {
    return res.status(410).json({ error: "gone" });
  }

  if (row.password_hash) {
    const cookieName = `${UNLOCK_COOKIE_PREFIX}${short}`;
    if (req.cookies?.[cookieName] !== "1") {
      res.set("Content-Type", "text/html; charset=utf-8");
      return res.status(401).send(renderPasswordForm(short));
    }
  }

  res.redirect(302, row.target);
  scheduleClickLog(row, short, req);
});

redirectRouter.post("/:short/unlock", async (req, res, next) => {
  const short = req.params.short;
  if (!/^[0-9A-Za-z-]{3,32}$/.test(short)) return next();

  const row = await loadUrl(short);
  if (!row) return res.status(404).json({ error: "not_found" });
  if (isExpired(row)) return res.status(410).json({ error: "gone" });
  if (!row.password_hash) return res.redirect(302, row.target);

  const submitted = (req.body as { password?: string } | undefined)?.password ?? "";
  const ok = await verify(submitted, row.password_hash);
  if (!ok) {
    res.set("Content-Type", "text/html; charset=utf-8");
    return res.status(401).send(renderPasswordForm(short, "Incorrect password"));
  }

  res.cookie(`${UNLOCK_COOKIE_PREFIX}${short}`, "1", {
    httpOnly: true,
    sameSite: "lax",
    maxAge: UNLOCK_TTL_MS,
    path: "/",
  });
  res.redirect(302, row.target);
  scheduleClickLog(row, short, req);
});
