import { TopBar } from "../components/TopBar.js";
import { Footer } from "../components/Footer.js";
import { ArchDiagram } from "../components/ArchDiagram.js";
import { PROFILE } from "../lib/profile.js";

interface TechRow {
  name: string;
  why: string;
}

const TECH: TechRow[] = [
  {
    name: "Express 5 + TypeScript",
    why: "thin router for the redirect hot path; strict types end-to-end",
  },
  {
    name: "React 18 + Vite",
    why: "fast HMR; one bundle for landing + dashboard + demo + analytics",
  },
  { name: "Postgres 16", why: "links, clicks, rules, webhook events; idx on (short, created_at)" },
  { name: "Redis 7", why: "pub/sub fan-out for live dashboard updates; rate-limit buckets" },
  {
    name: "WebSocket",
    why: "sub-second click → dashboard; one socket per browser, fanned out from Redis",
  },
  { name: "Recharts", why: "click time-series + per-link breakdown" },
  { name: "Caddy", why: "Let's Encrypt + reverse proxy at shortlive.pritika.studio" },
  {
    name: "GitHub Actions + OIDC",
    why: "lint / build / deploy on push to main; no long-lived secrets",
  },
];

export function AboutPage(): JSX.Element {
  const firstName = PROFILE.fullName.split(" ")[0] ?? PROFILE.fullName;
  return (
    <>
      <TopBar current="about" />
      <main className="relative min-h-[calc(100vh-72px)] max-w-screen-2xl mx-auto px-6 lg:px-8 xl:px-12 py-14">
        <div
          aria-hidden
          className="absolute -top-24 left-1/2 -translate-x-1/2 -z-10 h-[300px] w-[600px] rounded-full bg-cyan-400/20 blur-3xl dark:bg-cyan-500/10"
        />

        <header className="text-center mb-12">
          <span className="inline-flex h-20 w-20 rounded-full bg-gradient-to-br from-emerald-500 to-cyan-500 text-white text-3xl font-bold items-center justify-center shadow-xl shadow-emerald-500/30 mb-5">
            {firstName.charAt(0)}
          </span>
          <h1 className="text-5xl font-bold tracking-tight text-slate-900 dark:text-white mb-3">
            Hi, I&apos;m {firstName}.
          </h1>
          <p className="text-lg text-slate-600 dark:text-slate-300 max-w-2xl mx-auto leading-relaxed">
            {PROFILE.intro}
          </p>
        </header>

        {/* Full-width architecture diagram. Used to live inside the
            middle column and was too small to read. Now spans the page so
            labels and edges are legible at typical viewport widths. */}
        <section className="glass-card p-6 lg:p-8 mb-8">
          <p className="text-xs uppercase tracking-widest font-semibold text-slate-500 dark:text-slate-400 mb-4">
            Architecture
          </p>
          <ArchDiagram />
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
          {/* Left: story */}
          <section className="space-y-5">
            <p className="text-xs uppercase tracking-widest font-semibold text-slate-500 dark:text-slate-400">
              Story
            </p>
            <p className="text-[15px] leading-relaxed text-justify text-slate-700 dark:text-slate-300">
              shortlive is a URL shortener with a sub-second live analytics dashboard. Click a short
              link, the dashboard updates before the next blink.
            </p>
            <p className="text-[15px] leading-relaxed text-justify text-slate-700 dark:text-slate-300">
              The redirect path stays fast by being deliberately boring: a single indexed lookup, a
              302, and an asynchronous enqueue of the click event. Nothing else runs in the hot
              path. A worker drains the queue, writes the row to Postgres, and publishes the click
              on a Redis channel. A WebSocket hub fans the event out to every dashboard tab watching
              that link.
            </p>
            <p className="text-[15px] leading-relaxed text-justify text-slate-700 dark:text-slate-300">
              The rule engine on the side runs HMAC-signed webhooks with exponential backoff and a
              dead-letter queue for terminal failures, so &ldquo;send my click to my CRM&rdquo; is
              one rule away.
            </p>
            <p className="text-[15px] leading-relaxed text-justify text-slate-700 dark:text-slate-300">
              The whole stack runs on one Azure VM in northcentralus, deployed by GitHub Actions via
              OIDC. No long-lived secrets in the repo; runtime configuration is materialized from
              Azure Key Vault at boot.
            </p>
          </section>

          {/* Middle: tech list (diagram moved to its own full-width section above). */}
          <section className="space-y-5">
            <p className="text-xs uppercase tracking-widest font-semibold text-slate-500 dark:text-slate-400">
              Tech
            </p>
            <dl className="space-y-3">
              {TECH.map((t) => (
                <div key={t.name}>
                  <dt className="font-mono text-sm text-slate-900 dark:text-white">{t.name}</dt>
                  <dd className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">{t.why}</dd>
                </div>
              ))}
            </dl>
          </section>

          {/* Right: contact */}
          <section className="space-y-5">
            <p className="text-xs uppercase tracking-widest font-semibold text-slate-500 dark:text-slate-400">
              Contact
            </p>
            <div className="glass-card divide-y divide-slate-200/60 dark:divide-white/5 overflow-hidden">
              <Row
                label="Resume"
                value="resume.pdf"
                href={PROFILE.resumeUrl}
                external
                icon={FileIcon}
              />
              <Row
                label="Email"
                value={PROFILE.email}
                href={`mailto:${PROFILE.email}`}
                icon={EmailIcon}
              />
              <Row
                label="LinkedIn"
                value="linkedin.com/in/pritika-priyadarshini"
                href={PROFILE.linkedinUrl}
                external
                icon={LinkedinIcon}
              />
              <Row
                label="GitHub"
                value="github.com/pritika292"
                href={PROFILE.githubUrl}
                external
                icon={GithubIcon}
              />
              <Row
                label="Portfolio"
                value="pritika.studio"
                href={PROFILE.portfolioUrl}
                external
                icon={GlobeIcon}
              />
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              5-YOE backend / distributed-systems engineer. Open to senior IC roles — US-remote
              preferred, on-site SF / NYC welcome.
            </p>
          </section>
        </div>
      </main>
      <Footer />
    </>
  );
}

