import { Queue } from "bullmq";
import Redis from "ioredis";
import { config } from "../config.js";

export const WEBHOOK_QUEUE = "shortlive-webhooks";

let queue: Queue | null = null;
let connection: Redis | null = null;

function getConnection(): Redis {
  if (!connection) {
    // BullMQ requires maxRetriesPerRequest = null on the connection it uses.
    connection = new Redis(config().REDIS_URL, { maxRetriesPerRequest: null });
  }
  return connection;
}

export function getWebhookQueue(): Queue {
  if (!queue) {
    queue = new Queue(WEBHOOK_QUEUE, { connection: getConnection() });
  }
  return queue;
}

export async function closeWebhookQueue(): Promise<void> {
  if (queue) {
    await queue.close();
    queue = null;
  }
  if (connection) {
    await connection.quit();
    connection = null;
  }
}
