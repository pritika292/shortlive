import { describe, expect, it } from "vitest";

describe("smoke", () => {
  it("arithmetic still works", () => {
    expect(1 + 1).toBe(2);
  });

  it("string concat still works", () => {
    expect("short" + "live").toBe("shortlive");
  });
});
