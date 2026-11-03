import express from 'express';
import multer from 'multer';
import fs from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { saveLinks, storeLinkImage } from './links.js';
import * as galaxies from './galaxies.js';
import { addPhoto, addText, fromTelegram, ensureImagesDir, monthLabel, backfillThumbs } from './frases.js';

// === Config ===
const PORT = parseInt(process.env.PORT || '3010', 10);
const UPLOAD_PASSWORD = process.env.UPLOAD_PASSWORD;
const SETS_DIR = process.env.SETS_DIR || '/var/www/ezeangeloni.xyz/html/sets';
const ARTWORKS_DIR = process.env.ARTWORKS_DIR || path.join(SETS_DIR, 'artworks');
const ORIGINALS_DIR = process.env.ORIGINALS_DIR || '/root/sets-originals';
const SETS_JSON = process.env.SETS_JSON || '/var/www/ezeangeloni.xyz/html/sets.json';
const PUBLIC_ROOT = process.env.PUBLIC_ROOT || '/var/www/ezeangeloni.xyz/html';
const MAX_SIZE_MB = parseInt(process.env.MAX_SIZE_MB || '800', 10);

if (!UPLOAD_PASSWORD) {
  console.error('FATAL: UPLOAD_PASSWORD env var is required');
  process.exit(1);
}

// === ffmpeg / ffprobe helpers ===
function runProc(cmd, args) {
  return new Promise((resolve, reject) => {
    const proc = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '', stderr = '';
    proc.stdout.on('data', d => { stdout += d.toString(); });
    proc.stderr.on('data', d => { stderr += d.toString(); });
    proc.on('error', reject);
    proc.on('close', code => {
      if (code === 0) resolve(stdout.trim());
      else reject(new Error(`${cmd} exited ${code}: ${stderr.slice(-400)}`));
    });
  });
}

async function getDurationSec(filepath) {
  const out = await runProc('ffprobe', [
    '-v', 'error',
    '-show_entries', 'format=duration',
    '-of', 'default=noprint_wrappers=1:nokey=1',
    filepath
  ]);
  return parseFloat(out) || 0;
}

const COMPRESSOR_PRESETS = {
  subtle: 'acompressor=threshold=-12dB:ratio=2:attack=20:release=200:makeup=2',
  medium: 'acompressor=threshold=-18dB:ratio=4:attack=10:release=150:makeup=4',
  heavy:  'acompressor=threshold=-24dB:ratio=8:attack=5:release=100:makeup=6'
};

