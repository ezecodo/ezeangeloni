# Eze Angeloni Landing — Project Notes

## Stack
Astro 5 static site, single page (`src/pages/index.astro`). The whole UX is the **Cronovisor**, a 3D constellation of the archive (the name and "pasado observado" come from Eze's own frases of 2026-08-07). Built on Three.js, the only runtime dependency besides Astro: it's bundled by the build and served from the VPS, so it doesn't break the self-hosted positioning.

`astro dev` proxies `/frases.json`, `/sets.json`, `/images` and `/sets/` to production (see `astro.config.mjs`), so local shows the real content. It does not affect the build.

## Cronovisor

- **Stations**: `buildStations()` merges frases and sets by date. `n` is the archive number (oldest = 1), shown in the meta line; it shifts when something is dated into the past. The share link is the stable `id`: a photo's file name (`#1773216235`), `t`+hash of date and text for a frase, `s-slug` for a set. Old `#013` links still resolve through `legacy`, the number counted without pieces whose `subida` (upload day) is after their `fecha`. Station 0 is the logo, at the origin. New content needs no code: it appears from the JSON.
- **Distance is time**: `layout()` puts months as clusters on a spiral, newest near the centre, deterministic per `n` (seeded RNG) so the map is stable. A relaxation pass keeps plates apart.
- **Stellar life** (`stellar()`): each piece's age is computed from its date on every visit, on a log scale, and maps to protostar, young star, main sequence, red giant, white dwarf. Span depends on mass: sets 200 days, photos 365, frases 520. A set past its span goes supernova once per visitor (`supernovas()`, localStorage) and stays as a nebula. Far away a piece is a star; zooming in, hovering or opening it reveals the original, which age never alters. `?days=365` previews the future.
- **Pieces** are billboarded planes with a custom shader: halftone signals in their tint at mid distance, approaching or hovering resolves them to the original. Thumbnails (384px) stream in; `loadHi` swaps in full resolution for the focused piece and its neighbours.
- **Frases** are drawn to square canvases (`renderCard`/`fitText`, as big as the plate allows). Every third (`n % 3 === 0`) is a full-colour plate. `#now` is the aria-live text equivalent.
- **Atmosphere**: procedural nebula, stars, dust around the pieces, and `buildThread()`: one curve through the chronology with pulses running along it.
- **Post**: `UnrealBloomPass` plus a `lens` pass (radial blur and chroma during flights, grain, vignette). Rule: `calm` takes all of it to zero at a focused piece, so a photo is always shown untouched. If bloom is raised, check it doesn't burn the plates (`uGain` keeps them under the threshold).
- **Navigation**: orbit and zoom with `OrbitControls` (slow auto-rotate when idle); click/tap flies to a piece (`focusOn`). In focus: arrows, wheel, horizontal swipe or `j`/`k` step through time, Esc / `← all` / click outside goes back (`backOut`).
- **Sound**: hover, arrival and each word play notes from `NOTES`, flights carry band-passed noise, letting go has the burner's breath. Starts on first click/key (browser rule), `m` or the `sound` button mutes, persisted in localStorage. Key `1` still plays Redemption Song.
- **Balloon** (`buildBalloon`, the way to leave a message): a hot air balloon drifts its own never-repeating route (`route()`, in view space) inside `rig`, a group glued to the camera, so orbiting or zooming doesn't move it. It stays upright, bobs and turns slowly (`placeBalloon`, `upright()`). The envelope is a full pear of 12 bulging gores (`ENVELOPE`, `lobe()`) cut into panels in the Wiphala colours (`WIPHALA`, which also hold the pride rainbow), stepped one per gore so they run in diagonals; an intentional exception to the site palette. The burner fires in bursts and lights the envelope from inside (`skin`, kept under the bloom threshold at full burn). Red skirt, rimmed wicker basket. A `#balloon-tag` DOM label tracks it, so it's also keyboard focusable. Click, tag or `t` boards it (`board`): it re-parents to the scene, the camera moves alongside and `#cockpit` overlays the writing form. The 11 words are a string of lights hanging under the basket (`setLit`, `swayGarland`); over 11 they flash red. `launch()` ("let go") only fires after the webhook returns OK: the balloon releases the lights one every `LET_GO` s, each with its note, they fall in curves into the central logo while the balloon rises lighter, and the camera watches from the side of the fall. When the last one lands, `impact()` makes the logo flash and throw out a shockwave plus the palette colours. The balloon returns after a few seconds. While a piece is open, it slides out from behind it (`peekOut`) and waits under a `keep travelling` label: clicking it returns to the universe. A failed send leaves you aboard with the error. Without WebGL the tag opens the form flat. (Until 2026-11 this was a vector-line spaceship; it was removed.)
- **Logo** (station 0) is clickable: hovering it says "leave a word", clicking it boards the balloon to write one (words land in the logo, so it's the natural door). In a joystick pause it's choosable too, and opening it boards.
- **Pilot** (joystick, Gamepad API, no dependency): any stick or button input flies the balloon through the universe (`enterPilot`): it leaves `rig` for the scene, the camera rides behind it (`updatePilot`, chase lerp) and pieces reveal themselves as you get close (the usual distance-based reveal). Driven **like a car** on purpose (a pure balloon model, wind-only, felt wrong to people who aren't balloonists): stick up accelerates to `TOP`, down brakes and then backs up (`REVERSE`), left/right turns and banks. The one balloon thing kept is the **burner** button: hold it and it goes up right away (`CLIMB`), let go and gravity brings it down gently (`SINK`). No air-heating model on purpose: it felt like too much physics. The wind only drifts it a little (`WIND_PUSH`). Tuned for Eze's Speedlink Competition Pro Extra USB (4 buttons: 2 round, 2 triangular; digital 8-way stick). It identifies as "Game Controller for Android (Vendor: 0079 Product: 181c)", a DragonRise chip: stick on axes 0/1, 10 axes with axis 9 resting at 0, and its 4 buttons report as indices 0, 1, 3, 4 (no 2): left round = 3, right round = 0, triangles = 1 and 4. `readPad()` maps those to roles for vendor 0079 and uses 0-3 for anything else; it also reads the standard d-pad (12-15) and a hat switch on axis 9, ignoring an exact 0 there (a real hat never reads 0, and treating it as one made the stick read as permanently down). Buttons by index: 0 burner, 1 **select** (pause the universe): the balloon stops dead and the pieces in front of you become choosable (`startSelection`): every piece on screen, stars included (within 220, clear of the HUD lines, nearest 40), each marked with faint cyan corners (`#cands`); the others dim. The balloon turns to a ghost while paused (`ghostBalloon`) so nothing behind it is hidden. It starts from the one nearest the screen centre that the balloon wasn't covering; the stick jumps to the next piece in that screen direction, `moveSelection`; the chosen one uses the normal hover look and gets `#selector`, four cyan viewfinder corners that slide between pieces, `placeSelector`). While choosing, **the universe stops**: `sim`, the universe's own clock, stops advancing, so star twinkle, thread pulses, halos, sky rotation and the wind streaks freeze; only the balloon stays alive. 1 again opens the chosen piece, 2 resumes. At a piece opened from a pause, any stick push goes back to that pause (`backToPicked`, `pilot.picked` keeps the group): same pieces marked, viewfinder on the one you were seeing, the chase camera brings the view back; otherwise stick ←→ browses. At a piece (the slideshow): 0 toggles the auto slideshow (same as Scan), 1 next, 2 back behind the balloon (`flyOn()`: seen from the basket, the burners fire first, overhead, for ~1.2 s while the piece is still on screen (`blastPower` 2.2: a tongue of fire rising from the cans, `flameJet`/`flameCore`, kept in the top band; firelight flooding the whole view around the piece through `#blast-light`, a DOM box sized to the piece with a huge screen-blended box-shadow, so the piece itself is cut out and untouched; fabric lit near white-gold, warm wicker, the basket shaking, one long roar plus a low rumble), then `backOut()` resumes piloting instead of flying to the overview, with a burst of the burners: roar, flare, glowing envelope and a small lift, `burstAt`; `backOut(true)` is the quiet way back to a pause). Flying: 2 lands (`exitPilot`, camera returns to the overview), 3 boards to leave a word; 2 also closes sheets and leaves the cockpit. A mouse press or Esc lands (Esc first cancels a selection). Only a new press or push stops the slideshow; holding a button doesn't. The balloon is kept inside `PILOT_R`/`PILOT_Y`. `#pilot-hud` shows the controls for each state (flying, selecting, at a piece).
- **From the basket** (`buildBasketView`, `updateBasketView`): opening a piece while piloting, you see it from inside the basket. A camera-glued set in `rig`, drawn over everything (depthTest off, renderOrder 20+), frames the edges only: a round-cornered basket: its plan is an ellipse around you, so the rim draws a soft arc (highest in the middle ~89% down, curving down through the corners out of frame), a woven wicker ribbon wall (`wickerTexture`, a canvas texture) and a leather-padded rim with dashed stitching (`TubeGeometry`) following it; leather-sleeved corner uprights at the screen edges (~97% across), slightly tapered, with a stitched seam and three straps with small brass buckles; the burner frame bar with two cans and a burner glow, the envelope's underside as quilted Wiphala panels lit from inside and rippling (a lathe shaped so every point sits ~19–26° above the view axis), and load tapes. `shade()` gives flat meshes volume through vertex colours. On arrival the basket rises from below and the canopy comes down; it sways slightly; every 10–16 s the burner fires on its own (`burnerBreath`, also used by the launch): sound, glow, fabric and wicker warm up. The piece keeps the middle 72% of the screen untouched: rim top ~89%, canopy band ~0–13%; check any change against a square plate and a wide photo. Focusing from the overview with the mouse shows no basket.
- **Keyboard piloting**: the keyboard feeds the same virtual pad (`keys`, merged in `readPad()`), so everything above works without a joystick. WASD always (that's the take-off from the overview); arrows, space, E/Enter, Q/Backspace only while `pilot` is active (`KB_PILOT`), so before that arrows/space keep browsing the archive and the old keydown handler skips them while flying. Space = burner, E/Enter = pause / open, Q/Backspace = back / land, T = leave a word, Esc as before. Ignored while boarded or typing. `body.kb` switches `#pilot-hud` to keyboard labels (`.kb` / `.pad` spans); the joystick labels use the physical buttons (● left/right, ▲). The overview hint says "wasd to fly".
- **Wind** (`windLayer`, `windAt`), ambient while piloting: 5 layers by altitude (`WIND_LAYERS`), blended smoothly, driven by the visitor's real local time: calm at night, rising after 6h, strongest early afternoon with thermal gusts (more by day). Each layer veers through the day, higher ones stronger and faster; base directions are seeded per day (`makeRng`), so every day is new but everyone flying at the same hour feels the same wind. Made visible by `windMotes` (streaks around the balloon, drawn 2.2× faster than the wind so it reads), heard through the flight noise, and read out in `#pilot-hud` (arrow relative to the view, local time, km/h, altitude).
- **Scan** button: guided tour piece by piece, any input stops it. **Index** (`i`): contact sheet of the whole archive.
- **Performance** (it ran hot on a fanless M2 Air: ~4M pixels, bloom and lens every frame, always): render ratio capped at `DPR` 1.25; bloom renders at half resolution (`bloom.setSize` wrapped); `frameBudget()` caps frames: 60 while something moves (flight, piloting, boarding, delivery, impact, recent input), 24 at a piece or with the universe paused, 30 after 20 s with no input or mouse movement, 10 when another window has the focus. `lowPower` only judges the device when full rate was asked for.
- `prefers-reduced-motion` gets cuts instead of flights and no auto-rotate. Slow devices drop bloom and resolution automatically (`lowPower`). Without WebGL the contact sheet is the whole site.
- Styles are `is:global` on purpose: much of the DOM is created from JS and Astro's scoping would skip it.

## Deploy

Push to `main` → GitHub Action (`.github/workflows/deploy.yml`) builds (`npm ci && npm run build`) and rsyncs `dist/` to the VPS at `/var/www/ezeangeloni.xyz/html/`.

Rsync runs with `--delete`, so anything on the VPS that's NOT in `dist/` is wiped — except the paths in `--exclude`. Currently excluded (these live ONLY on the VPS, NOT in git):

- `frases.json` — phrases + photo metadata, edited live on server
- `images/` — photos referenced from `frases.json`
- `sets.json` — DJ sets metadata, edited live on server
- `sets/` — MP3 files for DJ sets
- `links.json`, `links/` — the floating links and their logos (admin's links tab)

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

- Each entry in `sets.json` is a piece placed by date: pink→purple plate with the title (or its artwork as a photo), larger than the rest and ringed in pink.
- The round "play set" button opens a sheet with the custom player: play/pause, gradient seek bar with buffer indicator, time, copy-link button.
- `?set=<slug>` URL param goes straight to the set and opens the player on load — that's the share link.
- Playback position is saved to `localStorage` per slug; reopening picks up where you left.

## Aesthetic conventions
- Background `#080810`, text `#f0ede8`, muted `rgba(240,237,232,0.3)`
- Fonts: Cormorant Garamond (serif, italic, light) for titles and frases; DM Mono (monospace, uppercase, wide letter-spacing) for UI labels and metadata
- Sheets: full-screen, opaque, hard-edged, huge italic title. No glass, no rounded cards
- Color palette: `['#ff3f3f','#ff9f1c','#6ef9f5','#b8f75b','#c77dff','#ff6eb4','#38bdf8','#ffd166']`
- Station tint: `COLORS[n % 8]`; sets are always pink/purple `#ff6eb4`/`#c77dff`

## Why this exists

The project's reason for being is **digital independence**. The user (Eze) is a DJ who wanted to publish his sets without depending on SoundCloud / Mixcloud — no ads injected over his music, no algorithm dictating reach, no third party owning his stats or audience. The whole site exists so that when a venue, label or festival receives a link to his set, they hear pure music in his own visual identity, on his own infrastructure. This positioning ("digital independence, my own system, not the same channel as every other DJ") matters when scoping new features: prefer self-hosted, prefer ownership, avoid dependencies that would dilute that story.

## Photos and frases with their own date (barrios)

The site makes barrios from the month of `fecha`, so backdating is all it takes. Two doors write `frases.json`, both through `apps/uploader/frases.js` (one writer at a time, atomic rename; new entries get `subida`):
- **Admin → photos tab** (`/admin/#photos`, installable on the phone via `manifest.webmanifest`): pick a batch, each date read from EXIF (green), the file name (`IMG_20190714…`) or the file time (gold, check it), editable, grouped by month as the barrios they'll form. Resized in the browser to 2400px JPEG (orientation applied; HEIC only where the browser decodes it), sent one per request to `POST /api/frases/photo`.
- **Admin → words tab** (`/admin/#words`): write a frase, date optional (today by default), `POST /api/frases/text`; shows the last 8 frases with their links.
- **Telegram bot** (n8n workflow "My workflow 3"): photo and text messages are forwarded raw to `POST /api/frases/telegram` on loopback; the uploader checks the chat id (`TELEGRAM_CHAT`), downloads the photo (`TELEGRAM_TOKEN`) and replies with the barrio and link. A date at the start of the text dates it: `2019-07-14 Misil`, `14/07/2019 · Misil`, `2019-07 …`. A photo sent as a file (uncompressed) keeps its EXIF date. `/list` and `/delete` are still the old n8n SSH nodes (index-based, still valid since entries are appended).

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

## Floating links (Fábrica de trapos, ila, …)

Links to Eze's other work drift over the Cronovisor (`#floaters`, `buildFloaters`/`driveFloaters` at the end of `index.astro`): always visible, bouncing off the screen edges (clear of the nav and the readout), each other and, when a piece is open, the piece itself (`rectOf`, same box as the selector), so they never cover it; if there's no room beside it (a phone) a floater steps back to invisible until there is. Hidden only aboard the balloon (the cockpit). Text in one of three styles (`malvinas`, `serif`, `mono`) or an image (a logo).

Edited from the admin's **links** tab (add, edit, reorder, remove, upload a logo) → `PUT /api/frases/links` writes `links.json`, `POST /api/frases/links/image` stores logos in `links/` (both on the VPS only, excluded from rsync; under `/api/frases` so the existing nginx route serves them). Until `links.json` exists, `DEFAULT_LINKS` shows (same list in the site and the admin): Fábrica de trapos (`https://trapos.xyz`, its own MalvinasSans font, kept in `public/fonts/`, don't delete it) and the ila logo (`public/img/ila.png`, from `~/Desktop/ila-nextjs/public/ila-logo.png`, linking to `https://www.ila-web.de`).

Fábrica de trapos used to live here as `/tu-trapo`; since 2026-07-22 it's its own project (`ezecodo/trapos`, `trapos.xyz`, notes in `~/Desktop/dev/trapos/CLAUDE.md`).

## Future
- Telegram bot integration (n8n workflow) calling `POST /api/sets` from the existing bot, so sets can be uploaded via Telegram like frases.
- Optional nginx tuning: dedicated `location /sets/` with `Cache-Control: public, max-age=31536000, immutable` for cleaner audio caching.
