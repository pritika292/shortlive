import { describe, expect, it } from "vitest";
import { loadConfig } from "../../src/server/config.js";

const validEnv = {
  DATABASE_URL: "postgres://localhost/x",
  REDIS_URL: "redis://localhost",
  SESSION_SECRET: "x".repeat(32),
};

describe("loadConfig", () => {
  it("parses a valid env and applies defaults", () => {
    const cfg = loadConfig(validEnv);
    expect(cfg.PORT).toBe(3010);
    expect(cfg.NODE_ENV).toBe("development");
    expect(cfg.DATABASE_URL).toBe(validEnv.DATABASE_URL);
  });

  it("rejects empty DATABASE_URL", () => {
    expect(() => loadConfig({ ...validEnv, DATABASE_URL: "" })).toThrow(/DATABASE_URL/);
  });

  it("rejects a short SESSION_SECRET", () => {
    expect(() => loadConfig({ ...validEnv, SESSION_SECRET: "short" })).toThrow(/SESSION_SECRET/);
  });

  it("coerces PORT to a number", () => {
    const cfg = loadConfig({ ...validEnv, PORT: "8080" });
    expect(cfg.PORT).toBe(8080);
  });

  it("rejects NODE_ENV outside the allowed enum", () => {
    expect(() => loadConfig({ ...validEnv, NODE_ENV: "staging" })).toThrow();
  });
});
