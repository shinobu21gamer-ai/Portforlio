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

RUN mkdir -p uploads/products uploads/resumes uploads/documents logs data && \
    chown -R appuser:appgroup /app

ENV NODE_ENV=production \
    PORT=8080 \
    AUTO_SETUP=true \
    DB_DIALECT=sqlite \
    DB_STORAGE=/data/database.sqlite \
    CORS_ORIGIN=*

EXPOSE 8080

USER appuser

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD wget -qO- http://localhost:8080/health || exit 1

CMD ["node", "src/server.js"]