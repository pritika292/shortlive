import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

// Vitest globals are off, so Testing Library's built-in cleanup hook never
// gets registered. Do it explicitly to avoid bleed-over between tests.
afterEach(() => {
  cleanup();
});
