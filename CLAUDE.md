# Eze Angeloni Landing — Project Notes

## Stack
Astro 5 static site, single page (`src/pages/index.astro`). Whole UX is one big canvas-based scene with floating bubbles that surface content: photos, frases, DJ sets, plus `about` and `message` modals.

## Deploy

Push to `main` → GitHub Action (`.github/workflows/deploy.yml`) builds (`npm ci && npm run build`) and rsyncs `dist/` to the VPS at `/var/www/ezeangeloni.xyz/html/`.

Rsync runs with `--delete`, so anything on the VPS that's NOT in `dist/` is wiped — except the paths in `--exclude`. Currently excluded (these live ONLY on the VPS, NOT in git):

- `frases.json` — phrases + photo metadata, edited live on server
- `images/` — photos referenced from `frases.json`
- `sets.json` — DJ sets metadata, edited live on server
- `sets/` — MP3 files for DJ sets

The `public/frases.json` and `public/sets.json` in the repo are dev/template only. The "real" versions on the VPS are separate.

## VPS

- Ubuntu, root, single nginx serving multiple subdomains as static + reverse proxies
- Landing at `/var/www/ezeangeloni.xyz/html/` (owner UID 1001 = user `eze`)
- nginx config: `/etc/nginx/sites-enabled/ezeangeloni.xyz`
- SSL via Certbot for `ezeangeloni.xyz` (covers `www` and `sets/` path automatically)
- Other subdomains on the box: `almacen` (separate Node app), `n8n.ezeangeloni.xyz` (n8n workflows for the Telegram bot that uploads frases/photos), `sj` (Next.js app)
- 233GB disk, ~217GB free

Known minor nginx issue: the `www → no-www` redirect uses `http://` instead of `https://`, causing a double redirect. Not urgent.

## Adding a new DJ set

1. Build the page locally and push (Action deploys, `sets/` stays intact).
2. SSH into VPS, copy MP3:
   ```bash
   scp ./mi-set.mp3 root@VPS:/var/www/ezeangeloni.xyz/html/sets/
   ```
3. SSH into VPS and add an entry to `/var/www/ezeangeloni.xyz/html/sets.json`:
   ```json
   {
     "sets": [
       { "slug": "mi-set", "title": "Mi Set de Junio", "date": "2026-06-15", "audio": "/sets/mi-set.mp3" }
     ]
   }
   ```
4. Verify with `curl -I https://ezeangeloni.xyz/sets/mi-set.mp3` — should return 200, `Accept-Ranges: bytes`, `Content-Type: audio/mpeg`.

The landing fetches `sets.json` at runtime, so no rebuild needed when adding sets.

## How the audio player works

- Each entry in `sets.json` claims one "spare slot" in the bubble grid, marked `__set__` in `LABELS`.
- Set bubbles render with a pink→purple gradient stroke, two breathing concentric rings, and a ▶ triangle.
- Tap/click opens an overlay with a custom player: play/pause, gradient seek bar with buffer indicator, time, copy-link button.
- `?set=<slug>` URL param auto-opens the matching set on page load — that's the share link.
- Playback position is saved to `localStorage` per slug; reopening picks up where you left.

## Aesthetic conventions
- Background `#080810`, text `#f0ede8`, muted `rgba(240,237,232,0.3)`
- Fonts: Cormorant Garamond (serif, italic, light) for titles; DM Mono (monospace, uppercase, wide letter-spacing) for UI labels and metadata
- Modals: glassmorphism (rgba bg + backdrop-filter blur), 16px rounded corners
- Color palette: `['#ff3f3f','#ff9f1c','#6ef9f5','#b8f75b','#c77dff','#ff6eb4','#38bdf8','#ffd166']`
- Bubble color cues: photos = cyan `#38bdf8`, sets = pink/purple `#ff6eb4`/`#c77dff`, message = yellow `#ffd166`

## Set uploader (mini backend)

Lives in `apps/uploader/` in this repo. Express server that exposes:

