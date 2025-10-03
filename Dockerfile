# DStack Verifier Server - Simplified Multi-stage Dockerfile
#
# Build context: monorepo root directory
# Usage:
#   docker build -t dstack-verifier .
#   docker compose up
#
FROM oven/bun:1.2.23-slim AS base
WORKDIR /app

# Copy workspace files
COPY package.json bun.lock* ./
COPY turbo.json ./

# Copy package.json files for all workspace packages
COPY apps/server/package.json ./apps/server/
COPY packages/verifier/package.json ./packages/verifier/
COPY packages/db/package.json ./packages/db/

# Install dependencies
FROM base AS deps
RUN bun install

# Rust builder - dcap-qvl binary
FROM rust:1.89-slim AS rust-builder
RUN apt-get update && apt-get install -y build-essential pkg-config libssl-dev && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY packages/verifier/external/dcap-qvl ./external/dcap-qvl
WORKDIR /app/external/dcap-qvl/cli
RUN cargo build --release

# QEMU builder - dstack-acpi-tables
FROM debian:bookworm@sha256:0d8498a0e9e6a60011df39aab78534cfe940785e7c59d19dfae1eb53ea59babe AS qemu-builder
COPY packages/verifier/dstack-mr-cli/shared /build
WORKDIR /build
ARG QEMU_REV=d98440811192c08eafc07c7af110593c6b3758ff
RUN ./pin-packages.sh ./qemu-pinned-packages.txt && \
  apt-get update && apt-get install -y --no-install-recommends \
  git libslirp-dev python3-pip ninja-build pkg-config libglib2.0-dev \
  python3-sphinx python3-sphinx-rtd-theme build-essential flex bison && \
  rm -rf /var/lib/apt/lists/*
RUN git clone https://github.com/kvinwang/qemu-tdx.git --depth 1 --branch passthrough-dump-acpi --single-branch && \
  cd qemu-tdx && git fetch --depth 1 origin ${QEMU_REV} && git checkout ${QEMU_REV} && \
  ../config-qemu.sh ./build /usr/local && cd build && ninja && strip qemu-system-x86_64

# dstack-mr-cli builder
FROM rust:1.86.0@sha256:300ec56abce8cc9448ddea2172747d048ed902a3090e6b57babb2bf19f754081 AS mr-cli-builder
WORKDIR /build
ARG DSTACK_REV=c985b427b1909242953a15dcfaa7f812cb39c634
RUN apt-get update && apt-get install -y --no-install-recommends \
  git build-essential libssl-dev protobuf-compiler libprotobuf-dev clang libclang-dev && \
  rm -rf /var/lib/apt/lists/*
RUN git clone https://github.com/Dstack-TEE/dstack.git && cd dstack && git checkout ${DSTACK_REV}
WORKDIR /build/dstack
RUN cargo build --release -p dstack-mr-cli

# dstack-mr (Go) builder
FROM golang:1.23-alpine AS go-mr-builder
RUN apk add --no-cache git
RUN go install github.com/kvinwang/dstack-mr@latest

# DStack images downloader
FROM alpine:3.19 AS dstack-downloader
RUN apk add --no-cache wget
WORKDIR /app/external/dstack-images
RUN wget -q -O dstack-0.5.3.tar.gz https://github.com/Dstack-TEE/meta-dstack/releases/download/v0.5.3/dstack-0.5.3.tar.gz && \
  tar -xzf dstack-0.5.3.tar.gz && rm dstack-0.5.3.tar.gz && \
  wget -q -O dstack-nvidia-0.5.3.tar.gz https://github.com/nearai/private-ml-sdk/releases/download/v0.5.3/dstack-nvidia-0.5.3.tar.gz && \
  tar -xzf dstack-nvidia-0.5.3.tar.gz && rm dstack-nvidia-0.5.3.tar.gz && \
  wget -q -O dstack-nvidia-dev-0.5.3.tar.gz https://github.com/nearai/private-ml-sdk/releases/download/v0.5.3/dstack-nvidia-dev-0.5.3.tar.gz && \
  tar -xzf dstack-nvidia-dev-0.5.3.tar.gz && rm dstack-nvidia-dev-0.5.3.tar.gz

# Runtime stage
FROM deps AS runtime
RUN apt-get update && apt-get install -y --no-install-recommends libglib2.0-0 libslirp0 && rm -rf /var/lib/apt/lists/*

# Copy verification tool binaries
COPY --from=rust-builder /app/external/dcap-qvl/cli/target/release/dcap-qvl /usr/local/bin/
COPY --from=mr-cli-builder /build/dstack/target/release/dstack-mr /usr/local/bin/dstack-mr-cli
COPY --from=go-mr-builder /go/bin/dstack-mr /usr/local/bin/dstack-mr
COPY --from=qemu-builder /build/qemu-tdx/build/qemu-system-x86_64 /usr/local/bin/dstack-acpi-tables

# Copy QEMU BIOS files
RUN mkdir -p /usr/local/share/qemu
COPY --from=qemu-builder /build/qemu-tdx/pc-bios/efi-virtio.rom /usr/local/share/qemu/
COPY --from=qemu-builder /build/qemu-tdx/pc-bios/kvmvapic.bin /usr/local/share/qemu/
COPY --from=qemu-builder /build/qemu-tdx/pc-bios/linuxboot_dma.bin /usr/local/share/qemu/

# Copy dstack images
COPY --from=dstack-downloader /app/external/dstack-images ./external/dstack-images

# Make binaries executable
RUN chmod +x /usr/local/bin/dcap-qvl /usr/local/bin/dstack-mr-cli /usr/local/bin/dstack-mr /usr/local/bin/dstack-acpi-tables

# Final stage
FROM runtime AS final

# Copy node_modules (root + workspace-specific)
# Bun workspaces may create node_modules in both root and individual packages
COPY --from=deps /app/node_modules ./node_modules

# Create workspace directories first to ensure they exist
RUN mkdir -p ./apps/server ./packages/verifier ./packages/db

# Copy workspace-specific node_modules if they exist
RUN --mount=type=bind,from=deps,source=/app,target=/tmp/deps \
    if [ -d /tmp/deps/apps/server/node_modules ]; then cp -r /tmp/deps/apps/server/node_modules ./apps/server/; fi && \
    if [ -d /tmp/deps/packages/verifier/node_modules ]; then cp -r /tmp/deps/packages/verifier/node_modules ./packages/verifier/; fi && \
    if [ -d /tmp/deps/packages/db/node_modules ]; then cp -r /tmp/deps/packages/db/node_modules ./packages/db/; fi

# Copy source code
COPY packages/verifier/src ./packages/verifier/src
COPY packages/verifier/tsconfig.json ./packages/verifier/
COPY packages/db ./packages/db
COPY apps/server/src ./apps/server/src
COPY apps/server/tsconfig.json ./apps/server/
COPY tsconfig.json ./

# Copy database migrations
COPY packages/db/drizzle.config.ts ./packages/db/
COPY packages/db/drizzle ./packages/db/drizzle

WORKDIR /app/apps/server
EXPOSE 3000

CMD ["sh", "-c", "cd /app/packages/db && bun run migrate && cd /app/apps/server && bun run src/index.ts"]
