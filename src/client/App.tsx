import { HomePage } from "./pages/Home.js";
import { DemoPage } from "./pages/Demo.js";
import { RulesPage } from "./pages/Rules.js";

export function App(): JSX.Element {
  const path = typeof window !== "undefined" ? window.location.pathname : "/";
  if (path === "/demo") return <DemoPage />;
  const rulesMatch = /^\/a\/([0-9A-Za-z-]{3,32})\/rules\/?$/.exec(path);
  if (rulesMatch) return <RulesPage short={rulesMatch[1]!} />;
  return <HomePage />;
}
