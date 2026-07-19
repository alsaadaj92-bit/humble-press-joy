/**
 * LocalGallery Pro — Companion Local Server
 * ------------------------------------------
 * A tiny Node.js / Express server that receives photo uploads from the
 * LocalGallery Pro web app and stores them on THIS machine's disk.
 *
 * Zero-Cloud: nothing leaves your LAN. The web app talks to this server
 * directly over your local network (e.g. http://192.168.1.100:3000).
 *
 * Usage:
 *   1) Install Node.js 18+ (https://nodejs.org)
 *   2) In this folder run:   npm install
 *   3) Start the server:     npm start
 *   4) In the web app → مزودو التخزين → الخادم المحلي,
 *      set the address to http://<this-pc-ip>:3000  and press "اختبار".
 *
 * Environment variables (optional):
 *   PORT          default 3000
 *   STORAGE_DIR   default ./storage   (where files are written)
 *   MAX_MB        default 200         (per-file size limit)
 *   ALLOW_ORIGIN  default *           (CORS — set to your app URL to lock down)
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

// ---- storage ---------------------------------------------------------------
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
    cb(null, `${Date.now()}_${id}_${safe}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_MB * 1024 * 1024 },
});

// ---- routes ----------------------------------------------------------------
app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    app: "LocalGallery Pro Server",
    version: "1.0.0",
    storageDir: STORAGE_DIR,
    maxMb: MAX_MB,
  });
});

app.post("/upload", upload.single("file"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "no file" });
  const rel = path.relative(STORAGE_DIR, req.file.path).split(path.sep).join("/");
  res.json({
    url: `/files/${rel}`,
    path: rel,
    name: req.file.originalname,
    size: req.file.size,
    mime: req.file.mimetype,
  });
});

app.use("/files", express.static(STORAGE_DIR, { fallthrough: false, maxAge: "1h" }));

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: err.message || "internal error" });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`\n📸  LocalGallery Pro server running`);
  console.log(`    http://localhost:${PORT}`);
  console.log(`    storage: ${STORAGE_DIR}`);
  console.log(`    max file: ${MAX_MB} MB\n`);
});