- `POST /api/sets/auth` — verify password without uploading
- `GET  /api/sets/list` — list all sets (for admin UI)
- `POST /api/sets` — multipart upload (audio + optional artwork) + metadata + optional audio processing
- `PATCH /api/sets/:slug` — edit metadata, re-process audio from original, swap/remove artwork
- `DELETE /api/sets/:slug` — remove mp3, original, artwork and json entry

All require header `X-Auth: <UPLOAD_PASSWORD>`. Rate limited: 5 failed auth attempts per IP per 10min.

**Admin UI** at `https://ezeangeloni.xyz/admin/` (`public/admin/index.html`, deployed by the Action). Two tabs: "upload new" (form with all processing options) and "manage" (list of existing sets with inline edit/delete). Password stored in localStorage on first successful login.

The admin form embeds **WaveSurfer.js** (loaded from unpkg via ESM) for waveform preview, play/pause, click-to-seek and zoom. Each timing input (trim start/end, fade in/out) has a 📍 button that captures the current playback position and fills the value — for the upload form that's the raw uploaded audio; for the edit form, the math accounts for existing trim values so the saved value is in original-time. There's also a "＋ cue at current position" button that appends a line to the tracklist textarea at the current preview position.

**Audio processing** uses `ffmpeg`/`ffprobe` installed on the VPS. Every upload:
1. Saves the original (any format) to `/root/sets-originals/<slug>.<ext>` — never modified.
2. Runs ffmpeg with the requested operations: optional trim start/end, fade in/out, loudness normalization to -14 LUFS.
3. Outputs MP3 192kbps to `/var/www/.../sets/<slug>.mp3` — the file the public player loads.
4. Stores edit params in `sets.json` so PATCH can re-render from the original with new params.

Re-renders are always **from the original**, so edits are non-destructive — changing trim/fade params later does NOT compound quality loss.

**File layout on the VPS:**
- `/root/apps/eze-repo/apps/uploader/` — repo clone, server.js, .env
- `/root/sets-originals/<slug>.<ext>` — uncompressed/original uploads (kept forever for re-editing)
- `/var/www/ezeangeloni.xyz/html/sets/<slug>.mp3` — public MP3 served by nginx
- `/var/www/ezeangeloni.xyz/html/sets/artworks/<slug>.<ext>` — public artwork
- `/var/www/ezeangeloni.xyz/html/sets.json` — metadata file the landing fetches

**Runs as PM2** process `set-uploader` listening on `127.0.0.1:3010`. Updates: `cd /root/apps/eze-repo && git pull && cd apps/uploader && npm install --omit=dev && pm2 restart set-uploader`.

**Env vars** (in `apps/uploader/.env`, chmod 600):
- `UPLOAD_PASSWORD` — required
- `PORT` (3010), `SETS_DIR`, `ORIGINALS_DIR`, `ARTWORKS_DIR`, `SETS_JSON`, `PUBLIC_ROOT`, `MAX_SIZE_MB` (800) — optional overrides

**Nginx** in the `ezeangeloni.xyz` block proxies `/api/sets*` to `127.0.0.1:3010` and sets `client_max_body_size 320M;` plus `proxy_read_timeout 600s`. Detailed config in `apps/uploader/README.md`.

**sets.json schema:**
```json
{
  "sets": [
    {
      "slug": "set1",
      "title": "Set 1",
      "date": "2026-05-13",
      "audio": "/sets/set1.mp3",
      "duration": 1122,
      "originalExt": "wav",
      "edits": { "trimStart": 0, "trimEnd": 0, "fadeIn": 0, "fadeOut": 0, "normalize": true },
      "artwork": "/sets/artworks/set1.jpg",
      "tracklist": [{ "at": 0, "label": "Intro" }, { "at": 330, "label": "Artist - Track" }]
    }
  ]
}
```

## Future
- Telegram bot integration (n8n workflow) calling `POST /api/sets` from the existing bot, so sets can be uploaded via Telegram like frases.
- Optional nginx tuning: dedicated `location /sets/` with `Cache-Control: public, max-age=31536000, immutable` for cleaner audio caching.
