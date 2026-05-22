import { Dashboard } from "../components/Dashboard.js";

interface Props {
  short: string;
}

export function AnalyticsPage({ short }: Props): JSX.Element {
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const fullUrl = `${origin}/${short}`;
  return (
    <Dashboard
      short={short}
      title={fullUrl}
      subtitle="Live analytics for your short link."
      topBarCurrent="analytics"
      headerRight={
        <a className="btn-secondary" href={`/a/${short}/rules`}>
          Manage rules
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
            <line x1="5" y1="12" x2="19" y2="12" />
            <polyline points="12 5 19 12 12 19" />
          </svg>
        </a>
      }
    />
  );
}
