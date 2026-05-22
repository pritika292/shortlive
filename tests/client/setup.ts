import { afterEach, vi } from "vitest";
import { cleanup } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";

// Vitest globals are off, so Testing Library's built-in cleanup hook never
// gets registered. Do it explicitly to avoid bleed-over between tests.
afterEach(() => {
  cleanup();
});

// jsdom doesn't implement matchMedia; useTheme's system-preference resolver
// reads it. Stub it to default-light so tests don't have to.
if (typeof window !== "undefined" && !window.matchMedia) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}
