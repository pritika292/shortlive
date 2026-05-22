import type { Server as HttpServer, IncomingMessage } from "node:http";
import Redis from "ioredis";
import { WebSocketServer, type WebSocket } from "ws";
import { config } from "../config.js";
import { getPool } from "../db/pool.js";
import { clicksChannel, getRecentClicks } from "../services/redis.js";

const HEARTBEAT_MS = 30_000;

interface WsWithAlive extends WebSocket {
  isAlive?: boolean;
}

async function shortExists(short: string): Promise<boolean> {
  const { rows } = await getPool().query<{ exists: boolean }>(
    "SELECT EXISTS(SELECT 1 FROM urls WHERE short = $1) AS exists",
    [short],
  );
  return rows[0]?.exists ?? false;
}

export function attachWebSocketServer(httpServer: HttpServer): WebSocketServer {
  const wss = new WebSocketServer({ noServer: true });

  httpServer.on("upgrade", (req, socket, head) => {
    const url = new URL(req.url ?? "/", "http://localhost");
    const match = /^\/ws\/([0-9A-Za-z-]{3,32})$/.exec(url.pathname);
    if (!match) {
      socket.write("HTTP/1.1 404 Not Found\r\n\r\n");
      socket.destroy();
      return;
    }
    const short = match[1];
    if (!short) {
      socket.destroy();
      return;
    }
    wss.handleUpgrade(req, socket, head, (ws) => {
      handleConnection(ws as WsWithAlive, req, short).catch((err) => {
        console.error("ws handler failed", err);
        ws.close();
      });
    });
  });

  const interval = setInterval(() => {
    for (const client of wss.clients) {
      const wsa = client as WsWithAlive;
      if (wsa.isAlive === false) {
        wsa.terminate();
        continue;
      }
      wsa.isAlive = false;
      wsa.ping();
    }
  }, HEARTBEAT_MS);

  wss.on("close", () => clearInterval(interval));
  return wss;
}

async function handleConnection(
  ws: WsWithAlive,
  _req: IncomingMessage,
  short: string,
): Promise<void> {
  if (!(await shortExists(short))) {
    ws.close(1008, "unknown short");
    return;
  }

  ws.isAlive = true;
  ws.on("pong", () => {
    ws.isAlive = true;
  });

  const subscriber = new Redis(config().REDIS_URL);
  subscriber.on("message", (_chan, msg) => {
    if (ws.readyState === ws.OPEN) {
      ws.send(JSON.stringify({ type: "click", click: JSON.parse(msg) }));
    }
  });
  await subscriber.subscribe(clicksChannel(short));

  const recent = await getRecentClicks(short);
  ws.send(JSON.stringify({ type: "hydration", clicks: recent }));

  ws.on("close", () => {
    void subscriber.quit();
  });
}
