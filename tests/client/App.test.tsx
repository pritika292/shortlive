import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { App } from "../../src/client/App.js";

describe("<App />", () => {
  it("renders the headline and a link to the demo dashboard", () => {
    render(<App />);
    expect(screen.getByRole("heading", { name: /shortlive/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /demo dashboard/i })).toHaveAttribute("href", "/demo");
  });
});
