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

  it("renders the intro and five contact rows pointing at PROFILE", () => {
    render(<AboutPage />);
    expect(screen.getByRole("heading", { name: /Hi, I.m/i })).toBeInTheDocument();
    expect(screen.getByText(PROFILE.intro)).toBeInTheDocument();

    // Each row exposes its href; the easiest assert is to walk all links and
    // confirm the five contact URLs are present (Calendly was dropped in the
    // 3-pane About refactor — #149 spec only lists resume/email/LinkedIn/
    // GitHub/portfolio).
    const hrefs = screen.getAllByRole("link").map((a) => a.getAttribute("href"));
    expect(hrefs).toContain(`mailto:${PROFILE.email}`);
    expect(hrefs).toContain(PROFILE.resumeUrl);
    expect(hrefs).toContain(PROFILE.linkedinUrl);
    expect(hrefs).toContain(PROFILE.githubUrl);
    expect(hrefs).toContain(PROFILE.portfolioUrl);
  });
});
