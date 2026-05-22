import { Dashboard } from "../components/Dashboard.js";

interface Props {
  short: string;
}

export function AnalyticsPage({ short }: Props): JSX.Element {
  return (
    <Dashboard
      short={short}
      title={`shortlive · /${short}`}
      subtitle="Live analytics for your link."
      topBarCurrent="analytics"
      headerRight={
        <a className="hover:text-slate-300" href={`/a/${short}/rules`}>
          rules →
        </a>
      }
    />
  );
}
