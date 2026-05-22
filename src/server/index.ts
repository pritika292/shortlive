import "dotenv/config";
import { createApp } from "./app.js";
import { config } from "./config.js";
import { initGeo } from "./services/geo.js";

const cfg = config();
await initGeo();
const app = createApp();

app.listen(cfg.PORT, () => {
  console.log(`shortlive listening on http://localhost:${cfg.PORT}`);
});
