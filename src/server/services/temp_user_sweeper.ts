import { getPool } from "../db/pool.js";

// Sweep expired playground users every 5 minutes. The FK cascades on every
// project's tables (urls, sessions, ...) take care of wiping their owned
// rows. Permanent users have expires_at = NULL and are untouched.
const SWEEP_INTERVAL_MS = 5 * 60_000;

export interface Sweeper {
  stop: () => void;
}

export async function sweepExpiredUsers(): Promise<number> {
  const { rowCount } = await getPool().query(
    `DELETE FROM auth.users
       WHERE expires_at IS NOT NULL
         AND expires_at < NOW()`,
  );
  return rowCount ?? 0;
}

export function startTempUserSweeper(): Sweeper {
  let stopped = false;
  let timer: NodeJS.Timeout | null = null;

  const tick = async (): Promise<void> => {
    if (stopped) return;
    try {
      const deleted = await sweepExpiredUsers();
      if (deleted > 0) {
        console.log(`temp-user sweeper: deleted ${deleted} expired playground users`);
      }
    } catch (err) {
      console.error("temp-user sweeper tick failed", err);
    } finally {
      if (!stopped) {
        timer = setTimeout(() => void tick(), SWEEP_INTERVAL_MS);
      }
    }
  };

  // Run once on boot so leftovers from a previous deploy are cleared
  // immediately instead of waiting five minutes.
  timer = setTimeout(() => void tick(), 1_000);

  return {
    stop: () => {
      stopped = true;
      if (timer) clearTimeout(timer);
    },
  };
}
