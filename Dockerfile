# ==============================================================================
# DStack Verifier Server - Multi-stage Dockerfile
# ==============================================================================
#
# Build context: monorepo root directory
# Usage:
#   docker build -t dstack-verifier .
#   docker compose up
#
# Architecture:
#   1. Base & Dependencies - Bun workspace setup
#   2. Build Tools - Compile verification binaries (dcap-qvl, qemu, dstack-mr-cli)
#   3. Runtime Assembly - Combine all artifacts
#   4. Final Image - Application with all dependencies
#
# ==============================================================================

# ------------------------------------------------------------------------------
# Stage 1: Base - Workspace setup
# ------------------------------------------------------------------------------
FROM oven/bun:1.3.0-slim AS base
WORKDIR /app

# Copy workspace configuration
COPY package.json bun.lock* ./
COPY turbo.json ./

# Copy package.json files for dependency resolution
COPY apps/server/package.json ./apps/server/
COPY packages/verifier/package.json ./packages/verifier/
COPY packages/db/package.json ./packages/db/

# ------------------------------------------------------------------------------
# Stage 2: Dependencies - Install npm packages
# ------------------------------------------------------------------------------
FROM base AS deps
RUN bun install

# ------------------------------------------------------------------------------
# Stage 3: Build Tools - Verification binaries
# ------------------------------------------------------------------------------

# dcap-qvl: Intel DCAP Quote Verification Library (Rust)
FROM rust:1.89-slim AS dcap-qvl-builder
RUN apt-get update && \
    apt-get install -y build-essential pkg-config libssl-dev && \
    rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY packages/verifier/external/dcap-qvl ./dcap-qvl
WORKDIR /app/dcap-qvl/cli
RUN cargo build --release

# dstack-acpi-tables: QEMU with TDX ACPI table extraction
FROM debian:bookworm@sha256:0d8498a0e9e6a60011df39aab78534cfe940785e7c59d19dfae1eb53ea59babe AS qemu-builder
COPY packages/verifier/dstack-mr-cli/shared /build
WORKDIR /build
ARG QEMU_REV=d98440811192c08eafc07c7af110593c6b3758ff

RUN ./pin-packages.sh ./qemu-pinned-packages.txt && \
    apt-get update && \
    apt-get install -y --no-install-recommends \
    git libslirp-dev python3-pip ninja-build pkg-config libglib2.0-dev \
    python3-sphinx python3-sphinx-rtd-theme build-essential flex bison && \
    rm -rf /var/lib/apt/lists/* /var/log/* /var/cache/ldconfig/aux-cache

RUN git clone https://github.com/kvinwang/qemu-tdx.git \
    --depth 1 --branch passthrough-dump-acpi --single-branch && \
    cd qemu-tdx && \
    git fetch --depth 1 origin ${QEMU_REV} && \
    git checkout ${QEMU_REV} && \
    ../config-qemu.sh ./build /usr/local && \
    cd build && \
    ninja && \
    strip qemu-system-x86_64

# dstack-mr-cli: DStack Measurement Register CLI (Rust)
FROM rust:1.86.0@sha256:300ec56abce8cc9448ddea2172747d048ed902a3090e6b57babb2bf19f754081 AS dstack-mr-cli-builder
WORKDIR /build
ARG DSTACK_REV=c985b427b1909242953a15dcfaa7f812cb39c634

RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    git build-essential libssl-dev protobuf-compiler libprotobuf-dev clang libclang-dev && \
    rm -rf /var/lib/apt/lists/*

RUN git clone https://github.com/Dstack-TEE/dstack.git && \
    cd dstack && \
    git checkout ${DSTACK_REV}

WORKDIR /build/dstack
RUN cargo build --release -p dstack-mr-cli

# dstack-mr: DStack Measurement Register (Go)
FROM golang:1.23-alpine AS dstack-mr-builder
RUN apk add --no-cache git
RUN go install github.com/kvinwang/dstack-mr@latest

# ------------------------------------------------------------------------------
# Stage 4: Runtime Assembly - Combine artifacts
# ------------------------------------------------------------------------------
FROM deps AS runtime

# Install runtime dependencies for QEMU
RUN apt-get update && \
    apt-get install -y --no-install-recommends libglib2.0-0 libslirp0 && \
    rm -rf /var/lib/apt/lists/*

# Copy verification tool binaries
COPY --from=dcap-qvl-builder /app/dcap-qvl/cli/target/release/dcap-qvl /usr/local/bin/dcap-qvl
COPY --from=dstack-mr-cli-builder /build/dstack/target/release/dstack-mr /usr/local/bin/dstack-mr-cli
COPY --from=qemu-builder /build/qemu-tdx/build/qemu-system-x86_64 /usr/local/bin/dstack-acpi-tables
COPY --from=dstack-mr-builder /go/bin/dstack-mr /usr/local/bin/dstack-mr

# Copy QEMU BIOS files required for ACPI table extraction
RUN mkdir -p /usr/local/share/qemu
COPY --from=qemu-builder /build/qemu-tdx/pc-bios/efi-virtio.rom /usr/local/share/qemu/
COPY --from=qemu-builder /build/qemu-tdx/pc-bios/kvmvapic.bin /usr/local/share/qemu/
COPY --from=qemu-builder /build/qemu-tdx/pc-bios/linuxboot_dma.bin /usr/local/share/qemu/

# Create directory for DStack images (downloaded on demand)
RUN mkdir -p /app/packages/verifier/external/dstack-images

# Make binaries executable
RUN chmod +x \
    /usr/local/bin/dcap-qvl \
    /usr/local/bin/dstack-mr-cli \
    /usr/local/bin/dstack-mr \
    /usr/local/bin/dstack-acpi-tables

# ------------------------------------------------------------------------------
# Stage 5: Final Image - Application
# ------------------------------------------------------------------------------
FROM runtime AS final

# Copy application source code
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

# Run migrations and start server
CMD ["sh", "-c", "cd /app/packages/db && bun run migrate && cd /app/apps/server && bun run src/index.ts"]
