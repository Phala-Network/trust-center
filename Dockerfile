# DStack Verifier Server - Multi-stage Dockerfile
FROM oven/bun:1 AS base

# Set working directory
WORKDIR /app

# Install system dependencies for server operations
RUN apt-get update && apt-get install -y \
  curl \
  wget \
  ca-certificates \
  postgresql-client \
  && rm -rf /var/lib/apt/lists/* \
  && apt-get clean

# Copy package files for dependency resolution
COPY package.json bun.lock* ./

# Dependencies stage - install all dependencies
FROM base AS deps
RUN bun install --frozen-lockfile

# Development stage - optimized for hot reload and database tools
FROM deps AS development

# Copy entire source code for development
COPY . .

# Ensure directories exist and have proper permissions
RUN mkdir -p drizzle \
  && chown -R bun:bun /app

# Switch to bun user for security
USER bun

# Expose ports for server and Drizzle Studio
EXPOSE 3000 4983

# Health check for development
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

# Default development command
CMD ["bun", "run", "server:dev"]

# Production stage - minimal runtime image
FROM base AS production

# Copy production dependencies only
COPY --from=deps /app/node_modules ./node_modules

# Copy source code and configuration
COPY src ./src
COPY drizzle.config.ts ./
COPY tsconfig.json ./

# Create drizzle directory if it doesn't exist
RUN mkdir -p drizzle

# Ensure proper permissions
RUN chown -R bun:bun /app

# Switch to bun user for security
USER bun

# Expose application port
EXPOSE 3000

# Production health check with shorter intervals
HEALTHCHECK --interval=20s --timeout=5s --start-period=15s --retries=5 \
  CMD curl -f http://localhost:3000/health || exit 1

# Start the server
CMD ["bun", "run", "server"]
