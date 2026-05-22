import { customAlphabet } from "nanoid";
import type pg from "pg";
import { getPool } from "../db/pool.js";
import { getRedis } from "./redis.js";
import { getWebhookQueue } from "./queue.js";
import type { ClickContext } from "./click_logger.js";

const firingId = customAlphabet("0123456789abcdefghijklmnopqrstuvwxyz", 24);

export interface RuleRow {
  id: string;
  url_id: number;
  type: "threshold" | "velocity" | "first_of" | "per_click";
  config: Record<string, unknown>;
  destination_url: string;
  destination_verified: boolean;
  cooldown_seconds: number;
  enabled: boolean;
}

export interface EvaluationContext {
  click: ClickContext & { country: string | null; device: string | null; clickId?: number };
  short: string;
}

export interface FireOutcome {
  ruleId: string;
  firingId: string;
}

function counterKey(ruleId: string): string {
  return `shortlive:rule_counter:${ruleId}`;
}

function seenKey(ruleId: string, dim: string, value: string): string {
  return `shortlive:rule_seen:${ruleId}:${dim}:${value}`;
}

function cooldownKey(ruleId: string): string {
  return `shortlive:rule_cooldown:${ruleId}`;
}

async function inCooldown(ruleId: string): Promise<boolean> {
  const r = getRedis();
  const v = await r.get(cooldownKey(ruleId));
  return v !== null;
}

async function setCooldown(ruleId: string, seconds: number): Promise<void> {
  if (seconds <= 0) return;
  await getRedis().set(cooldownKey(ruleId), "1", "EX", seconds);
}

interface ThresholdConfig {
  count: number;
}

async function evalThreshold(
  rule: RuleRow,
  _ctx: EvaluationContext,
): Promise<Record<string, unknown> | null> {
  const cfg = rule.config as Partial<ThresholdConfig>;
  if (typeof cfg.count !== "number") return null;
  const value = await getRedis().incr(counterKey(rule.id));
  if (value === cfg.count) {
    return { value, threshold: cfg.count };
  }
  return null;
}

interface FirstOfConfig {
  dimension: "country" | "device" | "referrer";
}

async function evalFirstOf(
  rule: RuleRow,
  ctx: EvaluationContext,
): Promise<Record<string, unknown> | null> {
  const cfg = rule.config as Partial<FirstOfConfig>;
  if (!cfg.dimension) return null;
  let value: string | null;
  if (cfg.dimension === "country") value = ctx.click.country;
  else if (cfg.dimension === "device") value = ctx.click.device;
  else value = ctx.click.referrer ?? null;
  if (!value) return null;
  const added = await getRedis().setnx(seenKey(rule.id, cfg.dimension, value), "1");
  if (added === 1) {
    return { dimension: cfg.dimension, value };
  }
  return null;
}

interface PerClickConfig {
  filters: {
    country?: string[];
    device?: string[];
    referrer?: string[];
  };
}

function matchesPerClick(rule: RuleRow, ctx: EvaluationContext): boolean {
  const cfg = rule.config as Partial<PerClickConfig>;
  const filters = cfg.filters;
  if (!filters) return false;
  if (filters.country && filters.country.length > 0) {
    if (!ctx.click.country || !filters.country.includes(ctx.click.country)) return false;
  }
  if (filters.device && filters.device.length > 0) {
    if (!ctx.click.device || !filters.device.includes(ctx.click.device)) return false;
  }
  if (filters.referrer && filters.referrer.length > 0) {
    if (!ctx.click.referrer || !filters.referrer.some((r) => ctx.click.referrer?.includes(r))) {
      return false;
    }
  }
  return true;
}

async function evalPerClick(
  rule: RuleRow,
  ctx: EvaluationContext,
): Promise<Record<string, unknown> | null> {
  return matchesPerClick(rule, ctx)
    ? {
        country: ctx.click.country,
        device: ctx.click.device,
        referrer: ctx.click.referrer,
      }
    : null;
}

export async function evaluateRulesForClick(
  ctx: EvaluationContext,
  pool: pg.Pool | pg.PoolClient = getPool(),
): Promise<FireOutcome[]> {
  const { rows } = await pool.query<RuleRow>(
    `SELECT id, url_id, type, config, destination_url, destination_verified,
            cooldown_seconds, enabled
       FROM rules
      WHERE url_id = (SELECT id FROM urls WHERE short = $1) AND enabled = TRUE`,
    [ctx.short],
  );

  const fired: FireOutcome[] = [];
  for (const rule of rows) {
    if (!rule.destination_verified) continue;
    if (await inCooldown(rule.id)) continue;

    let matched: Record<string, unknown> | null = null;
    if (rule.type === "threshold") matched = await evalThreshold(rule, ctx);
    else if (rule.type === "first_of") matched = await evalFirstOf(rule, ctx);
    else if (rule.type === "per_click") matched = await evalPerClick(rule, ctx);
    // velocity lands in 8.3

    if (matched === null) continue;

    const fid = firingId();
    await pool.query(
      `INSERT INTO firings(id, rule_id, click_id, matched, status)
         VALUES($1, $2, $3, $4, 'pending')`,
      [fid, rule.id, ctx.click.clickId ?? null, matched],
    );
    await pool.query("UPDATE rules SET last_fired_at = NOW() WHERE id = $1", [rule.id]);

    // Enqueue with jobId = firing_id so BullMQ structurally de-dupes.
    await getWebhookQueue().add(
      "deliver",
      { firingId: fid, ruleId: rule.id, short: ctx.short },
      { jobId: fid },
    );

    await setCooldown(rule.id, rule.cooldown_seconds);
    fired.push({ ruleId: rule.id, firingId: fid });
  }
  return fired;
}
