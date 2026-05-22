import { Router } from "express";
import { randomBytes } from "node:crypto";
import { customAlphabet } from "nanoid";
import { getPool } from "../db/pool.js";
import { requireLogin } from "../middleware/session.js";
import { requireOwner } from "../middleware/requireOwner.js";
import { RuleBody, RulePatchBody } from "../services/rule_schemas.js";
import { verifyRuleDestination } from "../services/handshake.js";
import { getWebhookQueue } from "../services/queue.js";
import { WORKER_OPTS } from "../services/webhook_worker.js";

export const rulesRouter: Router = Router();

const ruleId = customAlphabet("0123456789abcdefghijklmnopqrstuvwxyz", 16);

interface RuleRow {
  id: string;
  url_id: string;
  type: string;
  config: unknown;
  destination_url: string;
  destination_verified: boolean;
  verification_attempts: number;
  last_verification_error: string | null;
  cooldown_seconds: number;
  enabled: boolean;
  created_at: Date;
  last_fired_at: Date | null;
}

function serializeRule(r: RuleRow): Record<string, unknown> {
  return {
    id: r.id,
    type: r.type,
    config: r.config,
    destination_url: r.destination_url,
    destination_verified: r.destination_verified,
    verification_attempts: r.verification_attempts,
    last_verification_error: r.last_verification_error,
    cooldown_seconds: r.cooldown_seconds,
    enabled: r.enabled,
    created_at: r.created_at.toISOString(),
    last_fired_at: r.last_fired_at ? r.last_fired_at.toISOString() : null,
  };
}

rulesRouter.get("/api/links/:short/rules", requireLogin, requireOwner, async (req, res) => {
  const owned = req.ownedUrl;
  if (!owned) return res.status(500).json({ error: "missing_owned_url" });
  const { rows } = await getPool().query<RuleRow>(
    "SELECT * FROM rules WHERE url_id = $1 ORDER BY created_at DESC",
    [owned.id],
  );
  return res.json({ rules: rows.map(serializeRule) });
});

