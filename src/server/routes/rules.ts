import { Router } from "express";
import { randomBytes } from "node:crypto";
import { customAlphabet } from "nanoid";
import { getPool } from "../db/pool.js";
import { requireLogin } from "../middleware/session.js";
import { requireOwner } from "../middleware/requireOwner.js";
import { RuleBody, RulePatchBody } from "../services/rule_schemas.js";

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
