// Companion Node.js server source — displayed in the app so the user can
// copy/download it and run it on their own PC. Keep in sync with
// /local-server/server.js.
export const LOCAL_SERVER_CODE = String.raw`/**
 * LocalGallery Pro — Companion Local Server
 * Run:  npm install && npm start   (Node 18+)
 * Then connect the app to  http://<this-pc-ip>:3000
 */
const express = require("express");
const multer = require("multer");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

const PORT = Number(process.env.PORT || 3000);
const STORAGE_DIR = path.resolve(process.env.STORAGE_DIR || "./storage");
const MAX_MB = Number(process.env.MAX_MB || 200);
const ALLOW_ORIGIN = process.env.ALLOW_ORIGIN || "*";

fs.mkdirSync(STORAGE_DIR, { recursive: true });

const app = express();
app.use(cors({ origin: ALLOW_ORIGIN }));
app.use(express.json({ limit: "1mb" }));

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    const d = new Date();
    const sub = path.join(
      String(d.getFullYear()),
      String(d.getMonth() + 1).padStart(2, "0"),
    );
    const full = path.join(STORAGE_DIR, sub);
    fs.mkdirSync(full, { recursive: true });
    cb(null, full);
  },
  filename: (_req, file, cb) => {
    const id = crypto.randomBytes(8).toString("hex");
    const safe = file.originalname.replace(/[^\w.\-]+/g, "_");
    cb(null, Date.now() + "_" + id + "_" + safe);
  },
});
const upload = multer({ storage, limits: { fileSize: MAX_MB * 1024 * 1024 } });

app.get("/health", (_req, res) => {
  res.json({ ok: true, app: "LocalGallery Pro Server", version: "1.0.0",
    storageDir: STORAGE_DIR, maxMb: MAX_MB });
});

app.post("/upload", upload.single("file"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "no file" });
  const rel = path.relative(STORAGE_DIR, req.file.path).split(path.sep).join("/");
  res.json({ url: "/files/" + rel, path: rel, name: req.file.originalname,
    size: req.file.size, mime: req.file.mimetype });
});

app.use("/files", express.static(STORAGE_DIR, { fallthrough: false, maxAge: "1h" }));

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: err.message || "internal error" });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log("\\n📸  LocalGallery Pro server running");
  console.log("    http://localhost:" + PORT);
  console.log("    storage: " + STORAGE_DIR);
  console.log("    max file: " + MAX_MB + " MB\\n");
});
`;

export const LOCAL_SERVER_PACKAGE_JSON = `{
  "name": "localgallery-pro-server",
  "version": "1.0.0",
  "private": true,
  "main": "server.js",
  "scripts": { "start": "node server.js" },
  "engines": { "node": ">=18" },
  "dependencies": {
    "cors": "^2.8.5",
    "express": "^4.19.2",
    "multer": "^1.4.5-lts.1"
  }
}
`;
