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

Lives in `apps/uploader/` in this repo. Small Express server that exposes:

- `POST /api/sets` (multipart: file + title + date) — auth via `X-Auth` header
- `POST /api/sets/auth` — verify password without uploading

The admin UI is at `https://ezeangeloni.xyz/admin/` (`public/admin/index.html`, deployed by the Action like the rest of `dist/`). Password is stored in localStorage on first successful login, no session cookies.

**On the VPS** the server runs as PM2 process `set-uploader`, listening on `127.0.0.1:3010`. Code lives at `/root/eze-repo/apps/uploader/`. Updates: `cd /root/eze-repo && git pull && cd apps/uploader && npm install --omit=dev && pm2 restart set-uploader`.

**Env vars** (in `apps/uploader/.env`, chmod 600):
- `UPLOAD_PASSWORD` — required, the form password
- `PORT`, `SETS_DIR`, `SETS_JSON`, `MAX_SIZE_MB` — optional overrides

**Nginx**: the `ezeangeloni.xyz` server block proxies `/api/sets*` to `127.0.0.1:3010` and sets `client_max_body_size 320M;`. See `apps/uploader/README.md` for the exact block.

The uploader handles slug generation from title (lowercase, dashed, no diacritics), file rename, atomic-ish update of `sets.json` (entries prepended so newest is first).

## Future
- Telegram bot integration (n8n workflow) calling `POST /api/sets` from the existing bot, so sets can be uploaded via Telegram like frases.
- Optional nginx tuning: dedicated `location /sets/` with `Cache-Control: public, max-age=31536000, immutable` for cleaner audio caching.
