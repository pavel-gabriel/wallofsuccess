# syntax=docker/dockerfile:1

# --- Stage 1: build the Astro frontend (served at root) ---
FROM node:20-alpine AS frontend
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install --no-audit --no-fund
COPY astro.config.mjs ./
COPY src ./src
ENV PUBLIC_BACKEND=api BASE_PATH=/
RUN npm run build

# --- Stage 2: install server production deps ---
FROM node:20-alpine AS serverdeps
WORKDIR /app/server
COPY server/package.json ./
RUN npm install --omit=dev --no-audit --no-fund

# --- Final image ---
FROM node:20-alpine
WORKDIR /app/server
ENV NODE_ENV=production \
    PORT=8080 \
    FRONTEND_DIR=/app/dist \
    UPLOADS_DIR=/data/uploads
COPY --from=serverdeps /app/server/node_modules ./node_modules
COPY server/package.json ./
COPY server/src ./src
COPY --from=frontend /app/dist /app/dist
RUN mkdir -p /data/uploads
EXPOSE 8080
CMD ["node", "src/index.js"]