function Row({
  label,
  value,
  href,
  external,
  icon: Icon,
}: {
  label: string;
  value: string;
  href: string;
  external?: boolean;
  icon: () => JSX.Element;
}): JSX.Element {
  return (
    <a
      href={href}
      target={external ? "_blank" : undefined}
      rel={external ? "noreferrer" : undefined}
      className="flex items-center gap-4 px-5 py-3.5 hover:bg-slate-50 dark:hover:bg-white/[0.03] transition-colors group"
    >
      <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-slate-100 to-slate-200 dark:from-white/[0.06] dark:to-white/[0.02] text-slate-700 dark:text-slate-200 group-hover:from-emerald-500 group-hover:to-cyan-500 group-hover:text-white transition-all">
        <Icon />
      </span>
      <div className="flex-1 min-w-0">
        <div className="text-[11px] uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400">
          {label}
        </div>
        <div className="text-sm text-slate-900 dark:text-white truncate font-medium font-mono">
          {value}
        </div>
      </div>
      <span
        aria-hidden
        className="text-slate-400 group-hover:text-emerald-500 group-hover:translate-x-0.5 transition-all"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-5 w-5"
        >
          <line x1="5" y1="12" x2="19" y2="12" />
          <polyline points="12 5 19 12 12 19" />
        </svg>
      </span>
    </a>
  );
}

function EmailIcon(): JSX.Element {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-5 w-5"
      aria-hidden
    >
      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
      <polyline points="22,6 12,13 2,6" />
    </svg>
  );
}
function FileIcon(): JSX.Element {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-5 w-5"
      aria-hidden
    >
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  );
}
function LinkedinIcon(): JSX.Element {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-5 w-5"
      aria-hidden
    >
      <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-4 0v7h-4v-7a6 6 0 0 1 6-6z" />
      <rect x="2" y="9" width="4" height="12" />
      <circle cx="4" cy="4" r="2" />
    </svg>
  );
}
function GithubIcon(): JSX.Element {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-5 w-5"
      aria-hidden
    >
      <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22" />
    </svg>
  );
}
function GlobeIcon(): JSX.Element {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-5 w-5"
      aria-hidden
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="2" y1="12" x2="22" y2="12" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  );
}
