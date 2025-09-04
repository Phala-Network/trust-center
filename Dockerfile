# DStack Verifier Server - Multi-stage Dockerfile
FROM oven/bun:1 AS base

# Set working directory
WORKDIR /app


# Copy package files for dependency resolution
COPY package.json bun.lock* ./

# Dependencies stage - install all dependencies
FROM base AS deps
RUN bun install --frozen-lockfile

# Rust build stage - for building dcap-qvl binary
FROM rust:1.89-slim AS rust-builder

# Install system dependencies for Rust compilation
RUN apt-get update && apt-get install -y \
  build-essential \
  pkg-config \
  libssl-dev \
  && rm -rf /var/lib/apt/lists/* \
  && apt-get clean

WORKDIR /app

# Copy external/dcap-qvl for building
COPY external/dcap-qvl ./external/dcap-qvl

# Build dcap-qvl CLI
WORKDIR /app/external/dcap-qvl/cli
RUN cargo build --release

# Runtime stage - shared base for both development and production
FROM deps AS runtime

# Install Docker CLI for Docker-in-Docker support
RUN apt-get update && apt-get install -y \
  docker.io \
  ca-certificates \
  curl \
  gnupg \
  lsb-release \
  && rm -rf /var/lib/apt/lists/* \
  && apt-get clean

# Copy built dcap-qvl binary
COPY --from=rust-builder /app/external/dcap-qvl/cli/target/release/dcap-qvl ./bin/

# Create bin directory and ensure dcap-qvl is executable
RUN mkdir -p bin && chmod +x bin/dcap-qvl

# Final stage - shared base with all necessary files
FROM runtime AS final

# Copy production dependencies only
COPY --from=deps /app/node_modules ./node_modules

# Copy source code and configuration
COPY src ./src
COPY drizzle.config.ts ./
COPY tsconfig.json ./

# Development stage - uses final stage with dev command
FROM final AS development
CMD ["sh", "-c", "bun run db:migrate && bun run server:dev"]

# Production stage - uses final stage with prod command
FROM final AS production
CMD ["sh", "-c", "bun run db:migrate && bun run server"]
