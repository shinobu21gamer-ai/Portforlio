# Deployment Guide (one app, one deploy)

The whole system is a single Node.js/Express app:

- **API**      → `/api/v1` and `/api/v1/hrms`
- **POS app** → `/` (the MiniMart cash register + inventory + finance)
- **HRMS app** → `/hrms`
- **Database** → SQLite file (default) or MySQL (set `DB_DIALECT=mysql`)

No separate frontend servers, no CORS setup, no build-time API URLs. Everything is same-origin.

## Run it (one command)

```bash
npm install
npm run build     # builds both frontends into the backend
npm start         # http://localhost:5000
```

- POS: `http://localhost:5000`
- HRMS: `http://localhost:5000/hrms`
- API docs: `http://localhost:5000/api-docs`

On first boot the database is created and seeded automatically. Existing data in
`database.sqlite` is preserved.

## Default accounts

| Email | Password | Role |
|-------|----------|------|
| admin@minimart.com | admin123 | Admin (POS) |
| hr@minimart.com | hr123 | HR |
| manager@minimart.com | admin123 | Manager |
| cashier@minimart.com | cashier123 | Cashier |
| inventory@minimart.com | inventory123 | Inventory Staff |
| ligma1@gmail.com | employee123 | Employee |

## Deploy (free, one service)

### Option A — Render (recommended, no Docker needed)

1. Put this repo on GitHub (`sia/` should be the repository root).
2. On Render: **New → Blueprint** → pick the repo.
3. Render reads `render.yaml` and creates ONE free web service.
4. Done. URL looks like `https://minimart-pos.onrender.com` where:
   - POS → `https://...onrender.com/`
   - HRMS → `https://...onrender.com/hrms`

Production **never** seeds the demo accounts (`admin@minimart.com` / `admin123`
etc.). On an empty production database the boot path creates a single first-run
admin from `INITIAL_ADMIN_EMAIL` / `INITIAL_ADMIN_PASSWORD` (12+ characters) or
prints a one-time generated password to the logs, with `mustChangePassword`
forced on first login.

### Storage on Render (read this before you deploy)

Render's filesystem is **ephemeral** — a deploy, a restart or a scale-to-zero
rebuilds it from git — and **persistent disks require a paid instance**. A
blueprint that declares a disk while `plan: free` will not deploy.

`render.yaml` therefore ships the free-plan-safe default: **no disk**, SQLite
file and uploads inside the app directory. That works, but the database and
every uploaded image are reset on each deploy. Fine for a demo, not for real
data.

To keep data across deploys:

1. change `plan: free` to `plan: starter` (or higher) in `render.yaml`,
2. uncomment the `disk:` block and the `DB_STORAGE` / `UPLOAD_DIR` /
   `SETTINGS_FILE` env vars (all point at `/data`, the disk mount point),
3. redeploy.

Alternative with MySQL: set `DB_DIALECT=mysql` plus `DB_HOST`, `DB_NAME`,
`DB_USER`, `DB_PASSWORD` (and still use a disk for uploads if you need them to
persist).

The app never dies because of storage: `src/utils/storage.js` probes each
configured path at boot, and if it cannot create/write it, falls back to a
writable location and logs a loud `[STORAGE]` warning (see Troubleshooting).

Demo accounts are **development only** (`AUTO_SETUP=true` or `NODE_ENV=development`).

### Option B — Docker anywhere

```bash
docker build -t minimart-pos .
docker run -p 8080:8080 -e JWT_SECRET=... -e JWT_REFRESH_SECRET=... -e CORS_ORIGIN=https://yourdomain minimart-pos
```

Mount a volume at `/data` if you want the SQLite file to persist:
`-v minimart-data:/data`

## Config quick reference

| Env | Default | Purpose |
|-----|---------|---------|
| `PORT` | 5000 | HTTP port |
| `NODE_ENV` | development | set `production` when deployed |
| `AUTO_SETUP` | - | dev/test only: seed the demo accounts + catalog on boot. Ignored in production (which creates one first-run admin instead). |
| `DB_DIALECT` | sqlite | `sqlite` or `mysql` |
| `DB_STORAGE` | ./database.sqlite | SQLite file path (must be writable; falls back with a `[STORAGE]` warning if not) |
| `UPLOAD_DIR` | ./uploads | Uploads root (products, resumes, documents) |
| `SETTINGS_FILE` | ./data/settings.json | Runtime settings file |
| `JWT_SECRET` / `JWT_REFRESH_SECRET` | generated in dev | must be set in production |
| `CORS_ORIGIN` | same-origin allowed | extra allowed origins (comma-separated) |

## Troubleshooting

### `EACCES: permission denied, mkdir '/data/uploads/products'` (server never starts)

The configured upload directory could not be created. On Render this is almost
always one of:

- `UPLOAD_DIR=/data/uploads` (or `DB_STORAGE` / `SETTINGS_FILE` under `/data`)
  is set but **no persistent disk is attached**. Free instances cannot attach
  one, and the disk may also be missing if the blueprint failed to create it.
- In Docker: the volume is mounted but owned by another user. Named volumes
  created by this image inherit `appuser` (uid 1001) because the Dockerfile
  pre-creates `/data`; a bind mount or an older volume can be root-owned. Fix
  with `chown -R 1001:1001 <host-dir>`.

Behaviour since the storage-hardening fix: the server **no longer crashes**. It
logs a `[STORAGE]` warning naming the offending path and falls back to a
writable directory inside the app, so the deploy succeeds and the app serves
traffic — but anything written to the fallback is lost on the next
deploy/restart. Remove the `/data` env vars (or attach the disk) to silence it.

An existing database is never silently replaced: if the file exists but is not
writable, the app keeps using it and fails with a clear error rather than
starting from an empty database.

### App "not publishing" / health check failing

1. Check the deploy log for `[CONFIG] Configuration errors:` — production
   refuses to boot without `JWT_SECRET`, `JWT_REFRESH_SECRET`, and
   `SMTP_HOST` unless `EMAIL_DISABLED=true`.
2. Look for `[STORAGE]` lines: they name the path the app actually uses.
3. `Server bound to: {"address":"0.0.0.0",...}` must appear — the app binds
   `0.0.0.0:$PORT`, so a wrong `PORT` is a common cause.
4. `GET /health` must return `200 {"success":true,...}`.
