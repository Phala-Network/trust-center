# DStack Verifier Server - Multi-stage Dockerfile
FROM oven/bun:1 AS base

# Set working directory
WORKDIR /app

# # Install system dependencies for server operations
# RUN apt-get update && apt-get install -y \
#   curl \
#   wget \
#   ca-certificates \
#   postgresql-client \
#   && rm -rf /var/lib/apt/lists/* \
#   && apt-get clean

# Copy package files for dependency resolution
COPY package.json bun.lock* ./

# Dependencies stage - install all dependencies
FROM base AS deps
RUN bun install --frozen-lockfile

# Development stage - optimized for hot reload and database tools
FROM deps AS development

# Copy entire source code for development
COPY . .

# Default development command with migrations
CMD ["sh", "-c", "bun run db:migrate && bun run server:dev"]

# Production stage - minimal runtime image
FROM base AS production

# Copy production dependencies only
COPY --from=deps /app/node_modules ./node_modules

# Copy source code and configuration
COPY src ./src
COPY drizzle.config.ts ./
COPY tsconfig.json ./

# Start the server with migrations
CMD ["sh", "-c", "bun run db:migrate && bun run server"]
