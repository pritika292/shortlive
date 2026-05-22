export function DemoPage(): JSX.Element {
  return (
    <main className="min-h-screen px-6 py-8 max-w-6xl mx-auto">
      <header className="mb-8 flex items-baseline justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">shortlive · demo</h1>
          <p className="text-sm text-slate-400">Live click analytics for the public demo link.</p>
        </div>
        <a className="text-xs text-slate-500 hover:text-slate-300" href="/">
          ← home
        </a>
      </header>

      <section className="grid gap-6 md:grid-cols-3">
        <Card title="Total clicks">
          <span className="text-slate-500">—</span>
        </Card>
        <Card title="Recent clicks">
          <span className="text-slate-500">feed coming next</span>
        </Card>
        <Card title="Map">
          <span className="text-slate-500">pins coming next</span>
        </Card>
      </section>
    </main>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }): JSX.Element {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-5">
      <div className="text-xs uppercase tracking-wider text-slate-500 mb-2">{title}</div>
      <div className="text-2xl font-medium text-slate-200">{children}</div>
    </div>
  );
}