async function processAudio(input, output, opts = {}) {
  const trimStart = Math.max(0, Number(opts.trimStart) || 0);
  const trimEnd = Math.max(0, Number(opts.trimEnd) || 0);
  const fadeIn = Math.max(0, Number(opts.fadeIn) || 0);
  const fadeOut = Math.max(0, Number(opts.fadeOut) || 0);
  const normalize = !!opts.normalize;
  const declip = !!opts.declip;
  const limiter = !!opts.limiter;
  const highpass = !!opts.highpass;
  const compressor = COMPRESSOR_PRESETS[String(opts.compressor || '').toLowerCase()] || null;
  const eqLow = Math.max(-12, Math.min(12, Number(opts.eqLow) || 0));
  const eqMid = Math.max(-12, Math.min(12, Number(opts.eqMid) || 0));
  const eqHigh = Math.max(-12, Math.min(12, Number(opts.eqHigh) || 0));
  const reverb = Math.max(0, Math.min(100, Number(opts.reverb) || 0));
  const stereoWidth = Math.max(-100, Math.min(100, Number(opts.stereoWidth) || 0));
  const delayAmount = Math.max(0, Math.min(100, Number(opts.delayAmount) || 0));
  const delayTime = Math.max(50, Math.min(1000, Number(opts.delayTime) || 300));
  const volumeRegions = Array.isArray(opts.volumeRegions) ? opts.volumeRegions : [];
  const effectRegions = Array.isArray(opts.effectRegions) ? opts.effectRegions : [];
  // legacy volumeRegions get folded into effectRegions
  const allEffectRegions = effectRegions.concat(
    volumeRegions.map(r => ({ type: 'volume', start: r.start, end: r.end, params: { gainDb: r.gainDb } }))
  );

  const sourceDuration = await getDurationSec(input);
  const effectiveDuration = Math.max(0.5, sourceDuration - trimStart - trimEnd);

  const args = ['-y', '-hide_banner', '-loglevel', 'error'];
  if (trimStart > 0) args.push('-ss', String(trimStart));
  args.push('-i', input);
  if (trimStart > 0 || trimEnd > 0) args.push('-t', String(effectiveDuration));

  const filters = [];

  // cleanup first
  if (highpass) filters.push('highpass=f=80');
  if (declip) filters.push('adeclip');

  // dynamics
  if (compressor) filters.push(compressor);

  // effect regions (stored in ORIGINAL time; convert to pipeline time = original - trimStart)
  for (const reg of allEffectRegions) {
    const origStart = Number(reg.start) || 0;
    const origEnd = Number(reg.end) || 0;
    if (origEnd <= origStart) continue;
    const pStart = origStart - trimStart;
    const pEnd = origEnd - trimStart;
    if (pEnd < 0 || pStart > effectiveDuration) continue;
    const start = Math.max(0, pStart);
    const end = Math.min(effectiveDuration, pEnd);
    if (end <= start) continue;
    const enable = `:enable='between(t,${start.toFixed(3)},${end.toFixed(3)})'`;
    const p = reg.params || {};
    if (reg.type === 'volume') {
      const gDb = Math.max(-30, Math.min(30, Number(p.gainDb) || 0));
      const factor = Math.pow(10, gDb / 20);
      filters.push(`volume=${factor.toFixed(4)}${enable}`);
    } else if (reg.type === 'lowpass') {
      const f = Math.max(20, Math.min(20000, Number(p.cutoff) || 1000));
      filters.push(`lowpass=f=${f}${enable}`);
    } else if (reg.type === 'highpass') {
      const f = Math.max(20, Math.min(20000, Number(p.cutoff) || 100));
      filters.push(`highpass=f=${f}${enable}`);
    } else if (reg.type === 'eq') {
      const f = Math.max(20, Math.min(20000, Number(p.freq) || 1000));
      const g = Math.max(-24, Math.min(24, Number(p.gain) || 0));
      const q = Math.max(0.1, Math.min(10, Number(p.q) || 1));
      const w = Math.max(50, f / q);
      filters.push(`equalizer=f=${f}:t=h:w=${w.toFixed(1)}:g=${g}${enable}`);
    } else if (reg.type === 'saturation') {
      const drive = Math.max(1, Math.min(10, Number(p.drive) || 2));
      const norm = Math.tanh(drive);
      filters.push(`aeval=tanh(${drive}*val(0))/${norm.toFixed(4)}:channel_layout=stereo${enable}`);
    }
  }

  // EQ
  if (eqLow !== 0) filters.push(`bass=g=${eqLow}`);
  if (eqMid !== 0) filters.push(`equalizer=f=1500:t=h:w=2000:g=${eqMid}`);
  if (eqHigh !== 0) filters.push(`treble=g=${eqHigh}`);

  // stereo width (0=mono, 1=normal, >1=wider) — map -100..+100 to 0..3
  if (stereoWidth !== 0) {
    const m = stereoWidth >= 0 ? (1 + (stereoWidth / 100) * 2) : (1 + stereoWidth / 100);
    filters.push(`extrastereo=m=${m.toFixed(3)}:c=true`);
  }

  // delay / echo
  if (delayAmount > 0) {
    const wet = (delayAmount / 100) * 0.6; // limit max wet to 60%
    filters.push(`aecho=0.8:${wet.toFixed(3)}:${delayTime}:${(wet * 0.5).toFixed(3)}`);
  }

  // reverb (multi-tap echo approximation)
  if (reverb > 0) {
    const amt = reverb / 100;
    const taps = '40|97|143|211|283|389';
    const decays = [0.7, 0.5, 0.4, 0.3, 0.22, 0.16].map(d => (d * amt).toFixed(3)).join('|');
    filters.push(`aecho=0.7:${(0.9 * amt).toFixed(3)}:${taps}:${decays}`);
  }

  // fades
  if (fadeIn > 0) filters.push(`afade=t=in:st=0:d=${fadeIn}`);
  if (fadeOut > 0) {
    const start = Math.max(0, effectiveDuration - fadeOut);
    filters.push(`afade=t=out:st=${start}:d=${fadeOut}`);
  }

  // final stage
  if (normalize) filters.push('loudnorm=I=-14:LRA=11:TP=-1');
  if (limiter) filters.push('alimiter=limit=0.97:attack=5:release=50');

  if (filters.length) args.push('-af', filters.join(','));

  args.push('-b:a', '192k', '-ar', '44100', '-ac', '2', output);
  await runProc('ffmpeg', args);
  return await getDurationSec(output);
}

