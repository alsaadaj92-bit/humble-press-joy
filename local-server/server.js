/**
 * LocalGallery Pro — Companion Local Server
 * ------------------------------------------
 * A tiny Node.js / Express server that receives photo uploads from the
 * LocalGallery Pro web app and stores them on THIS machine's disk.
 *
 * Zero-Cloud: nothing leaves your LAN. The web app talks to this server
 * directly over your local network (e.g. http://192.168.1.100:3000).
 *
 * Endpoints:
 *   GET  /health                       health probe
 *   POST /upload                       single-shot multipart upload (legacy / small files)
 *   POST /upload/init                  { name, size, mime } -> { uploadId, chunkSize }
 *   GET  /upload/status/:uploadId      -> { received, size }
 *   POST /upload/chunk/:uploadId       raw body, ?offset=N  -> { received }
 *   POST /upload/complete/:uploadId    -> { url, path, name, size, mime }
 *   DELETE /upload/:uploadId           abort + cleanup partial
 *   GET  /files/<path>                 static file bytes
 *
 * Env: PORT (3000) STORAGE_DIR (./storage) MAX_MB (200) ALLOW_ORIGIN (*)
 *      CHUNK_MB (4)
 */

const express = require("express");
const multer = require("multer");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");

const PORT = Number(process.env.PORT || 3000);
const STORAGE_DIR = path.resolve(process.env.STORAGE_DIR || "./storage");
const TMP_DIR = path.join(STORAGE_DIR, ".uploads");
const MAX_MB = Number(process.env.MAX_MB || 200);
const CHUNK_MB = Number(process.env.CHUNK_MB || 4);
const ALLOW_ORIGIN = process.env.ALLOW_ORIGIN || "*";

fs.mkdirSync(STORAGE_DIR, { recursive: true });
fs.mkdirSync(TMP_DIR, { recursive: true });

const app = express();
app.use(cors({ origin: ALLOW_ORIGIN }));
app.use(express.json({ limit: "1mb" }));

// ---- single-shot upload (kept for small files / legacy clients) -----------
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
const upload = multer({ storage, limits: { fileSize: MAX_MB * 1024 * 1024 } });

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    app: "LocalGallery Pro Server",
    version: "1.1.0",
    storageDir: STORAGE_DIR,
    maxMb: MAX_MB,
    chunkMb: CHUNK_MB,
    features: ["single", "chunked", "resumable"],
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

// ---- chunked / resumable upload -------------------------------------------
function safeId(id) {
  return /^[a-f0-9]{16,64}$/i.test(String(id)) ? String(id) : null;
}
function metaPath(id) { return path.join(TMP_DIR, `${id}.json`); }
function partPath(id) { return path.join(TMP_DIR, `${id}.part`); }

app.post("/upload/init", (req, res) => {
  const { name, size, mime } = req.body || {};
  if (!name || typeof size !== "number" || size <= 0) {
    return res.status(400).json({ error: "name and size required" });
  }
  if (size > MAX_MB * 1024 * 1024) {
    return res.status(413).json({ error: `size exceeds ${MAX_MB}MB` });
  }
  const uploadId = crypto.randomBytes(16).toString("hex");
  const meta = {
    uploadId,
    name: String(name),
    size,
    mime: String(mime || "application/octet-stream"),
    createdAt: Date.now(),
  };
  fs.writeFileSync(metaPath(uploadId), JSON.stringify(meta));
  fs.writeFileSync(partPath(uploadId), Buffer.alloc(0));
  res.json({ uploadId, chunkSize: CHUNK_MB * 1024 * 1024, received: 0, size });
});

app.get("/upload/status/:id", (req, res) => {
  const id = safeId(req.params.id);
  if (!id || !fs.existsSync(metaPath(id))) return res.status(404).json({ error: "unknown uploadId" });
  const meta = JSON.parse(fs.readFileSync(metaPath(id), "utf8"));
  const received = fs.existsSync(partPath(id)) ? fs.statSync(partPath(id)).size : 0;
  res.json({ uploadId: id, received, size: meta.size });
});

// Raw binary body — must be BEFORE any body parser for this route.
app.post(
  "/upload/chunk/:id",
  express.raw({ type: "*/*", limit: (CHUNK_MB + 2) * 1024 * 1024 }),
  (req, res) => {
    const id = safeId(req.params.id);
    if (!id || !fs.existsSync(metaPath(id))) return res.status(404).json({ error: "unknown uploadId" });
    const meta = JSON.parse(fs.readFileSync(metaPath(id), "utf8"));
    const offset = Number(req.query.offset || 0);
    const cur = fs.statSync(partPath(id)).size;
    if (offset !== cur) {
      return res.status(409).json({ error: "offset mismatch", expected: cur, received: cur });
    }
    const buf = req.body;
    if (!Buffer.isBuffer(buf) || buf.length === 0) {
      return res.status(400).json({ error: "empty chunk" });
    }
    if (cur + buf.length > meta.size) {
      return res.status(413).json({ error: "chunk exceeds declared size" });
    }
    fs.appendFileSync(partPath(id), buf);
    res.json({ uploadId: id, received: cur + buf.length, size: meta.size });
  },
);

app.post("/upload/complete/:id", (req, res) => {
  const id = safeId(req.params.id);
  if (!id || !fs.existsSync(metaPath(id))) return res.status(404).json({ error: "unknown uploadId" });
  const meta = JSON.parse(fs.readFileSync(metaPath(id), "utf8"));
  const received = fs.statSync(partPath(id)).size;
  if (received !== meta.size) {
    return res.status(400).json({ error: "size mismatch", received, expected: meta.size });
  }
  const d = new Date();
  const sub = path.join(String(d.getFullYear()), String(d.getMonth() + 1).padStart(2, "0"));
  const destDir = path.join(STORAGE_DIR, sub);
  fs.mkdirSync(destDir, { recursive: true });
  const shortId = crypto.randomBytes(8).toString("hex");
  const safe = meta.name.replace(/[^\w.\-]+/g, "_");
  const finalName = `${Date.now()}_${shortId}_${safe}`;
  const finalPath = path.join(destDir, finalName);
  fs.renameSync(partPath(id), finalPath);
  fs.unlinkSync(metaPath(id));
  const rel = path.relative(STORAGE_DIR, finalPath).split(path.sep).join("/");
  res.json({
    url: `/files/${rel}`,
    path: rel,
    name: meta.name,
    size: meta.size,
    mime: meta.mime,
  });
});

app.delete("/upload/:id", (req, res) => {
  const id = safeId(req.params.id);
  if (!id) return res.status(400).json({ error: "bad id" });
  for (const p of [metaPath(id), partPath(id)]) {
    if (fs.existsSync(p)) fs.unlinkSync(p);
  }
  res.json({ ok: true });
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
  console.log(`    max file: ${MAX_MB} MB   chunk: ${CHUNK_MB} MB\n`);
});
