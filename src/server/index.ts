import "dotenv/config";
import { createApp } from "./app.js";
import { config } from "./config.js";

const cfg = config();
const app = createApp();

app.listen(cfg.PORT, () => {
  console.log(`shortlive listening on http://localhost:${cfg.PORT}`);
});
