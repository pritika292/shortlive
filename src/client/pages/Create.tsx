import { useEffect, useState } from "react";
import { useSession } from "../hooks/useSession.js";
import { TopBar } from "../components/TopBar.js";
import { Footer } from "../components/Footer.js";

interface CreatedLink {
  short: string;
  url: string;
}

export function CreatePage(): JSX.Element {
  const session = useSession();
  const [target, setTarget] = useState("");
  const [customShort, setCustomShort] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [created, setCreated] = useState<CreatedLink | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (session.status === "guest") {
      window.location.assign("/login?next=/create");
    }
  }, [session.status]);

  async function submit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const body: Record<string, unknown> = { target };
      if (customShort.trim()) body.custom_short = customShort.trim();
      if (expiresAt) body.expires_at = new Date(expiresAt).toISOString();
      if (password) body.password = password;

      const res = await fetch("/shorten", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = (await res.json().catch(() => ({}))) as
        | CreatedLink
        | { error?: string; issues?: { message: string }[] };
      if (!res.ok) {
        if ("issues" in json && json.issues && json.issues.length > 0) {
          setError(json.issues[0]!.message);
        } else if ("error" in json && json.error === "shortcode_taken") {
          setError("That custom code is already in use.");
        } else {
          setError(("error" in json && json.error) || `Request failed (${res.status})`);
        }
        return;
      }
      setCreated(json as CreatedLink);
    } catch {
      setError("Network error. Try again.");
    } finally {
      setSubmitting(false);
    }
  }

  function reset(): void {
    setCreated(null);
    setTarget("");
    setCustomShort("");
    setExpiresAt("");
    setPassword("");
  }

  if (session.status === "loading") {
    return (
      <main className="min-h-screen flex items-center justify-center text-sm text-slate-500">
        Loading…
      </main>
    );
  }
  if (session.status === "guest") {
    return <main className="min-h-screen" />;
  }

  if (created) {
    return (
      <>
        <TopBar current="create" />
        <main className="min-h-[calc(100vh-56px)] flex items-center justify-center px-6">
          <div className="w-full max-w-md rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-6">
            <h1 className="text-xl font-semibold tracking-tight mb-1">Short link created</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mb-5">
              Share or open it below.
            </p>

            <div className="rounded border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 p-3 mb-4 flex items-center justify-between gap-3">
              <code className="text-sm text-sky-600 dark:text-sky-400 break-all">
                {created.url}
              </code>
              <CopyButton text={created.url} />
            </div>

            <div className="flex flex-wrap gap-3 text-xs">
              <a
                className="text-sky-600 dark:text-sky-400 hover:text-sky-700 dark:hover:text-sky-300"
                href={created.url}
                target="_blank"
                rel="noreferrer"
              >
                open in new tab ↗
              </a>
              <a
                className="text-sky-600 dark:text-sky-400 hover:text-sky-700 dark:hover:text-sky-300"
                href={`/a/${created.short}`}
              >
                analytics →
              </a>
              <a
                className="text-sky-600 dark:text-sky-400 hover:text-sky-700 dark:hover:text-sky-300"
                href={`/a/${created.short}/rules`}
              >
                rules →
              </a>
              <button
                type="button"
                onClick={reset}
                className="ml-auto text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:text-slate-100"
              >
                create another
              </button>
            </div>
          </div>
        </main>
        <Footer />
      </>
    );
  }

  return (
    <>
      <TopBar current="create" />
      <main className="min-h-[calc(100vh-56px)] flex items-center justify-center px-6 py-8">
        <form
          onSubmit={submit}
          className="w-full max-w-md rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 p-6"
        >
          <h1 className="text-xl font-semibold tracking-tight mb-1">Create a short link</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-6">
            Signed in as{" "}
            <span className="text-slate-700 dark:text-slate-300">{session.user?.username}</span>.
          </p>

          <div className="grid gap-3 text-sm">
            <Field
              id="create-target"
              label="Destination URL"
              required
              type="url"
              placeholder="https://example.com/long-path"
              value={target}
              onChange={setTarget}
            />
            <Field
              id="create-custom"
              label="Custom code (optional)"
              type="text"
              placeholder="3–32 chars [a-z A-Z 0-9 -]"
              value={customShort}
              onChange={setCustomShort}
            />
            <Field
              id="create-expires"
              label="Expires at (optional)"
              type="datetime-local"
              placeholder=""
              value={expiresAt}
              onChange={setExpiresAt}
            />
            <Field
              id="create-password"
              label="Password gate (optional)"
              type="password"
              placeholder="visitors enter this to follow"
              value={password}
              onChange={setPassword}
            />

            {error && <div className="text-rose-400 text-xs">{error}</div>}

            <button
              type="submit"
              disabled={submitting || !target}
              className="mt-2 self-start bg-sky-500 disabled:opacity-50 disabled:cursor-not-allowed text-slate-950 font-medium rounded px-4 py-1.5"
            >
              {submitting ? "Creating…" : "Create short link"}
            </button>
          </div>
        </form>
      </main>
      <Footer />
    </>
  );
}

function Field({
  id,
  label,
  type,
  placeholder,
  value,
  onChange,
  required,
}: {
  id: string;
  label: string;
  type: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
}): JSX.Element {
  return (
    <div className="grid gap-1">
      <label htmlFor={id} className="text-xs uppercase tracking-wider text-slate-500">
        {label}
      </label>
      <input
        id={id}
        type={type}
        required={required}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded px-2 py-1.5"
      />
    </div>
  );
}

function CopyButton({ text }: { text: string }): JSX.Element {
  const [copied, setCopied] = useState(false);
  async function copy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard API may be unavailable (e.g. file://); ignore.
    }
  }
  return (
    <button
      type="button"
      onClick={() => void copy()}
      className="text-xs bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded px-2 py-1 text-slate-800 dark:text-slate-200 shrink-0"
    >
      {copied ? "copied" : "copy"}
    </button>
  );
}
