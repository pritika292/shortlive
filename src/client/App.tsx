import { HomePage } from "./pages/Home.js";
import { DemoPage } from "./pages/Demo.js";
import { RulesPage } from "./pages/Rules.js";
import { CreatePage } from "./pages/Create.js";
import { MyLinksPage } from "./pages/MyLinks.js";
import { AnalyticsPage } from "./pages/Analytics.js";
import { AboutPage } from "./pages/About.js";

export function App(): JSX.Element {
  const path = typeof window !== "undefined" ? window.location.pathname : "/";
  if (path === "/demo") return <DemoPage />;
  if (path === "/create") return <CreatePage />;
  if (path === "/links") return <MyLinksPage />;
  if (path === "/about") return <AboutPage />;
  const rulesMatch = /^\/a\/([0-9A-Za-z-]{3,32})\/rules\/?$/.exec(path);
  if (rulesMatch) return <RulesPage short={rulesMatch[1]!} />;
  const analyticsMatch = /^\/a\/([0-9A-Za-z-]{3,32})\/?$/.exec(path);
  if (analyticsMatch) return <AnalyticsPage short={analyticsMatch[1]!} />;
  return <HomePage />;
}
