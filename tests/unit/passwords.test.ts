import { describe, expect, it } from "vitest";
import { hash, verify } from "../../src/server/services/passwords.js";

describe("passwords", () => {
  it("verifies a hash against the original plaintext", async () => {
    const h = await hash("correct horse battery staple");
    expect(await verify("correct horse battery staple", h)).toBe(true);
  });

  it("rejects a wrong password", async () => {
    const h = await hash("hunter2");
    expect(await verify("hunter3", h)).toBe(false);
  });

  it("produces different hashes for the same input (salted)", async () => {
    const a = await hash("repeat");
    const b = await hash("repeat");
    expect(a).not.toBe(b);
    expect(await verify("repeat", a)).toBe(true);
    expect(await verify("repeat", b)).toBe(true);
  });

  it("uses cost factor 12 (hash takes >= 100ms)", async () => {
    const start = Date.now();
    await hash("anything");
    expect(Date.now() - start).toBeGreaterThanOrEqual(100);
  });
});
