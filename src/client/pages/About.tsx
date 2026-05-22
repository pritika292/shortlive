import { TopBar } from "../components/TopBar.js";
import { Footer } from "../components/Footer.js";
import { PROFILE } from "../lib/profile.js";

export function AboutPage(): JSX.Element {
  const firstName = PROFILE.fullName.split(" ")[0] ?? PROFILE.fullName;
  return (
    <>
      <TopBar current="about" />
      <main className="relative min-h-[calc(100vh-72px)] max-w-3xl mx-auto px-6 lg:px-8 py-16">
        <div
          aria-hidden
          className="absolute -top-24 left-1/2 -translate-x-1/2 -z-10 h-[300px] w-[600px] rounded-full bg-cyan-400/20 blur-3xl dark:bg-cyan-500/10"
        />
        <div className="text-center mb-12">
          <span className="inline-flex h-20 w-20 rounded-full bg-gradient-to-br from-emerald-500 to-cyan-500 text-white text-3xl font-bold items-center justify-center shadow-xl shadow-emerald-500/30 mb-5">
            {firstName.charAt(0)}
          </span>
          <h1 className="text-5xl font-bold tracking-tight text-slate-900 dark:text-white mb-3">
            Hi, I&apos;m {firstName}.
          </h1>
          <p className="text-lg text-slate-600 dark:text-slate-300 max-w-xl mx-auto leading-relaxed">
            {PROFILE.intro}
          </p>
        </div>

        <div className="glass-card divide-y divide-slate-200/60 dark:divide-white/5 overflow-hidden">
          <Row label="Email" value={PROFILE.email} href={`mailto:${PROFILE.email}`} icon={EmailIcon} />
          <Row label="Resume" value="Download PDF" href={PROFILE.resumeUrl} external icon={FileIcon} />
          <Row
            label="LinkedIn"
            value={PROFILE.linkedinUrl}
            href={PROFILE.linkedinUrl}
            external
            icon={LinkedinIcon}
          />
          <Row
            label="GitHub"
            value={PROFILE.githubUrl}
            href={PROFILE.githubUrl}
            external
            icon={GithubIcon}
          />
          <Row
            label="Portfolio"
            value={PROFILE.portfolioUrl}
            href={PROFILE.portfolioUrl}
            external
            icon={GlobeIcon}
          />
          <Row
            label="Schedule a chat"
            value="Pick a time on Calendly"
            href={PROFILE.calendlyUrl}
            external
            icon={CalendarIcon}
          />
        </div>

        <p className="text-xs text-center text-slate-500 mt-6">
          Some links are placeholder values until I publish the real ones. Email me directly above
          if anything is missing.
        </p>
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
      className="flex items-center gap-4 px-6 py-4 hover:bg-slate-50 dark:hover:bg-white/[0.03] transition-colors group"
    >
      <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-slate-100 to-slate-200 dark:from-white/[0.06] dark:to-white/[0.02] text-slate-700 dark:text-slate-200 group-hover:from-emerald-500 group-hover:to-cyan-500 group-hover:text-white transition-all">
        <Icon />
      </span>
      <div className="flex-1 min-w-0">
        <div className="text-xs uppercase tracking-wider font-semibold text-slate-500 dark:text-slate-400">
          {label}
        </div>
        <div className="text-base text-slate-900 dark:text-white truncate font-medium">{value}</div>
      </div>
      <span aria-hidden className="text-slate-400 group-hover:text-emerald-500 group-hover:translate-x-0.5 transition-all">
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
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden>
      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
      <polyline points="22,6 12,13 2,6" />
    </svg>
  );
}
function FileIcon(): JSX.Element {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  );
}
function LinkedinIcon(): JSX.Element {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden>
      <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-4 0v7h-4v-7a6 6 0 0 1 6-6z" />
      <rect x="2" y="9" width="4" height="12" />
      <circle cx="4" cy="4" r="2" />
    </svg>
  );
}
function GithubIcon(): JSX.Element {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden>
      <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22" />
    </svg>
  );
}
function GlobeIcon(): JSX.Element {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden>
      <circle cx="12" cy="12" r="10" />
      <line x1="2" y1="12" x2="22" y2="12" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  );
}
function CalendarIcon(): JSX.Element {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5" aria-hidden>
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}
