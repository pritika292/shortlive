import { customAlphabet } from "nanoid";
import type pg from "pg";

const ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
const SHORT_LENGTH = 7;
const MAX_RETRIES = 3;

export const generateShort: () => string = customAlphabet(ALPHABET, SHORT_LENGTH);

export class ShortcodeCollisionError extends Error {
  constructor() {
    super("Failed to generate a unique shortcode after multiple retries");
    this.name = "ShortcodeCollisionError";
  }
}

export interface ShortcodeInsertRow {
  short: string;
  target: string;
  ownerId: number;
  expiresAt?: Date | null;
  passwordHash?: string | null;
  createdIpHash?: string | null;
}

export async function insertWithGeneratedShort(
  db: pg.Pool | pg.PoolClient,
  row: Omit<ShortcodeInsertRow, "short">,
): Promise<{ short: string; id: number }> {
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    const short = generateShort();
    try {
      const { rows } = await db.query<{ id: string }>(
        `INSERT INTO urls(short, target, owner_id, expires_at, password_hash, created_ip_hash)
           VALUES($1, $2, $3, $4, $5, $6)
         RETURNING id`,
        [
          short,
          row.target,
          row.ownerId,
          row.expiresAt ?? null,
          row.passwordHash ?? null,
          row.createdIpHash ?? null,
        ],
      );
      const inserted = rows[0];
      if (!inserted) throw new Error("INSERT returned no row");
      return { short, id: Number(inserted.id) };
    } catch (err) {
      const code = (err as { code?: string }).code;
      if (code !== "23505") throw err;
    }
  }
  throw new ShortcodeCollisionError();
}
