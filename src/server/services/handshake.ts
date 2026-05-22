import { randomBytes } from "node:crypto";
import { getPool } from "../db/pool.js";

const HANDSHAKE_TIMEOUT_MS = 5_000;

export interface HandshakeOutcome {
  verified: boolean;
  status?: number;
  error?: string;
}

export async function performHandshake(
  destinationUrl: string,
  fetchImpl: typeof fetch = fetch,
): Promise<HandshakeOutcome> {
  const nonce = randomBytes(16).toString("hex");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), HANDSHAKE_TIMEOUT_MS);
  try {
    const res = await fetchImpl(destinationUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ verification_nonce: nonce }),
      signal: controller.signal,
    });
    if (!res.ok) {
      return { verified: false, status: res.status, error: `HTTP ${res.status}` };
    }
    const text = await res.text();
    if (!text.includes(nonce)) {
      return { verified: false, status: res.status, error: "nonce not echoed in response body" };
    }
    return { verified: true, status: res.status };
  } catch (err) {
    return { verified: false, error: (err as Error).message ?? "fetch failed" };
  } finally {
    clearTimeout(timer);
  }
}

export async function verifyRuleDestination(
  ruleId: string,
  fetchImpl: typeof fetch = fetch,
): Promise<HandshakeOutcome> {
  const { rows } = await getPool().query<{ destination_url: string }>(
    "SELECT destination_url FROM rules WHERE id = $1",
    [ruleId],
  );
  const row = rows[0];
  if (!row) return { verified: false, error: "rule_not_found" };

  const outcome = await performHandshake(row.destination_url, fetchImpl);
  await getPool().query(
    `UPDATE rules
        SET destination_verified = $2,
            verification_attempts = verification_attempts + 1,
            last_verification_error = $3
      WHERE id = $1`,
    [ruleId, outcome.verified, outcome.verified ? null : (outcome.error ?? "unknown")],
  );
  return outcome;
}
