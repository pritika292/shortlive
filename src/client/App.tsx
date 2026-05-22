import { HomePage } from "./pages/Home.js";
import { DemoPage } from "./pages/Demo.js";

export function App(): JSX.Element {
  const path = typeof window !== "undefined" ? window.location.pathname : "/";
  if (path === "/demo") return <DemoPage />;
  return <HomePage />;
}
