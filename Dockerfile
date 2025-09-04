# DStack Verifier Server - Multi-stage Dockerfile
FROM docker:28.3.3-dind AS base

# Set working directory
WORKDIR /app

# Install Bun and ca-certificates with C++ standard library
RUN apk add --no-cache curl ca-certificates bash libstdc++

RUN curl -fsSL https://bun.sh/install | bash
ENV PATH="/root/.bun/bin:$PATH"

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

# DStack images download stage - separate for better caching
FROM alpine:3.19 AS dstack-downloader

# Install wget and tar
RUN apk add --no-cache wget

# Create directory
WORKDIR /app
RUN mkdir -p external/dstack-images

# Download dstack-0.5.3
RUN cd external/dstack-images && \
  wget -O dstack-0.5.3.tar.gz https://github.com/Dstack-TEE/meta-dstack/releases/download/v0.5.3/dstack-0.5.3.tar.gz

# Extract dstack-0.5.3
RUN cd external/dstack-images && \
  tar -xzf dstack-0.5.3.tar.gz && \
  rm dstack-0.5.3.tar.gz

# Download dstack-nvidia-0.5.3
RUN cd external/dstack-images && \
  wget -O dstack-nvidia-0.5.3.tar.gz https://github.com/nearai/private-ml-sdk/releases/download/v0.5.3/dstack-nvidia-0.5.3.tar.gz

# Extract dstack-nvidia-0.5.3
RUN cd external/dstack-images && \
  tar -xzf dstack-nvidia-0.5.3.tar.gz && \
  rm dstack-nvidia-0.5.3.tar.gz

# Download dstack-nvidia-dev-0.5.3
RUN cd external/dstack-images && \
  wget -O dstack-nvidia-dev-0.5.3.tar.gz https://github.com/nearai/private-ml-sdk/releases/download/v0.5.3/dstack-nvidia-dev-0.5.3.tar.gz

# Extract dstack-nvidia-dev-0.5.3
RUN cd external/dstack-images && \
  tar -xzf dstack-nvidia-dev-0.5.3.tar.gz && \
  rm dstack-nvidia-dev-0.5.3.tar.gz

# Runtime stage - shared base for both development and production
FROM deps AS runtime

# Copy built dcap-qvl binary
COPY --from=rust-builder /app/external/dcap-qvl/cli/target/release/dcap-qvl ./bin/

# Create bin directory and ensure dcap-qvl is executable
RUN mkdir -p bin && chmod +x bin/dcap-qvl

# Copy dstack images from downloader stage
COPY --from=dstack-downloader /app/external/dstack-images ./external/dstack-images

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