// === helpers ===
function slugify(str) {
  return String(str || '')
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

function parseTracklist(text) {
  if (!text || typeof text !== 'string') return [];
  return text.split('\n').map(raw => {
    const line = raw.trim();
    if (!line) return null;
    const m = line.match(/^(?:(\d+):)?(\d+):(\d+)\s+(.+?)\s*$/);
    if (!m) return null;
    const [, h, mm, ss, label] = m;
    const at = (parseInt(h || '0', 10) * 3600) + (parseInt(mm, 10) * 60) + parseInt(ss, 10);
    return { at, label: label.trim() };
  }).filter(x => x && x.label).sort((a, b) => a.at - b.at);
}

function safeBool(v) {
  return v === 'true' || v === 'on' || v === '1' || v === true;
}

function parseVolumeRegions(raw) {
  if (!raw) return [];
  let arr;
  try { arr = typeof raw === 'string' ? JSON.parse(raw) : raw; } catch { return []; }
  if (!Array.isArray(arr)) return [];
  return arr.map(r => ({
    start: Math.max(0, Number(r.start) || 0),
    end: Math.max(0, Number(r.end) || 0),
    gainDb: Math.max(-30, Math.min(30, Number(r.gainDb) || 0))
  })).filter(r => r.end > r.start);
}

function parseEffectRegions(raw) {
  if (!raw) return [];
  let arr;
  try { arr = typeof raw === 'string' ? JSON.parse(raw) : raw; } catch { return []; }
  if (!Array.isArray(arr)) return [];
  return arr.map(r => {
    const type = String(r.type || 'volume').toLowerCase();
    const start = Math.max(0, Number(r.start) || 0);
    const end = Math.max(0, Number(r.end) || 0);
    if (end <= start) return null;
    const p = r.params || {};
    let params;
    if (type === 'volume') {
      params = { gainDb: Math.max(-30, Math.min(30, Number(p.gainDb) || 0)) };
    } else if (type === 'lowpass') {
      params = { cutoff: Math.max(20, Math.min(20000, Number(p.cutoff) || 1000)) };
    } else if (type === 'highpass') {
      params = { cutoff: Math.max(20, Math.min(20000, Number(p.cutoff) || 100)) };
    } else if (type === 'eq') {
      params = {
        freq: Math.max(20, Math.min(20000, Number(p.freq) || 1000)),
        gain: Math.max(-24, Math.min(24, Number(p.gain) || 0)),
        q: Math.max(0.1, Math.min(10, Number(p.q) || 1))
      };
    } else if (type === 'saturation') {
      params = { drive: Math.max(1, Math.min(10, Number(p.drive) || 2)) };
    } else {
      return null;
    }
    return { type, start, end, params };
  }).filter(Boolean);
}

const ALLOWED_COMPRESSORS = ['', 'off', 'subtle', 'medium', 'heavy'];

function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }

