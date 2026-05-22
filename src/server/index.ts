import express from "express";

const app = express();
const port = Number(process.env.PORT) || 3010;

app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.listen(port, () => {
  console.log(`shortlive listening on http://localhost:${port}`);
});
