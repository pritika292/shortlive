import "dotenv/config";
import http from "node:http";
import { createApp } from "./app.js";
import { config } from "./config.js";
import { initGeo } from "./services/geo.js";
import { attachWebSocketServer } from "./ws/server.js";
import { seedDemo } from "./seed/demo.js";

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

const app = createApp();
const server = http.createServer(app);
attachWebSocketServer(server);

server.listen(cfg.PORT, () => {
  console.log(`shortlive listening on http://localhost:${cfg.PORT}`);
});
