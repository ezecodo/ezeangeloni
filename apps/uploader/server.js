import express from 'express';
import multer from 'multer';
import fs from 'fs/promises';
import path from 'path';

const PORT = parseInt(process.env.PORT || '3010', 10);
const UPLOAD_PASSWORD = process.env.UPLOAD_PASSWORD;
const SETS_DIR = process.env.SETS_DIR || '/var/www/ezeangeloni.xyz/html/sets';
const SETS_JSON = process.env.SETS_JSON || '/var/www/ezeangeloni.xyz/html/sets.json';
const MAX_SIZE_MB = parseInt(process.env.MAX_SIZE_MB || '300', 10);

if (!UPLOAD_PASSWORD) {
  console.error('FATAL: UPLOAD_PASSWORD env var is required');
  process.exit(1);
}

const app = express();
app.set('trust proxy', 'loopback');

const upload = multer({
  dest: '/tmp',
  limits: { fileSize: MAX_SIZE_MB * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!/^audio\//.test(file.mimetype)) return cb(new Error('only audio files allowed'));
    cb(null, true);
  }
});

const failedAttempts = new Map();
const RATE_WINDOW_MS = 10 * 60 * 1000;
const RATE_MAX = 5;
function checkRateLimit(ip) {
  const now = Date.now();
  const recent = (failedAttempts.get(ip) || []).filter(at => now - at < RATE_WINDOW_MS);
  failedAttempts.set(ip, recent);
  return recent.length < RATE_MAX;
}
function recordFailure(ip) {
  const arr = failedAttempts.get(ip) || [];
  arr.push(Date.now());
  failedAttempts.set(ip, arr);
}

function checkAuth(req, res, next) {
  const ip = req.ip || 'unknown';
  if (!checkRateLimit(ip)) return res.status(429).json({ error: 'rate limited, try later' });
  if (req.header('X-Auth') !== UPLOAD_PASSWORD) {
    recordFailure(ip);
    return res.status(401).json({ error: 'unauthorized' });
  }
  next();
}

function slugify(str) {
  return str
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

function uniqueSlug(base, existing) {
  if (!existing.includes(base)) return base;
  let i = 2;
  while (existing.includes(`${base}-${i}`)) i++;
  return `${base}-${i}`;
}

async function loadSets() {
  try {
    const raw = await fs.readFile(SETS_JSON, 'utf-8');
    const data = JSON.parse(raw);
    if (!Array.isArray(data.sets)) data.sets = [];
    return data;
  } catch {
    return { sets: [] };
  }
}

app.post('/api/sets/auth', express.json(), checkAuth, (_req, res) => {
  res.json({ ok: true });
});

app.post('/api/sets', checkAuth, upload.single('audio'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'no file uploaded' });

  const title = (req.body.title || '').trim();
  const date = (req.body.date || '').trim();

  const cleanup = async () => { try { await fs.unlink(req.file.path); } catch {} };

  if (!title) { await cleanup(); return res.status(400).json({ error: 'title required' }); }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) { await cleanup(); return res.status(400).json({ error: 'date must be YYYY-MM-DD' }); }

  const data = await loadSets();
  const baseSlug = slugify(title);
  if (!baseSlug) { await cleanup(); return res.status(400).json({ error: 'title produces empty slug' }); }
  const slug = uniqueSlug(baseSlug, data.sets.map(s => s.slug));

  const finalName = `${slug}.mp3`;
  const finalPath = path.join(SETS_DIR, finalName);

  try {
    await fs.rename(req.file.path, finalPath);
  } catch (e) {
    if (e.code === 'EXDEV') {
      // cross-device — fall back to copy + unlink
      await fs.copyFile(req.file.path, finalPath);
      await cleanup();
    } else {
      await cleanup();
      throw e;
    }
  }
  await fs.chmod(finalPath, 0o644);

  data.sets.unshift({ slug, title, date, audio: `/sets/${finalName}` });
  await fs.writeFile(SETS_JSON, JSON.stringify(data, null, 2) + '\n');

  res.json({
    ok: true,
    slug,
    audio: `/sets/${finalName}`,
    shareUrl: `https://ezeangeloni.xyz/?set=${slug}`
  });
});

app.use((err, _req, res, _next) => {
  console.error('[uploader error]', err.message);
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: `file too large (max ${MAX_SIZE_MB}MB)` });
  }
  res.status(500).json({ error: err.message || 'server error' });
});

app.listen(PORT, '127.0.0.1', () => {
  console.log(`[uploader] listening on http://127.0.0.1:${PORT}`);
  console.log(`[uploader] sets dir: ${SETS_DIR}`);
  console.log(`[uploader] sets json: ${SETS_JSON}`);
  console.log(`[uploader] max upload size: ${MAX_SIZE_MB}MB`);
});