function parseEditsBody(body) {
  return {
    trimStart: parseFloat(body.trimStart || '0') || 0,
    trimEnd: parseFloat(body.trimEnd || '0') || 0,
    fadeIn: parseFloat(body.fadeIn || '0') || 0,
    fadeOut: parseFloat(body.fadeOut || '0') || 0,
    normalize: safeBool(body.normalize),
    declip: safeBool(body.declip),
    limiter: safeBool(body.limiter),
    highpass: safeBool(body.highpass),
    compressor: ALLOWED_COMPRESSORS.includes(String(body.compressor || '').toLowerCase()) ? String(body.compressor || '').toLowerCase() : '',
    eqLow: clamp(parseFloat(body.eqLow || '0') || 0, -12, 12),
    eqMid: clamp(parseFloat(body.eqMid || '0') || 0, -12, 12),
    eqHigh: clamp(parseFloat(body.eqHigh || '0') || 0, -12, 12),
    reverb: clamp(parseFloat(body.reverb || '0') || 0, 0, 100),
    stereoWidth: clamp(parseFloat(body.stereoWidth || '0') || 0, -100, 100),
    delayAmount: clamp(parseFloat(body.delayAmount || '0') || 0, 0, 100),
    delayTime: clamp(parseFloat(body.delayTime || '300') || 300, 50, 1000),
    bpm: clamp(parseFloat(body.bpm || '0') || 0, 0, 400),
    bpmOffset: Math.max(0, parseFloat(body.bpmOffset || '0') || 0),
    musicalKey: String(body.musicalKey || '').trim().slice(0, 16),
    volumeRegions: parseVolumeRegions(body.volumeRegions),
    effectRegions: parseEffectRegions(body.effectRegions)
  };
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

async function saveSets(data) {
  await fs.writeFile(SETS_JSON, JSON.stringify(data, null, 2) + '\n');
}

async function ensureDir(p) {
  await fs.mkdir(p, { recursive: true });
}

async function moveFile(src, dest) {
  try {
    await fs.rename(src, dest);
  } catch (e) {
    if (e.code === 'EXDEV') {
      await fs.copyFile(src, dest);
      await fs.unlink(src).catch(() => {});
    } else {
      throw e;
    }
  }
}

async function safeUnlink(p) { try { await fs.unlink(p); } catch {} }

// === init dirs ===
await ensureDir(SETS_DIR);
await ensureDir(ARTWORKS_DIR);
await ensureDir(ORIGINALS_DIR);
await ensureImagesDir();
backfillThumbs().catch((e) => console.error('[thumbs]', e.message)); // in the background

// === express setup ===
const app = express();
app.set('trust proxy', 'loopback');

const upload = multer({
  dest: '/tmp',
  limits: { fileSize: MAX_SIZE_MB * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.fieldname === 'audio') {
      if (!/^audio\//.test(file.mimetype)) return cb(new Error('audio field requires an audio file'));
    } else if (file.fieldname === 'artwork') {
      if (!/^image\//.test(file.mimetype)) return cb(new Error('artwork field requires an image'));
    } else {
      return cb(new Error('unexpected field: ' + file.fieldname));
    }
    cb(null, true);
  }
});

// === rate limit + auth ===
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

// === routes ===

app.post('/api/sets/auth', express.json(), checkAuth, (_req, res) => {
  res.json({ ok: true });
});

app.get('/api/sets/list', checkAuth, async (_req, res) => {
  const data = await loadSets();
  res.json({ sets: data.sets });
});

app.post('/api/sets', checkAuth, upload.fields([
  { name: 'audio', maxCount: 1 },
  { name: 'artwork', maxCount: 1 }
]), async (req, res) => {
  const audio = req.files?.audio?.[0];
  const artwork = req.files?.artwork?.[0];

  const cleanupTmp = async () => {
    if (audio) await safeUnlink(audio.path);
    if (artwork) await safeUnlink(artwork.path);
  };

  if (!audio) { await cleanupTmp(); return res.status(400).json({ error: 'audio file required' }); }

  const title = (req.body.title || '').trim();
  const date = (req.body.date || '').trim();
  const tracklist = parseTracklist(req.body.tracklist || '');
  const edits = parseEditsBody(req.body);

  if (!title) { await cleanupTmp(); return res.status(400).json({ error: 'title required' }); }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) { await cleanupTmp(); return res.status(400).json({ error: 'date must be YYYY-MM-DD' }); }

  const data = await loadSets();
  const baseSlug = slugify(title);
  if (!baseSlug) { await cleanupTmp(); return res.status(400).json({ error: 'title produces empty slug' }); }
  const slug = uniqueSlug(baseSlug, data.sets.map(s => s.slug));

  const originalExt = (path.extname(audio.originalname).replace('.', '') || 'bin').toLowerCase();
  const originalPath = path.join(ORIGINALS_DIR, `${slug}.${originalExt}`);
  const mp3Path = path.join(SETS_DIR, `${slug}.mp3`);

  try {
    await moveFile(audio.path, originalPath);
  } catch (e) {
    await cleanupTmp();
    return res.status(500).json({ error: 'could not save original: ' + e.message });
  }

  let duration = 0;
  try {
    duration = await processAudio(originalPath, mp3Path, edits);
  } catch (e) {
    await safeUnlink(originalPath);
    if (artwork) await safeUnlink(artwork.path);
    return res.status(500).json({ error: 'audio processing failed: ' + e.message });
  }
  await fs.chmod(mp3Path, 0o644);

  let artworkUrl = null;
  if (artwork) {
    const ext = (path.extname(artwork.originalname).replace('.', '') || 'jpg').toLowerCase();
    const artPath = path.join(ARTWORKS_DIR, `${slug}.${ext}`);
    try {
      await moveFile(artwork.path, artPath);
      await fs.chmod(artPath, 0o644);
      artworkUrl = `/sets/artworks/${slug}.${ext}`;
    } catch (e) {
      console.error('[uploader] artwork save failed', e.message);
      await safeUnlink(artwork.path);
    }
  }

  const entry = {
    slug,
    title,
    date,
    audio: `/sets/${slug}.mp3`,
    duration: Math.round(duration),
    originalExt,
    edits,
    ...(artworkUrl ? { artwork: artworkUrl } : {}),
    ...(tracklist.length ? { tracklist } : {})
  };
  data.sets.unshift(entry);
  await saveSets(data);

  res.json({
    ok: true,
    slug,
    audio: entry.audio,
    duration: entry.duration,
    shareUrl: `https://ezeangeloni.xyz/?set=${slug}`
  });
});

app.patch('/api/sets/:slug', checkAuth, upload.fields([
  { name: 'artwork', maxCount: 1 }
]), async (req, res) => {
  const artwork = req.files?.artwork?.[0];
  const cleanupTmp = async () => { if (artwork) await safeUnlink(artwork.path); };

  const slug = req.params.slug;
  const data = await loadSets();
  const idx = data.sets.findIndex(s => s.slug === slug);
  if (idx === -1) { await cleanupTmp(); return res.status(404).json({ error: 'set not found' }); }
  const set = { ...data.sets[idx] };

  // metadata
  if (req.body.title !== undefined) {
    const t = req.body.title.trim();
    if (!t) { await cleanupTmp(); return res.status(400).json({ error: 'title cannot be empty' }); }
    set.title = t;
  }
  if (req.body.date !== undefined) {
    const d = req.body.date.trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) { await cleanupTmp(); return res.status(400).json({ error: 'invalid date' }); }
    set.date = d;
  }
  if (req.body.tracklist !== undefined) {
    const tl = parseTracklist(req.body.tracklist);
    if (tl.length) set.tracklist = tl; else delete set.tracklist;
  }

  // audio edits → re-process from original
  const editFields = ['trimStart','trimEnd','fadeIn','fadeOut','normalize','declip','limiter','highpass','compressor','eqLow','eqMid','eqHigh','reverb','stereoWidth','delayAmount','delayTime','bpm','bpmOffset','musicalKey','volumeRegions','effectRegions'];
  const hasAudioEdit = editFields.some(f => req.body[f] !== undefined);
  if (hasAudioEdit) {
    const originalPath = path.join(ORIGINALS_DIR, `${slug}.${set.originalExt || 'bin'}`);
    if (!existsSync(originalPath)) {
      await cleanupTmp();
      return res.status(400).json({ error: 'original file missing; cannot re-process audio' });
    }
    // merge: start with current edits, override with anything provided in body
    const parsed = parseEditsBody(req.body);
    const newEdits = { ...(set.edits || {}) };
    for (const f of editFields) {
      if (req.body[f] !== undefined) newEdits[f] = parsed[f];
    }
    const tmpMp3 = `/tmp/${slug}-${Date.now()}.mp3`;
    let duration = 0;
    try {
      duration = await processAudio(originalPath, tmpMp3, newEdits);
    } catch (e) {
      await safeUnlink(tmpMp3);
      await cleanupTmp();
      return res.status(500).json({ error: 'audio processing failed: ' + e.message });
    }
    const mp3Path = path.join(SETS_DIR, `${slug}.mp3`);
    try {
      await moveFile(tmpMp3, mp3Path);
    } catch (e) {
      await safeUnlink(tmpMp3);
      await cleanupTmp();
      return res.status(500).json({ error: 'could not replace mp3: ' + e.message });
    }
    await fs.chmod(mp3Path, 0o644);
    set.duration = Math.round(duration);
    set.edits = newEdits;
  }

  // artwork
  if (artwork) {
    if (set.artwork) {
      await safeUnlink(path.join(PUBLIC_ROOT, set.artwork.replace(/^\//, '')));
    }
    const ext = (path.extname(artwork.originalname).replace('.', '') || 'jpg').toLowerCase();
    const artPath = path.join(ARTWORKS_DIR, `${slug}.${ext}`);
    try {
      await moveFile(artwork.path, artPath);
      await fs.chmod(artPath, 0o644);
      set.artwork = `/sets/artworks/${slug}.${ext}`;
    } catch (e) {
      await safeUnlink(artwork.path);
      return res.status(500).json({ error: 'artwork save failed: ' + e.message });
    }
  }
  if (safeBool(req.body.removeArtwork)) {
    if (set.artwork) {
      await safeUnlink(path.join(PUBLIC_ROOT, set.artwork.replace(/^\//, '')));
      delete set.artwork;
    }
  }

  data.sets[idx] = set;
  await saveSets(data);
  res.json({ ok: true, set });
});

app.delete('/api/sets/:slug', express.json(), checkAuth, async (req, res) => {
  const slug = req.params.slug;
  const data = await loadSets();
  const idx = data.sets.findIndex(s => s.slug === slug);
  if (idx === -1) return res.status(404).json({ error: 'set not found' });
  const set = data.sets[idx];

  await safeUnlink(path.join(SETS_DIR, `${slug}.mp3`));
  if (set.originalExt) {
    await safeUnlink(path.join(ORIGINALS_DIR, `${slug}.${set.originalExt}`));
  }
  if (set.artwork) {
    await safeUnlink(path.join(PUBLIC_ROOT, set.artwork.replace(/^\//, '')));
  }

  data.sets.splice(idx, 1);
  await saveSets(data);
  res.json({ ok: true });
});

// === frases / photos (the archive the Cronovisor draws) ===

// Who's asking: Eze's password opens his own galaxy (and everything else); a galaxy's password opens only that
// galaxy. The routes below write into whichever root that is.
async function checkWho(req, res, next) {
  const ip = req.ip || 'unknown';
  if (!checkRateLimit(ip)) return res.status(429).json({ error: 'rate limited, try later' });
  const pass = req.header('X-Auth');
  if (pass && pass === UPLOAD_PASSWORD) { req.who = { owner: true, root: undefined }; return next(); }
  const g = await galaxies.byPassword(pass).catch(() => null);
  if (!g) { recordFailure(ip); return res.status(401).json({ error: 'unauthorized' }); }
  req.who = { owner: false, slug: g.slug, name: g.name, dir: g.dir, root: g.root, public: g.public };
  next();
}
const rootFor = (req) => req.who.root; // undefined = Eze's, the functions' default

app.get('/api/frases/whoami', checkWho, (req, res) => {
  const w = req.who;
  res.json(w.owner ? { owner: true } : { owner: false, slug: w.slug, name: w.name, dir: w.dir, public: w.public });
});

const photoUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 30 * 1024 * 1024, files: 1 } });

// One photo per request (the admin sends a batch one by one, so each gets its own progress and retry).
app.post('/api/frases/photo', checkWho, photoUpload.single('photo'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'photo required' });
  try {
    const entry = await addPhoto(req.file.buffer, { fecha: req.body.fecha, caption: req.body.caption }, rootFor(req));
    res.json({ ok: true, entry, barrio: monthLabel(entry.fecha) });
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message });
  }
});

// A frase from the admin's words tab. The date is optional (today when missing).
app.post('/api/frases/text', express.json({ limit: '64kb' }), checkWho, async (req, res) => {
  const texto = String(req.body?.texto || '').trim();
  if (!texto) return res.status(400).json({ error: 'text required' });
  try {
    const entry = await addText(texto, req.body.fecha, rootFor(req));
    res.json({ ok: true, entry, barrio: monthLabel(entry.fecha) });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Floating links (admin's links tab). Under /api/frases so the existing nginx route serves them.
app.put('/api/frases/links', express.json({ limit: '64kb' }), checkWho, async (req, res) => {
  try {
    res.json({ ok: true, links: await saveLinks(req.body?.links, rootFor(req)) });
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message });
  }
});
const linkImageUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 4 * 1024 * 1024, files: 1 } });
app.post('/api/frases/links/image', checkWho, linkImageUpload.single('image'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'image required' });
  try {
    res.json({ ok: true, image: await storeLinkImage(req.file.buffer, rootFor(req)) });
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message });
  }
});

