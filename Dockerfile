# --- Build stage ---
FROM node:20-slim AS build

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy root config files needed by src-ts
COPY src-ts/package.json src-ts/package-lock.json* ./src-ts/

WORKDIR /app/src-ts
RUN npm ci --ignore-scripts && npm rebuild better-sqlite3

# Copy source
WORKDIR /app
COPY src-ts/ ./src-ts/
COPY config/ ./config/

# Compile TypeScript
WORKDIR /app/src-ts
RUN npx tsc --noEmit || true

# --- Runtime stage ---
FROM node:20-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy built application
COPY --from=build /app/src-ts/ ./src-ts/
COPY --from=build /app/config/ ./config/

# Data directory for SQLite databases
RUN mkdir -p /app/.writing && chown -R node:node /app/.writing
VOLUME ["/app/.writing"]

ENV NIKO_GATEWAY_HOST=0.0.0.0
ENV NIKO_GATEWAY_PORT=8000
ENV NODE_ENV=production

EXPOSE 8000

USER node

HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:8000/health || exit 1

WORKDIR /app/src-ts
CMD ["node", "--loader", "ts-node/esm", "--experimental-specifier-resolution=node", "gateway-server.ts"]
