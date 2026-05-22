import { createHmac } from "node:crypto";
import { Worker, type Job } from "bullmq";
import Redis from "ioredis";
import { config } from "../config.js";
import { getPool } from "../db/pool.js";
import { WEBHOOK_QUEUE } from "./queue.js";

const ATTEMPTS = 5;
// 1s, 4s, 16s, 64s, 256s.
const BACKOFF_DELAY_MS = 1000;
const BACKOFF_TYPE = "exponential";
const REQUEST_TIMEOUT_MS = 10_000;

export interface DeliveryJobData {
  firingId: string;
  ruleId: string;
  short: string;
}

interface FiringWithRule {
  firing_id: string;
  rule_id: string;
  rule_enabled: boolean;
  destination_url: string;
  destination_verified: boolean;
  signing_secret: string;
  type: string;
  matched: unknown;
  click_id: string | null;
  click_ts: Date | null;
}

async function loadFiring(firingId: string): Promise<FiringWithRule | null> {
  const { rows } = await getPool().query<FiringWithRule>(
    `SELECT f.id AS firing_id, r.id AS rule_id, r.enabled AS rule_enabled,
            r.destination_url, r.destination_verified, r.signing_secret, r.type,
            f.matched, f.click_id, f.ts AS click_ts
       FROM firings f
       JOIN rules r ON r.id = f.rule_id
      WHERE f.id = $1`,
    [firingId],
  );
  return rows[0] ?? null;
}

export function buildPayload(
  f: FiringWithRule,
  short: string,
): {
  body: string;
  signature: string;
} {
  const body = JSON.stringify({
    firing_id: f.firing_id,
    rule_id: f.rule_id,
    short,
    type: f.type,
    ts: f.click_ts ? f.click_ts.toISOString() : new Date().toISOString(),
    matched: f.matched ?? {},
  });
  const signature = `sha256=${createHmac("sha256", f.signing_secret).update(body).digest("hex")}`;
  return { body, signature };
}

interface DeliveryAttempt {
  ok: boolean;
  status?: number;
  error?: string;
}

export async function deliverHttp(
  url: string,
  body: string,
  signature: string,
  timeoutMs: number = REQUEST_TIMEOUT_MS,
): Promise<DeliveryAttempt> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shortlive-Signature": signature,
      },
      body,
      signal: controller.signal,
    });
    if (res.ok) return { ok: true, status: res.status };
    return { ok: false, status: res.status, error: `HTTP ${res.status}` };
  } catch (err) {
    const msg = (err as Error).message ?? "fetch failed";
    return { ok: false, error: msg };
  } finally {
    clearTimeout(timer);
  }
}

export async function processDelivery(job: Job<DeliveryJobData>): Promise<void> {
  const { firingId, short } = job.data;
  const firing = await loadFiring(firingId);
  if (!firing) {
    // Firing was deleted (cascade from rule/link removal) — treat as success
    // so BullMQ stops retrying.
    return;
  }

  if (!firing.rule_enabled || !firing.destination_verified) {
    await getPool().query(
      `UPDATE firings SET status='failed', last_attempt=NOW(),
                          last_error=$2, attempts=attempts+1
         WHERE id=$1`,
      [firingId, "rule disabled or destination unverified at delivery time"],
    );
    return;
  }

  const { body, signature } = buildPayload(firing, short);
  const result = await deliverHttp(firing.destination_url, body, signature);

  if (result.ok) {
    await getPool().query(
      `UPDATE firings SET status='delivered', last_attempt=NOW(),
                          last_response_code=$2, last_error=NULL,
                          attempts=attempts+1
         WHERE id=$1`,
      [firingId, result.status ?? null],
    );
    return;
  }

  // Record the attempt; throwing makes BullMQ apply backoff. On the last
  // attempt the job-failure handler flips status to 'failed'.
  await getPool().query(
    `UPDATE firings SET last_attempt=NOW(), attempts=attempts+1,
                        last_response_code=$2, last_error=$3
       WHERE id=$1`,
    [firingId, result.status ?? null, result.error ?? "unknown"],
  );
  throw new Error(result.error ?? `HTTP ${result.status ?? 0}`);
}

let worker: Worker | null = null;
let workerConnection: Redis | null = null;

export function startWebhookWorker(): Worker {
  if (worker) return worker;
  workerConnection = new Redis(config().REDIS_URL, { maxRetriesPerRequest: null });
  worker = new Worker<DeliveryJobData>(WEBHOOK_QUEUE, processDelivery, {
    connection: workerConnection,
    concurrency: 4,
  });

  worker.on("failed", (job, err) => {
    if (!job) return;
    // Final failure: BullMQ moves the job to the failed list when attemptsMade
    // reaches the configured max. Flip the firing's status so the UI shows it.
    if ((job.attemptsMade ?? 0) >= ATTEMPTS) {
      void getPool()
        .query(`UPDATE firings SET status='failed', last_error=$2 WHERE id=$1`, [
          job.data.firingId,
          err.message,
        ])
        .catch((e) => console.error("failed to mark firing as failed", e));
    }
  });

  return worker;
}

export async function stopWebhookWorker(): Promise<void> {
  if (worker) {
    await worker.close();
    worker = null;
  }
  if (workerConnection) {
    await workerConnection.quit();
    workerConnection = null;
  }
}

export const WORKER_OPTS = {
  attempts: ATTEMPTS,
  backoff: { type: BACKOFF_TYPE, delay: BACKOFF_DELAY_MS },
} as const;
