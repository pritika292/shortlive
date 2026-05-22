import { Dashboard } from "../components/Dashboard.js";

export function DemoPage(): JSX.Element {
  return (
    <Dashboard
      short="demo"
      title="shortlive · demo"
      subtitle="Live click analytics for the public demo link."
      topBarCurrent="demo"
    />
  );
}
