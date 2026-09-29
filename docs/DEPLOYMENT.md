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

`AUTO_SETUP=true` makes every fresh boot sync + seed the schema, so a brand-new
deployment works with zero configuration.

> Note: Render's free plan does not give persistent disks. The SQLite file
> resets on redeploy; the app automatically re-seeds the baseline data on boot.
> For persistent data (recommended before real use), set these env vars:
> `DB_DIALECT=mysql`, `DB_HOST`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`
> (e.g. a free MySQL server).

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
| `AUTO_SETUP` | - | run schema sync + seed on boot (use in production) |
| `DB_DIALECT` | sqlite | `sqlite` or `mysql` |
| `DB_STORAGE` | ./database.sqlite | SQLite file path |
| `JWT_SECRET` / `JWT_REFRESH_SECRET` | generated in dev | must be set in production |
| `CORS_ORIGIN` | same-origin allowed | extra allowed origins (comma-separated) |