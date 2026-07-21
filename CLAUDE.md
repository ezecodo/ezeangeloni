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

## Why this exists

The project's reason for being is **digital independence**. The user (Eze) is a DJ who wanted to publish his sets without depending on SoundCloud / Mixcloud — no ads injected over his music, no algorithm dictating reach, no third party owning his stats or audience. The whole site exists so that when a venue, label or festival receives a link to his set, they hear pure music in his own visual identity, on his own infrastructure. This positioning ("digital independence, my own system, not the same channel as every other DJ") matters when scoping new features: prefer self-hosted, prefer ownership, avoid dependencies that would dilute that story.

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

**Master audio processing** (applied to the whole set, non-destructively from the original on each save):
- Trim start/end
- Fade in/out
- Loudness normalization to -14 LUFS (save-only, not previewed)
- De-clipping — reconstruct saturated peaks (save-only)
- High-pass filter at 80Hz (remove rumble)
- Master limiter (prevent any final clipping)
- Compressor presets (subtle / medium / heavy)
- 3-band EQ (low shelf via `bass`, mid peak at 1.5kHz, high shelf via `treble`, ±12 dB each)
- **Reverb** (0-100%) — multi-tap echo approximation on server, ConvolverNode w/ synthesized IR in browser preview
- **Stereo width** (-100% to +100%) — `extrastereo` filter on server, mid/side matrix via ChannelSplitter/Merger in preview
- **Delay** (amount 0-100% + time 50-1000ms) — `aecho` on server, DelayNode with feedback in preview

