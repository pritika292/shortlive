import { describe, expect, it } from "vitest";
import { hashIp, extractIp } from "../../src/server/services/ip.js";

describe("ip helpers", () => {
  it("hashIp is deterministic for the same input + pepper", () => {
    expect(hashIp("1.2.3.4", "pep")).toBe(hashIp("1.2.3.4", "pep"));
  });

  it("hashIp varies with the pepper", () => {
    expect(hashIp("1.2.3.4", "pepA")).not.toBe(hashIp("1.2.3.4", "pepB"));
  });

  it("hashIp doesn't include the raw IP in the output", () => {
    const h = hashIp("203.0.113.42", "pep");
    expect(h).not.toContain("203.0.113.42");
    expect(h).toMatch(/^[0-9a-f]{64}$/);
  });

  it("extractIp uses x-forwarded-for first", () => {
    const ip = extractIp({
      headers: { "x-forwarded-for": "9.9.9.9, 10.0.0.1" },
      socket: { remoteAddress: "127.0.0.1" },
    });
    expect(ip).toBe("9.9.9.9");
  });

  it("extractIp falls back to req.ip then socket.remoteAddress", () => {
    expect(
      extractIp({
        ip: "5.5.5.5",
        headers: {},
        socket: { remoteAddress: "127.0.0.1" },
      }),
    ).toBe("5.5.5.5");
    expect(extractIp({ headers: {}, socket: { remoteAddress: "127.0.0.1" } })).toBe("127.0.0.1");
  });
});
