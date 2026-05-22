import "dotenv/config";
import http from "node:http";
import { createApp } from "./app.js";
import { config } from "./config.js";
import { initGeo } from "./services/geo.js";
import { attachWebSocketServer } from "./ws/server.js";

const cfg = config();
await initGeo();
const app = createApp();
const server = http.createServer(app);
attachWebSocketServer(server);

server.listen(cfg.PORT, () => {
  console.log(`shortlive listening on http://localhost:${cfg.PORT}`);
});