**Effect regions** (per-time-range processing, applied via ffmpeg's `enable='between(t,start,end)'` clause and previewed live in the browser):
- `volume` — gain in dB (±30)
- `lowpass` — cutoff Hz (20–20000, log scale)
- `highpass` — cutoff Hz (20–20000, log scale)
- `eq` — single peaking band (freq + gain + Q)
- `saturation` — drive multiplier (1×–10×, server uses `aeval=tanh(K*val(0))/tanh(K)` for harmonic saturation)

Region times are stored in **original-time** (so changing master trim doesn't break alignment). Backward compat: legacy `volumeRegions[]` are auto-merged into `effectRegions[]` server-side and on UI load.

**Admin UI** (channel-strip layout above the regions zone, both inside the WaveSurfer editor div):
- **Channel strip panels**: trim · fades · cleanup · compressor · EQ · space (reverb+width) · delay
- **Custom knobs**: CSS+JS, drag vertically to adjust, double-click to reset, shift+drag for fine resolution
- **Vertical faders** for fade in/out (mixer-style)
- Real-time preview toggle "🔊 hear effects" routes audio through a Web Audio chain that mirrors the server's filter ordering
- The two save-only effects (de-clip, normalize) are flagged with a yellow ● marker

**Region UX** (multiple ways to create / select a region):
- **Drag on the waveform** with no type armed → creates a `volume` region of the dragged range
- **Click a type button (vol/LP/HP/EQ/sat) to "arm" it** (button pulses pink), then either:
  - Drag on the waveform → region of that type with the dragged range, OR
  - Click a start point → marker appears, click an end point → region created (arming auto-clears after creation; Esc cancels the pending start marker)
- **Pure click on empty waveform** = seek the play cursor (works whether or not a type is armed; click-click region uses the same clicks for both seek + marker)
- **Click on an existing region in the waveform** = highlight (pink glow) its row in the list below + scroll it into view
- **Click on a row in the list** (in the empty area, not on inputs) = same highlight + seek the play cursor to that region's start
- Drag the body of an existing region = move it; drag the edges = resize (handled natively by WaveSurfer)
- Region's `start`/`end` are stored in original-time (pre-trim); the on-screen position is `original - trimOffset`

**Coordinate notes for future work on the editor**:
- WaveSurfer 7 renders into a shadow DOM inside the first child of the container; `wsRoot.getBoundingClientRect()` is NOT reliably the wave's actual bounds
- Use `ws.renderer.wrapper` (full wave width, position shifts with scroll) for converting clientX → time. Falls back to `scrollContainer` (with `scrollLeft` + `scrollWidth` math) and then shadow-DOM probing. See `getTimeAt()` inside `installManualDragSelect` in `public/admin/index.html`
- Pointer capture is delayed until the drag-threshold (4px) is crossed — captures during pure clicks would block WaveSurfer's seek behavior
- Pure click without movement = explicit `ws.seekTo(...)` call, since pointer capture (if it had been set) blocks WaveSurfer's own click-to-seek

**Trackpad / scroll gestures on the waveform**:
- **Pinch (wheel + ctrlKey)** → smooth multiplicative zoom (`Math.exp(-deltaY * 0.012)`); also handles Safari's legacy `gesturestart/change/end` events
- **Two-finger horizontal scroll** → seeks the playhead through the audio (NOT just panning the view). Sensitivity scales with current px/sec so zoomed-in scrubbing is fine-grained while zoomed-out scrolling jumps faster. The view auto-pans to keep the playhead visible (margin 15%) when zoomed
- Zoom range clamped 0–800 px/sec; double-click on knobs resets to default

**BPM + key detection** (lazy-loaded, only when "🎯 detect" is clicked):
- **BPM**: `web-audio-beat-detector` (esm.sh, ~30KB). Calls `guess()` for `{ bpm, offset }`; falls back to `analyze()` for just the BPM. Result populates the BPM and offset fields, auto-enables the grid overlay
- **Key**: in-house chromagram + Albrecht-Shanahan (2013) profiles + bass-region weighting (2.2× for 60–260Hz). Uses `fft.js` (esm.sh, ~3KB) for FFT, then correlates against the 24 major/minor profiles. Returns the best match plus top alternatives — a `↻` button next to the key field cycles through them
- Both detections work in browser only; nothing about BPM or key is computed server-side
- BPM, offset, and key are persisted in `edits.bpm` / `edits.bpmOffset` / `edits.musicalKey` and shown in the public player overlay (e.g. `2026-05-13 · 124.0 BPM · A minor`) so a venue/festival opening a share link sees the musical context at a glance

**Beat grid overlay** (canvas on top of the waveform):
- Toggle "show grid" in the tempo bar
- Lines computed as `60 / bpm` seconds apart from the offset; every 4th line is a cyan "downbeat" (assumes 4/4)
- Re-rendered on `ws.zoom`, `ws.scroll`, `ws.redraw`, BPM/offset input change, and window resize
- It's pure math from the two inputs — accuracy depends on the user picking the right BPM + offset. For multi-tempo DJ sets the line-up drifts across the set (single-BPM assumption)

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
      "edits": {
        "trimStart": 0, "trimEnd": 0,
        "fadeIn": 0, "fadeOut": 0,
        "normalize": true,
        "declip": false, "limiter": false, "highpass": false,
        "compressor": "",
        "eqLow": 0, "eqMid": 0, "eqHigh": 0,
        "reverb": 0, "stereoWidth": 0, "delayAmount": 0, "delayTime": 300,
        "bpm": 124.0, "bpmOffset": 0.32, "musicalKey": "A minor",
        "volumeRegions": [],
        "effectRegions": [
          { "type": "volume", "start": 30, "end": 45, "params": { "gainDb": -6 } },
          { "type": "lowpass", "start": 60, "end": 75, "params": { "cutoff": 800 } },
          { "type": "eq", "start": 100, "end": 130, "params": { "freq": 80, "gain": 6, "q": 1 } },
          { "type": "saturation", "start": 200, "end": 220, "params": { "drive": 3 } }
        ]
      },
      "artwork": "/sets/artworks/set1.jpg",
      "tracklist": [{ "at": 0, "label": "Intro" }, { "at": 330, "label": "Artist - Track" }]
    }
  ]
}
```

## Future
- Telegram bot integration (n8n workflow) calling `POST /api/sets` from the existing bot, so sets can be uploaded via Telegram like frases.
- Optional nginx tuning: dedicated `location /sets/` with `Cache-Control: public, max-age=31536000, immutable` for cleaner audio caching.
