# DStack Verifier Server - Multi-stage Dockerfile
FROM oven/bun:1.2.21-slim AS base

# Set working directory
WORKDIR /app

# Copy root package files for workspace resolution
COPY package.json bun.lock* ./
COPY apps/server/package.json ./apps/server/
COPY packages/verifier/package.json ./packages/verifier/

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
COPY packages/verifier/external/dcap-qvl ./external/dcap-qvl

# Build dcap-qvl CLI
WORKDIR /app/external/dcap-qvl/cli
RUN cargo build --release

# QEMU builder stage - for building dstack-acpi-tables
FROM debian:bookworm@sha256:0d8498a0e9e6a60011df39aab78534cfe940785e7c59d19dfae1eb53ea59babe AS qemu-builder
COPY packages/verifier/dstack-mr-cli/shared /build
WORKDIR /build
ARG QEMU_REV=d98440811192c08eafc07c7af110593c6b3758ff

RUN ./pin-packages.sh ./qemu-pinned-packages.txt && \
  apt-get update && \
  apt-get install -y --no-install-recommends \
  git \
  libslirp-dev \
  python3-pip \
  ninja-build \
  pkg-config \
  libglib2.0-dev \
  python3-sphinx \
  python3-sphinx-rtd-theme \
  build-essential \
  flex \
  bison && \
  rm -rf /var/lib/apt/lists/* /var/log/* /var/cache/ldconfig/aux-cache

RUN git clone https://github.com/kvinwang/qemu-tdx.git --depth 1 --branch passthrough-dump-acpi --single-branch && \
  cd qemu-tdx && git fetch --depth 1 origin ${QEMU_REV} && \
  git checkout ${QEMU_REV} && \
  ../config-qemu.sh ./build /usr/local && \
  cd build && \
  ninja && \
  strip qemu-system-x86_64

# dstack-mr-cli builder stage
FROM rust:1.86.0@sha256:300ec56abce8cc9448ddea2172747d048ed902a3090e6b57babb2bf19f754081 AS mr-cli-builder
WORKDIR /build
ARG DSTACK_REV=c985b427b1909242953a15dcfaa7f812cb39c634

RUN apt-get update && \
  apt-get install -y --no-install-recommends \
  git \
  build-essential \
  libssl-dev \
  protobuf-compiler \
  libprotobuf-dev \
  clang \
  libclang-dev && \
  rm -rf /var/lib/apt/lists/*

RUN git clone https://github.com/Dstack-TEE/dstack.git && \
  cd dstack && \
  git checkout ${DSTACK_REV}

WORKDIR /build/dstack
RUN cargo build --release -p dstack-mr-cli

# dstack-mr (Go) builder stage
FROM golang:1.23-alpine AS go-mr-builder

# Install git for go install
RUN apk add --no-cache git

# Install dstack-mr using go install
RUN go install github.com/kvinwang/dstack-mr@latest

# Runtime stage - shared base for both development and production
FROM deps AS runtime

# Install runtime dependencies for QEMU, dstack-mr-cli, and wget for image downloads
RUN apt-get update && \
  apt-get install -y --no-install-recommends \
  libglib2.0-0 \
  libslirp0 \
  wget && \
  rm -rf /var/lib/apt/lists/*

# Copy built dcap-qvl binary
COPY --from=rust-builder /app/external/dcap-qvl/cli/target/release/dcap-qvl ./bin/

# Copy dstack-mr-cli binary
COPY --from=mr-cli-builder /build/dstack/target/release/dstack-mr /usr/local/bin/dstack-mr-cli

# Copy dstack-mr (Go) binary to DSTACK_MR_PATH
COPY --from=go-mr-builder /go/bin/dstack-mr /usr/local/bin/dstack-mr

# Copy QEMU binary for dstack-acpi-tables
COPY --from=qemu-builder /build/qemu-tdx/build/qemu-system-x86_64 /usr/local/bin/dstack-acpi-tables

# Create bin directory and ensure binaries are executable
RUN mkdir -p bin && chmod +x bin/dcap-qvl /usr/local/bin/dstack-mr-cli /usr/local/bin/dstack-mr /usr/local/bin/dstack-acpi-tables

# Create QEMU share directory and copy BIOS files
RUN mkdir -p /usr/local/share/qemu
COPY --from=qemu-builder /build/qemu-tdx/pc-bios/efi-virtio.rom /usr/local/share/qemu/
COPY --from=qemu-builder /build/qemu-tdx/pc-bios/kvmvapic.bin /usr/local/share/qemu/
COPY --from=qemu-builder /build/qemu-tdx/pc-bios/linuxboot_dma.bin /usr/local/share/qemu/

# Create directory for dstack images (will be downloaded on-demand at runtime)
RUN mkdir -p external/dstack-images

# Final stage - shared base with all necessary files
FROM runtime AS final

# Copy production dependencies only
COPY --from=deps /app/node_modules ./node_modules

# Copy verifier package source
COPY packages/verifier/src ./packages/verifier/src
COPY packages/verifier/tsconfig.json ./packages/verifier/

# Copy server app source and configuration
COPY apps/server/src ./apps/server/src
COPY apps/server/tsconfig.json ./apps/server/

# Copy drizzle from root (now shared across monorepo)
COPY drizzle.config.ts ./
COPY drizzle ./drizzle

# Set working directory to server app
WORKDIR /app/apps/server

# Final stage with production command
CMD ["sh", "-c", "cd /app && bun run db:migrate && cd /app/apps/server && bun run server"]
