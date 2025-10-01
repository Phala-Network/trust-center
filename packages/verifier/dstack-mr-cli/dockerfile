# build dstack-acpi-tables (QEMU)
FROM debian:bookworm@sha256:0d8498a0e9e6a60011df39aab78534cfe940785e7c59d19dfae1eb53ea59babe AS qemu-builder
COPY ./shared /build
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

# build dstack-mr-cli
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

# build final image
FROM debian:bookworm-slim@sha256:0d8498a0e9e6a60011df39aab78534cfe940785e7c59d19dfae1eb53ea59babe
WORKDIR /app

RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    libglib2.0-0 \
    libslirp0 && \
    rm -rf /var/lib/apt/lists/*

COPY --from=qemu-builder /build/qemu-tdx/build/qemu-system-x86_64 /usr/local/bin/dstack-acpi-tables
COPY --from=mr-cli-builder /build/dstack/target/release/dstack-mr /usr/local/bin/dstack-mr-cli

RUN mkdir -p /usr/local/share/qemu
COPY --from=qemu-builder /build/qemu-tdx/pc-bios/efi-virtio.rom /usr/local/share/qemu/
COPY --from=qemu-builder /build/qemu-tdx/pc-bios/kvmvapic.bin /usr/local/share/qemu/
COPY --from=qemu-builder /build/qemu-tdx/pc-bios/linuxboot_dma.bin /usr/local/share/qemu/

RUN chmod +x /usr/local/bin/dstack-acpi-tables /usr/local/bin/dstack-mr-cli

ENTRYPOINT ["dstack-mr-cli"]