rulesRouter.post("/api/links/:short/rules", requireLogin, requireOwner, async (req, res) => {
  const owned = req.ownedUrl;
  if (!owned) return res.status(500).json({ error: "missing_owned_url" });
  const parsed = RuleBody.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error: "invalid_request",
      issues: parsed.error.issues.map((i) => ({ path: i.path, message: i.message })),
    });
  }
  const data = parsed.data;
  const id = ruleId();
  const signingSecret = randomBytes(32).toString("hex");
  const { rows } = await getPool().query<RuleRow>(
    `INSERT INTO rules(id, url_id, type, config, destination_url,
                       cooldown_seconds, enabled, signing_secret)
       VALUES($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [
      id,
      owned.id,
      data.type,
      JSON.stringify(data.config),
      data.destination_url,
      data.cooldown_seconds,
      data.enabled,
      signingSecret,
    ],
  );
  const row = rows[0];
  if (!row) throw new Error("INSERT returned no row");

  // Best-effort handshake. Failure is non-fatal: the rule remains
  // destination_verified=false and rules cannot fire until manually re-verified.
  verifyRuleDestination(row.id).catch((err) => {
    console.error("auto-handshake failed for rule", row.id, err);
  });

  return res.json({ rule: serializeRule(row) });
});

rulesRouter.patch("/api/links/:short/rules/:id", requireLogin, requireOwner, async (req, res) => {
  const owned = req.ownedUrl;
  if (!owned) return res.status(500).json({ error: "missing_owned_url" });
  const parsed = RulePatchBody.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "invalid_request" });
  }
  const ruleIdParam = typeof req.params.id === "string" ? req.params.id : "";
  if (!ruleIdParam) return res.status(400).json({ error: "invalid_request" });

  const updates: string[] = [];
  const values: unknown[] = [];
  let i = 1;
  if (parsed.data.destination_url !== undefined) {
    updates.push(`destination_url = $${i++}`);
    values.push(parsed.data.destination_url);
    updates.push(`destination_verified = FALSE`);
    updates.push(`verification_attempts = 0`);
  }
  if (parsed.data.cooldown_seconds !== undefined) {
    updates.push(`cooldown_seconds = $${i++}`);
    values.push(parsed.data.cooldown_seconds);
  }
  if (parsed.data.enabled !== undefined) {
    updates.push(`enabled = $${i++}`);
    values.push(parsed.data.enabled);
  }
  if (updates.length === 0) return res.status(400).json({ error: "no_fields" });

  values.push(owned.id, ruleIdParam);
  const { rows } = await getPool().query<RuleRow>(
    `UPDATE rules SET ${updates.join(", ")}
       WHERE url_id = $${i++} AND id = $${i}
     RETURNING *`,
    values,
  );
  const updated = rows[0];
  if (!updated) return res.status(404).json({ error: "not_found" });

  if (parsed.data.destination_url !== undefined) {
    // Re-run handshake against the new URL.
    verifyRuleDestination(updated.id).catch((err) => {
      console.error("auto-handshake failed for rule", updated.id, err);
    });
  }

  return res.json({ rule: serializeRule(updated) });
});

rulesRouter.delete("/api/links/:short/rules/:id", requireLogin, requireOwner, async (req, res) => {
  const owned = req.ownedUrl;
  if (!owned) return res.status(500).json({ error: "missing_owned_url" });
  const ruleIdParam = typeof req.params.id === "string" ? req.params.id : "";
  if (!ruleIdParam) return res.status(400).json({ error: "invalid_request" });
  const { rowCount } = await getPool().query("DELETE FROM rules WHERE url_id = $1 AND id = $2", [
    owned.id,
    ruleIdParam,
  ]);
  if (rowCount === 0) return res.status(404).json({ error: "not_found" });
  return res.json({ ok: true });
});

rulesRouter.post(
  "/api/links/:short/rules/:id/verify",
  requireLogin,
  requireOwner,
  async (req, res) => {
    const owned = req.ownedUrl;
    if (!owned) return res.status(500).json({ error: "missing_owned_url" });
    const ruleIdParam = typeof req.params.id === "string" ? req.params.id : "";
    if (!ruleIdParam) return res.status(400).json({ error: "invalid_request" });

    const { rows } = await getPool().query<{ id: string }>(
      "SELECT id FROM rules WHERE url_id = $1 AND id = $2",
      [owned.id, ruleIdParam],
    );
    if (rows.length === 0) return res.status(404).json({ error: "not_found" });

    const outcome = await verifyRuleDestination(ruleIdParam);
    return res.json(outcome);
  },
);

rulesRouter.get(
  "/api/links/:short/rules/:id/firings",
  requireLogin,
  requireOwner,
  async (req, res) => {
    const owned = req.ownedUrl;
    if (!owned) return res.status(500).json({ error: "missing_owned_url" });
    const ruleIdParam = typeof req.params.id === "string" ? req.params.id : "";
    if (!ruleIdParam) return res.status(400).json({ error: "invalid_request" });

    const { rows } = await getPool().query<{
      id: string;
      ts: Date;
      status: string;
      attempts: number;
      last_attempt: Date | null;
      last_response_code: number | null;
      last_error: string | null;
      matched: unknown;
    }>(
      `SELECT f.id, f.ts, f.status, f.attempts, f.last_attempt,
              f.last_response_code, f.last_error, f.matched
         FROM firings f
         JOIN rules r ON r.id = f.rule_id
        WHERE r.url_id = $1 AND r.id = $2
        ORDER BY f.ts DESC
        LIMIT 50`,
      [owned.id, ruleIdParam],
    );

    return res.json({
      firings: rows.map((r) => ({
        id: r.id,
        ts: r.ts.toISOString(),
        status: r.status,
        attempts: r.attempts,
        last_attempt: r.last_attempt ? r.last_attempt.toISOString() : null,
        last_response_code: r.last_response_code,
        last_error: r.last_error,
        matched: r.matched,
      })),
    });
  },
);

rulesRouter.post(
  "/api/links/:short/rules/:id/firings/:fid/retry",
  requireLogin,
  requireOwner,
  async (req, res) => {
    const owned = req.ownedUrl;
    if (!owned) return res.status(500).json({ error: "missing_owned_url" });
    const ruleIdParam = typeof req.params.id === "string" ? req.params.id : "";
    const firingIdParam = typeof req.params.fid === "string" ? req.params.fid : "";
    if (!ruleIdParam || !firingIdParam) return res.status(400).json({ error: "invalid_request" });

    const { rows } = await getPool().query<{ id: string; status: string }>(
      `SELECT f.id, f.status
         FROM firings f JOIN rules r ON r.id = f.rule_id
        WHERE r.url_id = $1 AND r.id = $2 AND f.id = $3`,
      [owned.id, ruleIdParam, firingIdParam],
    );
    if (rows.length === 0) return res.status(404).json({ error: "not_found" });

    // Reset state + re-enqueue. Use a fresh queue id so BullMQ accepts the new
    // attempt even if the previous jobId is still in the failed list.
    await getPool().query(
      `UPDATE firings SET status='pending', attempts=0, last_error=NULL,
                          last_response_code=NULL, last_attempt=NULL
         WHERE id=$1`,
      [firingIdParam],
    );
    const retryJobId = `${firingIdParam}:retry:${Date.now()}`;
    await getWebhookQueue().add(
      "deliver",
      { firingId: firingIdParam, ruleId: ruleIdParam, short: owned.short },
      { jobId: retryJobId, ...WORKER_OPTS },
    );
    return res.json({ ok: true, retryJobId });
  },
);
