import { HomePage } from "./pages/Home.js";
import { DemoPage } from "./pages/Demo.js";
import { RulesPage } from "./pages/Rules.js";
import { LoginPage } from "./pages/Login.js";

export function App(): JSX.Element {
  const path = typeof window !== "undefined" ? window.location.pathname : "/";
  if (path === "/demo") return <DemoPage />;
  if (path === "/login") return <LoginPage />;
  const rulesMatch = /^\/a\/([0-9A-Za-z-]{3,32})\/rules\/?$/.exec(path);
  if (rulesMatch) return <RulesPage short={rulesMatch[1]!} />;
  return <HomePage />;
}