// === galaxies (Eze only) ===
const galaxyRoute = (fn) => async (req, res) => {
  try { res.json(await fn(req)); } catch (e) { res.status(e.status || 500).json({ error: e.message }); }
};
app.get('/api/frases/galaxies', checkAuth, galaxyRoute(async () => galaxies.list()));
app.post('/api/frases/galaxies', express.json(), checkAuth, galaxyRoute(async (req) => galaxies.create(req.body?.name, req.body?.born)));
app.patch('/api/frases/galaxies/:slug', express.json(), checkAuth, galaxyRoute(async (req) => galaxies.update(req.params.slug, req.body || {})));
app.post('/api/frases/galaxies/:slug/password', checkAuth, galaxyRoute(async (req) => galaxies.resetPassword(req.params.slug)));
app.delete('/api/frases/galaxies/:slug', checkAuth, galaxyRoute(async (req) => { await galaxies.remove(req.params.slug); return { ok: true }; }));

// ── the door of a private galaxy ──
// Public routes. The visiting device sends its own random id; if its owner is logged into an admin on it, the
// site also sends that password, which says which galaxy (if any) is knocking, so two owners connect both ways.
const visitor = async (req) => galaxies.ownerOf(req.header('X-Auth'), UPLOAD_PASSWORD);
const limited = (max) => { const seen = new Map(); return (req) => {
  const ip = req.ip || 'unknown', now = Date.now();
  const recent = (seen.get(ip) || []).filter((t) => now - t < 10 * 60 * 1000);
  if (recent.length >= max) throw Object.assign(new Error('too many, try later'), { status: 429 });
  recent.push(now); seen.set(ip, recent);
}; };
const doorLimit = limited(240), knockLimit = limited(8), wordsLimit = limited(6);
app.post('/api/frases/doors', express.json({ limit: '8kb' }), galaxyRoute(async (req) => {
  doorLimit(req);
  const who = await visitor(req);
  const slugs = Array.isArray(req.body?.galaxies) ? req.body.galaxies.map(String) : [];
  return { who: who?.slug || null, doors: await galaxies.doors(slugs, String(req.body?.device || ''), who?.slug) };
}));
app.post('/api/frases/knock', express.json({ limit: '8kb' }), galaxyRoute(async (req) => {
  knockLimit(req);
  const who = await visitor(req);
  return galaxies.knock(String(req.body?.galaxy || ''), { name: req.body?.name, device: req.body?.device }, who?.slug, who?.name);
}));
// the owner's side: who's knocking, who's in
app.get('/api/frases/requests', checkWho, galaxyRoute(async (req) => (req.who.owner ? { requests: [], guests: [] } : galaxies.requests(req.who.slug))));
app.post('/api/frases/requests/:id', express.json(), checkWho, galaxyRoute(async (req) => {
  if (req.who.owner) throw Object.assign(new Error('your galaxy is open to all'), { status: 400 });
  return galaxies.decide(req.who.slug, req.params.id, req.body?.action === 'decline' ? 'decline' : 'approve');
}));
app.delete('/api/frases/guests/:id', checkWho, galaxyRoute(async (req) => {
  if (req.who.owner) throw Object.assign(new Error('your galaxy is open to all'), { status: 400 });
  return galaxies.turnAway(req.who.slug, req.params.id);
}));

