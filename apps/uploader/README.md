# Set Uploader

Tiny Node backend that lets the admin upload DJ sets via the `/admin` page on the landing.

## Endpoints

- `POST /api/sets/auth` — verify password (used by the form before showing the upload UI)
- `POST /api/sets` — multipart upload, fields: `audio` (file), `title` (string), `date` (YYYY-MM-DD)

Both require header `X-Auth: <UPLOAD_PASSWORD>`.

## Env vars

| Var | Default | Purpose |
|---|---|---|
| `UPLOAD_PASSWORD` | (required) | Password the form sends in `X-Auth` |
| `PORT` | `3010` | Listen port (loopback only) |
| `SETS_DIR` | `/var/www/ezeangeloni.xyz/html/sets` | Where MP3s are written |
| `SETS_JSON` | `/var/www/ezeangeloni.xyz/html/sets.json` | JSON file updated on upload |
| `MAX_SIZE_MB` | `300` | Reject files larger than this |

## Deploy on the VPS

```bash
# 1. clone the repo to a working dir (one-time)
cd /root
git clone <repo-url> eze-repo

# 2. install production deps
cd eze-repo/apps/uploader
npm install --omit=dev

# 3. create .env (chmod 600 so only root can read)
cat > .env <<EOF
UPLOAD_PASSWORD=your-strong-password-here
EOF
chmod 600 .env

# 4. start with PM2, loading .env automatically
pm2 start server.js --name set-uploader --env-from-file .env
pm2 save
```

If `pm2 start --env-from-file` is not available in your PM2 version, use:

```bash
set -a; source .env; set +a
pm2 start server.js --name set-uploader --update-env
pm2 save
```

## Update

```bash
cd /root/eze-repo
git pull
cd apps/uploader
npm install --omit=dev
pm2 restart set-uploader
```

## Nginx

Add to the `ezeangeloni.xyz` server block:

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
