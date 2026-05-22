import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ThemeToggle } from "../../src/client/components/ThemeToggle.js";

describe("<ThemeToggle />", () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.classList.remove("dark");
  });
  afterEach(() => {
    window.localStorage.clear();
    document.documentElement.classList.remove("dark");
  });

  it("cycles through the three preferences and persists each one", () => {
    render(<ThemeToggle />);
    const light = screen.getByRole("button", { name: /use light theme/i });
    const dark = screen.getByRole("button", { name: /use dark theme/i });
    const system = screen.getByRole("button", { name: /use system theme/i });

    fireEvent.click(light);
    expect(window.localStorage.getItem("shortlive:theme")).toBe("light");
    expect(document.documentElement.classList.contains("dark")).toBe(false);

    fireEvent.click(dark);
    expect(window.localStorage.getItem("shortlive:theme")).toBe("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);

    fireEvent.click(system);
    expect(window.localStorage.getItem("shortlive:theme")).toBe("system");
  });

  it("renders the three buttons", () => {
    render(<ThemeToggle />);
    expect(screen.getAllByRole("button").length).toBe(3);
  });
});
