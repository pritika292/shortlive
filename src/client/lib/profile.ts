// Single-file source of truth for the author's contact info. Every link on
// the About page reads from here; swap any value to update the site.
//
// All values below are PLACEHOLDERS for now. Replace before sharing the link
// with anyone real.

export interface Profile {
  fullName: string;
  intro: string;
  email: string;
  resumeUrl: string;
  linkedinUrl: string;
  githubUrl: string;
  portfolioUrl: string;
  calendlyUrl: string;
}

export const PROFILE: Profile = {
  fullName: "Pritika Priyadarshini",
  intro:
    "Fullstack and distributed-systems engineer. Currently building this and a handful of other small live projects to show how I'd ship product-quality code in a week.",
  // PLACEHOLDERS — swap these in src/client/lib/profile.ts when ready.
  email: "hello@example.com",
  resumeUrl: "https://example.com/pritika-resume.pdf",
  linkedinUrl: "https://www.linkedin.com/in/example",
  githubUrl: "https://github.com/pritika292",
  portfolioUrl: "https://example.com",
  calendlyUrl: "https://calendly.com/example/intro",
};
