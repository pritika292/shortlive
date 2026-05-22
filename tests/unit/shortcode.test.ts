import { describe, expect, it, vi } from "vitest";
import {
  generateShort,
  insertWithGeneratedShort,
  ShortcodeCollisionError,
} from "../../src/server/services/shortcode.js";

describe("shortcode", () => {
  it("generates a 7-character code from the alphabet", () => {
    const s = generateShort();
    expect(s).toMatch(/^[0-9A-Za-z]{7}$/);
  });

  it("produces 1000 unique codes", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 1000; i++) seen.add(generateShort());
    expect(seen.size).toBe(1000);
  });

  it("retries on unique-violation and eventually succeeds", async () => {
    const collision = Object.assign(new Error("dup"), { code: "23505" });
    const query = vi
      .fn()
      .mockRejectedValueOnce(collision)
      .mockRejectedValueOnce(collision)
      .mockResolvedValueOnce({ rows: [{ id: "42" }] });
    const result = await insertWithGeneratedShort(
      // minimal pg.Pool stub
      { query } as never,
      { target: "https://x", ownerId: 1 },
    );
    expect(result.id).toBe(42);
    expect(query).toHaveBeenCalledTimes(3);
  });

  it("throws ShortcodeCollisionError after 3 failed retries", async () => {
    const collision = Object.assign(new Error("dup"), { code: "23505" });
    const query = vi.fn().mockRejectedValue(collision);
    await expect(
      insertWithGeneratedShort({ query } as never, { target: "https://x", ownerId: 1 }),
    ).rejects.toBeInstanceOf(ShortcodeCollisionError);
    expect(query).toHaveBeenCalledTimes(3);
  });

  it("re-throws non-collision errors immediately", async () => {
    const other = Object.assign(new Error("boom"), { code: "08006" });
    const query = vi.fn().mockRejectedValue(other);
    await expect(
      insertWithGeneratedShort({ query } as never, { target: "https://x", ownerId: 1 }),
    ).rejects.toThrow("boom");
    expect(query).toHaveBeenCalledTimes(1);
  });
});
