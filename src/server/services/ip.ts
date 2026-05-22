import { createHash } from "node:crypto";
import { config } from "../config.js";

export function hashIp(ip: string, pepper: string = config().IP_HASH_PEPPER): string {
  return createHash("sha256").update(`${pepper}:${ip}`).digest("hex");
}

export function extractIp(req: {
  ip?: string;
  headers: Record<string, string | string[] | undefined>;
  socket: { remoteAddress?: string };
}): string {
  const xff = req.headers["x-forwarded-for"];
  if (typeof xff === "string" && xff.length > 0) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  return req.ip ?? req.socket.remoteAddress ?? "0.0.0.0";
}
