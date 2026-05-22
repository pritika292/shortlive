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
      // No more login UI: guests bounce home where they can Quickstart.
      window.location.assign("/");
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
        <main className="relative min-h-[calc(100vh-72px)] flex items-center justify-center px-6 py-12">
          <div className="w-full max-w-xl glass-card p-8 sm:p-10">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold uppercase tracking-wider bg-emerald-100/80 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/20 mb-4">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-3.5 w-3.5"
                aria-hidden
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
              Link created
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white mb-2">
              Your short link is live.
            </h1>
            <p className="text-slate-500 dark:text-slate-400 mb-6">
              Share it anywhere, and watch clicks land in real time.
            </p>

            <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-white/[0.04] p-4 mb-5 flex items-center justify-between gap-3">
              <code className="text-base font-semibold text-emerald-600 dark:text-emerald-400 break-all">
                {created.url}
              </code>
              <CopyButton text={created.url} />
            </div>

            <div className="flex flex-wrap gap-3">
              <a href={created.url} target="_blank" rel="noreferrer" className="btn-secondary">
                Open in new tab
              </a>
              <a href={`/a/${created.short}`} className="btn-secondary">
                View analytics
              </a>
              <a href={`/a/${created.short}/rules`} className="btn-secondary">
                Manage rules
              </a>
              <button type="button" onClick={reset} className="btn-primary ml-auto">
                Create another
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
      <main className="relative min-h-[calc(100vh-72px)] flex items-center justify-center px-6 py-12">
        <div
          aria-hidden
          className="absolute -top-24 right-1/4 -z-10 h-[300px] w-[500px] rounded-full bg-cyan-400/20 blur-3xl dark:bg-cyan-500/10"
        />
        <form onSubmit={submit} className="w-full max-w-xl glass-card p-8 sm:p-10">
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white mb-2">
            Create a short link
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mb-7">
            Signed in as{" "}
            <span className="font-semibold text-slate-800 dark:text-slate-200">
              {session.user?.username}
            </span>
            . Pick a target, optionally lock it down, and ship.
          </p>

          <div className="grid gap-5">
            <Field
              id="create-target"
              label="Destination URL"
              required
              type="url"
              placeholder="https://example.com/long-path"
              value={target}
              onChange={setTarget}
            />
            <div className="grid gap-5 sm:grid-cols-2">
              <Field
                id="create-custom"
                label="Custom code"
                hint="optional, 3 to 32 chars"
                type="text"
                placeholder="my-launch"
                value={customShort}
                onChange={setCustomShort}
              />
              <Field
                id="create-expires"
                label="Expires at"
                hint="optional"
                type="datetime-local"
                placeholder=""
                value={expiresAt}
                onChange={setExpiresAt}
              />
            </div>
            <Field
              id="create-password"
              label="Password gate"
              hint="optional; visitors enter this to follow"
              type="password"
              placeholder="leave blank for public access"
              value={password}
              onChange={setPassword}
            />

            {error && (
              <div className="rounded-xl border border-rose-200 dark:border-rose-500/30 bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-300 px-4 py-2.5 text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting || !target}
              className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed self-start py-3 px-7 text-base"
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
  hint,
  type,
  placeholder,
  value,
  onChange,
  required,
}: {
  id: string;
  label: string;
  hint?: string;
  type: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
}): JSX.Element {
  return (
    <div className="grid gap-1.5">
      <label
        htmlFor={id}
        className="text-xs uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400"
      >
        {label}
        {hint ? (
          <span className="ml-1.5 normal-case tracking-normal font-normal text-slate-400">
            ({hint})
          </span>
        ) : null}
      </label>
      <input
        id={id}
        type={type}
        required={required}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="bg-white dark:bg-white/[0.04] border border-slate-300 dark:border-white/10 rounded-xl px-4 py-3 text-base text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500"
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
      className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:opacity-90 transition-opacity"
    >
      {copied ? (
        <>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-4 w-4"
            aria-hidden
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
          Copied
        </>
      ) : (
        <>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-4 w-4"
            aria-hidden
          >
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
          </svg>
          Copy
        </>
      )}
    </button>
  );
}
