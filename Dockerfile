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

RUN mkdir -p uploads/products uploads/resumes uploads/documents logs data && \
    chown -R appuser:appgroup /app

# CORS: unset = same-origin only (API + frontends share one host). Override
# at deploy time if a separate frontend origin exists:
#   docker run -e CORS_ORIGIN=https://pos.example.com ...
#
# Security (Phase 3 / AUDIT.md S1+S2):
#  • AUTO_SETUP is NOT set — demo accounts with weak passwords are dev-only.
#    On first boot with an empty DB the server creates a single first-run
#    admin (INITIAL_ADMIN_EMAIL/INITIAL_ADMIN_PASSWORD, or a one-time
#    generated password in the logs) that must change its password.
#  • All persistent state (DB, uploads, settings) lives under /data — mount
#    a volume there (docker-compose.yml already does).
ENV NODE_ENV=production \
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