// Words left with the balloon in someone else's galaxy (Eze's own still go to his Telegram through n8n).
app.post('/api/frases/words', express.json({ limit: '8kb' }), galaxyRoute(async (req) => {
  wordsLimit(req);
  const who = await visitor(req);
  await galaxies.leaveWords(String(req.body?.galaxy || ''), String(req.body?.device || ''), who?.slug, req.body?.text);
  return { ok: true };
}));
app.get('/api/frases/messages', checkWho, galaxyRoute(async (req) => {
  if (req.who.owner) return { messages: [] }; // Eze's arrive on Telegram
  return { messages: await galaxies.readWords(req.who.slug) };
}));

// Called by n8n (over SSH, on loopback) with the raw Telegram message. Answers with the bot's reply.
app.post('/api/frases/telegram', express.json({ limit: '1mb' }), checkAuth, async (req, res) => {
  try {
    const { status, reply } = await fromTelegram(req.body);
    res.status(status).type('text/plain').send(reply);
  } catch (e) {
    console.error('[telegram]', e.message);
    res.status(500).type('text/plain').send('⚠️ No pude guardarla: ' + e.message);
  }
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
  console.log(`[uploader] originals dir: ${ORIGINALS_DIR}`);
  console.log(`[uploader] artworks dir: ${ARTWORKS_DIR}`);
  console.log(`[uploader] sets json: ${SETS_JSON}`);
  console.log(`[uploader] max upload size: ${MAX_SIZE_MB}MB`);
});
