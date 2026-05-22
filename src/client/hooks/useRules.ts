import { useCallback, useEffect, useState } from "react";

export interface Rule {
  id: string;
  type: "threshold" | "velocity" | "first_of" | "per_click";
  config: Record<string, unknown>;
  destination_url: string;
  destination_verified: boolean;
  verification_attempts: number;
  last_verification_error: string | null;
  cooldown_seconds: number;
  enabled: boolean;
  created_at: string;
  last_fired_at: string | null;
}

export interface Firing {
  id: string;
  ts: string;
  status: "pending" | "delivered" | "failed";
  attempts: number;
  last_attempt: string | null;
  last_response_code: number | null;
  last_error: string | null;
  matched: unknown;
}

export function useRules(short: string): {
  rules: Rule[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
} {
  const [rules, setRules] = useState<Rule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async (): Promise<void> => {
    setLoading(true);
    try {
      const r = await fetch(`/api/links/${encodeURIComponent(short)}/rules`);
      if (!r.ok) {
        setError(r.status === 401 ? "Log in to manage rules" : `HTTP ${r.status}`);
        setRules([]);
        return;
      }
      const j = (await r.json()) as { rules: Rule[] };
      setRules(j.rules);
      setError(null);
    } catch (e) {
      setError((e as Error).message ?? "fetch failed");
    } finally {
      setLoading(false);
    }
  }, [short]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { rules, loading, error, refresh };
}

export async function createRule(short: string, body: unknown): Promise<Response> {
  return fetch(`/api/links/${encodeURIComponent(short)}/rules`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export async function patchRule(short: string, ruleId: string, body: unknown): Promise<Response> {
  return fetch(`/api/links/${encodeURIComponent(short)}/rules/${ruleId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export async function deleteRule(short: string, ruleId: string): Promise<Response> {
  return fetch(`/api/links/${encodeURIComponent(short)}/rules/${ruleId}`, { method: "DELETE" });
}

export async function reVerifyRule(short: string, ruleId: string): Promise<Response> {
  return fetch(`/api/links/${encodeURIComponent(short)}/rules/${ruleId}/verify`, {
    method: "POST",
  });
}

export async function fetchFirings(short: string, ruleId: string): Promise<Firing[]> {
  const r = await fetch(`/api/links/${encodeURIComponent(short)}/rules/${ruleId}/firings`);
  if (!r.ok) return [];
  const j = (await r.json()) as { firings: Firing[] };
  return j.firings;
}

export async function retryFiring(
  short: string,
  ruleId: string,
  firingId: string,
): Promise<Response> {
  return fetch(
    `/api/links/${encodeURIComponent(short)}/rules/${ruleId}/firings/${firingId}/retry`,
    { method: "POST" },
  );
}
