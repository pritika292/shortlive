import { PROFILE } from "../lib/profile.js";

export function Footer(): JSX.Element {
  return (
    <footer className="border-t border-slate-200/70 dark:border-white/5 text-sm text-slate-500 dark:text-slate-400 bg-slate-50/50 dark:bg-white/[0.02]">
      <div className="max-w-7xl mx-auto px-6 lg:px-8 py-6 flex items-center justify-between gap-4 flex-wrap">
        <span>
          shortlive · built by{" "}
          <a
            href="/about"
            className="font-semibold text-slate-800 dark:text-slate-200 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
          >
            {PROFILE.fullName}
          </a>
        </span>
        <div className="flex items-center gap-5">
          <a
            href="/about"
            className="hover:text-slate-900 dark:hover:text-slate-100 transition-colors"
          >
            About
          </a>
          <a
            href="/demo"
            className="hover:text-slate-900 dark:hover:text-slate-100 transition-colors"
          >
            Live demo
          </a>
          <a
            href={PROFILE.githubUrl}
            target="_blank"
            rel="noreferrer"
            className="hover:text-slate-900 dark:hover:text-slate-100 transition-colors"
          >
            GitHub
          </a>
        </div>
      </div>
    </footer>
  );
}
