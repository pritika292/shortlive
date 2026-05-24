// Single-file source of truth for the author's contact info. Every link on
// the About page reads from here; swap any value to update the site.

export interface Profile {
  fullName: string;
  intro: string;
  email: string;
  resumeUrl: string;
  linkedinUrl: string;
  githubUrl: string;
  portfolioUrl: string;
}

export const PROFILE: Profile = {
  fullName: "Pritika Priyadarshini",
  intro:
    "Backend / distributed-systems engineer. Five years shipping product-grade services. This and the rest of the projects on pritika.studio are how I show what I build when nobody's watching.",
  email: "pritikaapriyadarshini@gmail.com",
  resumeUrl: "https://pritika.studio/resume.pdf",
  linkedinUrl: "https://linkedin.com/in/pritika-priyadarshini",
  githubUrl: "https://github.com/pritika292",
  portfolioUrl: "https://pritika.studio",
};
