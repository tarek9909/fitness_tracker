# syntax=docker/dockerfile:1

# ------------------------------------------------------------------------------
# Stage 1: Build & Compile TypeScript
# ------------------------------------------------------------------------------
FROM node:20-alpine AS builder

WORKDIR /app

# Install native build tools if required by dependencies
RUN apk add --no-cache python3 make g++

# Install dependencies
COPY package*.json ./
RUN npm ci || npm install

# Copy TypeScript configuration and source
COPY tsconfig.json ./
COPY src/ ./src/

# Compile TypeScript
RUN npm run build

# Prune development dependencies
RUN npm prune --production

# ------------------------------------------------------------------------------
# Stage 2: Production Runtime
# ------------------------------------------------------------------------------
FROM node:20-alpine AS runner

ENV NODE_ENV=production
ENV APP_HOST=0.0.0.0
ENV APP_PORT=4000

WORKDIR /app

# Security: Non-root user execution
USER node

# Copy production artifacts from builder stage
COPY --chown=node:node --from=builder /app/node_modules ./node_modules
COPY --chown=node:node --from=builder /app/package*.json ./
COPY --chown=node:node --from=builder /app/dist ./dist

EXPOSE 4000

# Liveness & Readiness Healthcheck
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://localhost:' + (process.env.APP_PORT || 4000) + '/api/v1/health/live').then(r => r.ok ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))"

# Default command: run compiled Fastify server
CMD ["node", "dist/app/server.js"]
