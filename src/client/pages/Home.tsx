import { TopBar } from "../components/TopBar.js";

export function HomePage(): JSX.Element {
  return (
    <>
      <TopBar current="home" />
      <main className="min-h-[calc(100vh-56px)] flex items-center justify-center px-6">
        <div className="text-center max-w-lg">
          <h1 className="text-4xl font-semibold tracking-tight mb-3">shortlive</h1>
          <p className="text-slate-400 mb-8">
            URL shortener with sub-second live click analytics and rule-based webhook automation.
          </p>
          <div className="grid gap-3 text-sm text-slate-400">
            <a className="text-sky-400 hover:text-sky-300" href="/demo">
              Watch the public demo dashboard →
            </a>
            <a className="text-sky-400 hover:text-sky-300" href="/login">
              Log in to your dashboard →
            </a>
          </div>
        </div>
      </main>
    </>
  );
}
