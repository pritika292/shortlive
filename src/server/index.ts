import "dotenv/config";
import http from "node:http";
import { createApp } from "./app.js";
import { config } from "./config.js";
import { initGeo } from "./services/geo.js";
import { attachWebSocketServer } from "./ws/server.js";
import { seedDemo } from "./seed/demo.js";
import { startDemoSimulator } from "./seed/simulator.js";
import { startWebhookWorker, stopWebhookWorker } from "./services/webhook_worker.js";

const cfg = config();
await initGeo();

try {
  const seed = await seedDemo();
  if (seed.created) {
    console.log(`Demo link seeded (${seed.totalClicks} historical clicks).`);
  } else if (seed.toppedUp) {
    console.log(`Demo link topped up (${seed.totalClicks} clicks total).`);
  }
} catch (err) {
  console.error("Demo seeder failed; continuing without seeded demo", err);
}

const simulator = cfg.NODE_ENV === "test" ? null : startDemoSimulator();
if (cfg.NODE_ENV !== "test") startWebhookWorker();

const app = createApp();
const server = http.createServer(app);
attachWebSocketServer(server);

server.listen(cfg.PORT, () => {
  console.log(`shortlive listening on http://localhost:${cfg.PORT}`);
});

function shutdown(signal: NodeJS.Signals): void {
  console.log(`Received ${signal}; shutting down`);
  simulator?.stop();
  void stopWebhookWorker();
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 5_000).unref();
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
