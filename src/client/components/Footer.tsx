import { PROFILE } from "../lib/profile.js";

export function Footer(): JSX.Element {
  return (
    <footer className="border-t border-slate-200 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-500">
      <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between gap-4 flex-wrap">
        <span>
          shortlive · built by{" "}
          <a
            href="/about"
            className="text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100"
          >
            {PROFILE.fullName}
          </a>
        </span>
        <a
          href="/about"
          className="text-slate-500 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
        >
          about
        </a>
      </div>
    </footer>
  );
}
