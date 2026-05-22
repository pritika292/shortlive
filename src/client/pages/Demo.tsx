import { Dashboard } from "../components/Dashboard.js";

export function DemoPage(): JSX.Element {
  return (
    <Dashboard
      short="demo"
      title="Live demo"
      subtitle="Synthetic traffic from 50+ cities, hitting /demo right now."
      topBarCurrent="demo"
    />
  );
}
