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

  it("toggles between dark (default) and light, persisting the choice", () => {
    render(<ThemeToggle />);
    // Default is dark, so the toggle button offers "switch to light".
    const toggle = screen.getByRole("button", { name: /switch to light/i });
    fireEvent.click(toggle);
    expect(window.localStorage.getItem("shortlive:theme")).toBe("light");
    expect(document.documentElement.classList.contains("dark")).toBe(false);

    const back = screen.getByRole("button", { name: /switch to dark/i });
    fireEvent.click(back);
    expect(window.localStorage.getItem("shortlive:theme")).toBe("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });

  it("renders a single toggle button", () => {
    render(<ThemeToggle />);
    expect(screen.getAllByRole("button").length).toBe(1);
  });
});
