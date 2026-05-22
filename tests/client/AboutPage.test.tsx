import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { AboutPage } from "../../src/client/pages/About.js";
import { PROFILE } from "../../src/client/lib/profile.js";

describe("<AboutPage />", () => {
  let fetchSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue(new Response("", { status: 401 }));
  });
  afterEach(() => {
    fetchSpy.mockRestore();
  });

  it("renders the intro and six contact rows pointing at PROFILE", () => {
    render(<AboutPage />);
    expect(screen.getByRole("heading", { name: /Hi, I.m/i })).toBeInTheDocument();
    expect(screen.getByText(PROFILE.intro)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Email/i })).toHaveAttribute(
      "href",
      `mailto:${PROFILE.email}`,
    );
    expect(screen.getByRole("link", { name: /Resume/i })).toHaveAttribute(
      "href",
      PROFILE.resumeUrl,
    );
    expect(screen.getByRole("link", { name: /LinkedIn/i })).toHaveAttribute(
      "href",
      PROFILE.linkedinUrl,
    );
    expect(screen.getByRole("link", { name: /GitHub/i })).toHaveAttribute(
      "href",
      PROFILE.githubUrl,
    );
    expect(screen.getByRole("link", { name: /Portfolio/i })).toHaveAttribute(
      "href",
      PROFILE.portfolioUrl,
    );
    expect(screen.getByRole("link", { name: /Schedule a chat/i })).toHaveAttribute(
      "href",
      PROFILE.calendlyUrl,
    );
  });
});
