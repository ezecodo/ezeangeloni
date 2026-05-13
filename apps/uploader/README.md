# Set Uploader

Express backend behind `/admin` on the landing. Handles audio uploads, server-side processing with ffmpeg, metadata editing, and deletion of DJ sets.

## Requirements on the VPS

- Node 18+
- `ffmpeg` and `ffprobe` in `$PATH` (install: `apt install ffmpeg -y`)
- `pm2` for process management

## Endpoints

All require `X-Auth: <UPLOAD_PASSWORD>` header. Rate limited.

| Method | Path | Body | Purpose |
|---|---|---|---|
| POST | `/api/sets/auth` | empty json | verify password |
| GET  | `/api/sets/list` | — | list all sets |
| POST | `/api/sets` | multipart | upload + process new set |
| PATCH | `/api/sets/:slug` | multipart | edit metadata or re-process audio |
| DELETE | `/api/sets/:slug` | — | remove set + files |

### POST /api/sets fields

| Field | Type | Required | Notes |
|---|---|---|---|
| `audio` | file | yes | any audio format, max 800MB |
| `title` | string | yes | used to generate slug |
| `date` | string | yes | YYYY-MM-DD |
| `artwork` | file | no | image, displayed in the player |
| `tracklist` | string | no | text, one `mm:ss Label` per line |
| `trimStart` | number | no | seconds to cut from start |
| `trimEnd` | number | no | seconds to cut from end |
| `fadeIn` | number | no | fade in duration in seconds |
| `fadeOut` | number | no | fade out duration in seconds |
| `normalize` | bool | no | apply -14 LUFS loudness normalization |

### PATCH /api/sets/:slug

Same fields as POST except `audio` is not editable (re-uploading creates a new set). Adds:

- `removeArtwork: true` — drop existing artwork
- Any of the audio fields triggers a re-render of the MP3 from the saved original

## Env vars

| Var | Default | Purpose |
|---|---|---|
| `UPLOAD_PASSWORD` | (required) | password the form sends in `X-Auth` |
| `PORT` | `3010` | listen port (loopback only) |
| `SETS_DIR` | `/var/www/ezeangeloni.xyz/html/sets` | where MP3s live |
| `ARTWORKS_DIR` | `${SETS_DIR}/artworks` | where artwork images live |
| `ORIGINALS_DIR` | `/root/sets-originals` | where original uploads are kept |
| `SETS_JSON` | `/var/www/ezeangeloni.xyz/html/sets.json` | metadata file |
| `PUBLIC_ROOT` | `/var/www/ezeangeloni.xyz/html` | for path resolution |
| `MAX_SIZE_MB` | `800` | reject larger uploads |

## Deploy on the VPS (one time)

```bash
# 1. ffmpeg
apt install ffmpeg -y

# 2. clone repo
mkdir -p /root/apps && cd /root/apps
git clone https://github.com/ezecodo/ezeangeloni.git eze-repo
cd eze-repo/apps/uploader
npm install --omit=dev

# 3. .env
nano .env
# put: UPLOAD_PASSWORD=...
chmod 600 .env

# 4. PM2
set -a; source .env; set +a
pm2 start server.js --name set-uploader --update-env
pm2 save
```

## Update (after pushing changes)

```bash
cd /root/apps/eze-repo
git pull
cd apps/uploader
npm install --omit=dev
pm2 restart set-uploader
```

## Nginx

Add inside the `ezeangeloni.xyz` server block (same one that serves the landing):

```nginx
client_max_body_size 320M;

location /api/sets {
    proxy_pass http://127.0.0.1:3010;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_read_timeout 600s;
    proxy_send_timeout 600s;
}
```

Reload: `nginx -t && systemctl reload nginx`.
