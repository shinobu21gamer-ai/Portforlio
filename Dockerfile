# syntax=docker/dockerfile:1

# ─── Stage 1: Build POS frontend ─────────────────────────────
FROM node:20-alpine AS pos-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# ─── Stage 2: Build HRMS frontend ────────────────────────────
FROM node:20-alpine AS hrms-builder
WORKDIR /app/frontend-hrms
COPY frontend-hrms/package*.json ./
RUN npm ci
COPY frontend-hrms/ ./
RUN npm run build

# ─── Stage 3: Backend deps (sqlite3 needs build tools) ───────
FROM node:20-alpine AS backend-builder
RUN apk add --no-cache python3 make g++ && \
    npm cache clean --force
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev --no-audit --no-fund

# ─── Stage 4: Production image ───────────────────────────────
FROM node:20-alpine
WORKDIR /app

RUN addgroup -g 1001 -S appgroup && adduser -S appuser -u 1001 -G appgroup

COPY --from=backend-builder /app/node_modules ./node_modules
COPY src ./src

COPY --from=pos-builder /app/frontend/dist ./frontend/dist
COPY --from=hrms-builder /app/frontend-hrms/dist ./frontend-hrms/dist
COPY uploads ./uploads
# public/ = the public landing/careers site + robots.txt (served by Express);
# data/settings.defaults.json = committed settings baseline for first boot.
COPY public ./public
COPY data ./data

# data/ at the image root is the mount point for the persistent volume.
# Creating it here (owned by appuser) means an EMPTY named volume mounted at
# /data inherits appuser ownership when Docker first populates it, so SQLite and
# uploads are writable. A bind mount or a volume created outside the image can
# still be root-owned — the app then logs a [STORAGE] warning and falls back to
# a writable directory instead of dying with EACCES.
RUN mkdir -p uploads/products uploads/resumes uploads/documents logs data \
             /data/uploads/products /data/uploads/resumes /data/uploads/documents && \
    chown -R appuser:appgroup /app /data

# CORS: unset = same-origin only (API + frontends share one host). Override
# at deploy time if a separate frontend origin exists:
#   docker run -e CORS_ORIGIN=https://pos.example.com ...
#
# First-run setup (Phase 3 / AUDIT.md S1+S2):
#  • AUTO_SETUP=true seeds the documented demo accounts (admin@minimart.com/
#    admin123, etc.) on first boot so the demo logins work out of the box,
#    including in this production image. It is idempotent and safe to keep.
#  • For a REAL production without the weak demo credentials, set
#    INITIAL_ADMIN_EMAIL (+ a 12+ char INITIAL_ADMIN_PASSWORD, or let one be
#    generated once into the logs). When INITIAL_ADMIN_EMAIL is present the
#    server creates a single strong admin and skips the demo accounts.
#  • All persistent state (DB, uploads, settings) lives under /data — mount
#    a volume there (docker-compose.yml already does).
ENV NODE_ENV=production \
    AUTO_SETUP=true \
    PORT=8080 \
    DB_DIALECT=sqlite \
    DB_STORAGE=/data/database.sqlite \
    UPLOAD_DIR=/data/uploads \
    SETTINGS_FILE=/data/settings.json

EXPOSE 8080

USER appuser

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -qO- http://localhost:8080/health || exit 1

CMD ["node", "src/server.js"]