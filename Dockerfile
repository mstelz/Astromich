# Multi-stage build for Astromich
# SECURITY: This image does not contain any secrets or API keys
# All sensitive configuration is provided via environment variables at runtime
FROM node:20-alpine AS builder

# Set working directory
WORKDIR /build

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./
COPY vite.config.ts ./
COPY tailwind.config.ts ./
COPY postcss.config.js ./
COPY drizzle.config.ts ./

# Install all dependencies (including dev dependencies for build)
RUN npm ci

# Copy source code
COPY apps/ ./apps/
COPY packages/ ./packages/
COPY tools/ ./tools/

# Build frontend and copy assets
RUN npm run build:docker

# Production stage
FROM node:20-alpine AS runtime

# Install curl for health checks
# hadolint ignore=DL3018
RUN apk add --no-cache curl

# Create app user for security (non-root execution)
RUN addgroup -g 1001 -S nodejs && \
    adduser -S astromich -u 1001

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install production dependencies, excluding better-sqlite3
RUN npm pkg delete dependencies.better-sqlite3 && npm ci --omit=dev && npm cache clean --force

# Copy built application from builder stage (includes tools, config, and public assets)
COPY --from=builder /build/dist ./dist

# Create directories for runtime and set permissions
RUN mkdir -p /app/config /app/logs /app/sidecars && \
    chown -R astromich:nodejs /app

# Copy startup script
COPY docker/startup.sh ./
RUN chmod +x startup.sh

# Switch to non-root user for security
USER astromich

# Expose port
EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD curl -f http://localhost:5000/api/health || exit 1

# Start application
CMD ["./startup.sh"]