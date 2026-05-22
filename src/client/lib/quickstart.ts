// Shared POST + redirect for the Quickstart flow. Used by both the modal
// (first-time path with the warning) and the button (warn-once path that
// skips the modal on subsequent clicks).

const WARNED_KEY = "shortlive:quickstart-warned";

export function hasBeenWarned(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(WARNED_KEY) === "1";
  } catch {
    return false;
  }
}

export function markWarned(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(WARNED_KEY, "1");
  } catch {
    // Private mode / quota / disabled storage: silently ignore. The worst
    // case is the user sees the modal on every click, which is the
    // pre-warn-once behaviour, not actually broken.
  }
}

export type QuickstartError = "capacity" | "other";

export interface QuickstartResult {
  ok: boolean;
  error?: QuickstartError;
  status?: number;
}

export async function postQuickstart(next: string): Promise<QuickstartResult> {
  try {
    const res = await fetch("/api/quickstart", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    if (!res.ok) {
      return {
        ok: false,
        status: res.status,
        error: res.status === 429 ? "capacity" : "other",
      };
    }
    window.location.assign(next);
    return { ok: true };
  } catch {
    return { ok: false, error: "other" };
  }
}
