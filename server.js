import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { sellFragment, buildDefaultOptions } from "./sell.js";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.join(__dirname, "public")));

app.get("/api/defaults", (_req, res) => {
  res.json(buildDefaultOptions());
});

app.post("/api/sell", async (req, res) => {
  try {
    const result = await sellFragment(req.body ?? {});
    res.json({ success: true, ...result });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Sale Fragment UI запущен на http://localhost:${port}`);
});
