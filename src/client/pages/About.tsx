import { TopBar } from "../components/TopBar.js";
import { Footer } from "../components/Footer.js";
import { PROFILE } from "../lib/profile.js";

export function AboutPage(): JSX.Element {
  return (
    <>
      <TopBar current="about" />
      <main className="min-h-[calc(100vh-56px)] px-6 py-12 max-w-2xl mx-auto">
        <h1 className="text-3xl font-semibold tracking-tight mb-2">
          Hi, I&apos;m {PROFILE.fullName.split(" ")[0]}.
        </h1>
        <p className="text-slate-600 dark:text-slate-400 mb-10">{PROFILE.intro}</p>

        <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 divide-y divide-slate-200 dark:divide-slate-800">
          <Row icon="✉️" label="Email" value={PROFILE.email} href={`mailto:${PROFILE.email}`} />
          <Row icon="📄" label="Resume" value="Download PDF" href={PROFILE.resumeUrl} external />
          <Row
            icon="🔗"
            label="LinkedIn"
            value={PROFILE.linkedinUrl}
            href={PROFILE.linkedinUrl}
            external
          />
          <Row
            icon="🐙"
            label="GitHub"
            value={PROFILE.githubUrl}
            href={PROFILE.githubUrl}
            external
          />
          <Row
            icon="🌐"
            label="Portfolio"
            value={PROFILE.portfolioUrl}
            href={PROFILE.portfolioUrl}
            external
          />
          <Row
            icon="📅"
            label="Schedule a chat"
            value="Pick a time on Calendly"
            href={PROFILE.calendlyUrl}
            external
          />
        </div>

        <p className="text-xs text-slate-500 mt-6">
          Some links are placeholder values until I publish the real ones — check back, or email me
          directly above.
        </p>
      </main>
      <Footer />
    </>
  );
}

function Row({
  icon,
  label,
  value,
  href,
  external,
}: {
  icon: string;
  label: string;
  value: string;
  href: string;
  external?: boolean;
}): JSX.Element {
  return (
    <a
      href={href}
      target={external ? "_blank" : undefined}
      rel={external ? "noreferrer" : undefined}
      className="flex items-center gap-4 px-5 py-3 hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors"
    >
      <span aria-hidden className="text-xl">
        {icon}
      </span>
      <div className="flex-1 min-w-0">
        <div className="text-xs uppercase tracking-wider text-slate-500">{label}</div>
        <div className="text-sm text-slate-900 dark:text-slate-100 truncate">{value}</div>
      </div>
      <span aria-hidden className="text-slate-400">
        →
      </span>
    </a>
  );
}
