# dstack-mr-cli

Docker container for building and running `dstack-mr-cli`, a measurement tool from the [DStack TEE](https://github.com/Dstack-TEE/dstack) project.

## Overview

`dstack-mr-cli` is a command-line tool that generates measurement registers (MRTD, RTMR0-3) for DStack OS images. It's part of the DStack ecosystem for deploying containerized applications into Trusted Execution Environments (TEE).

## Features

- Generate measurement registers for DStack OS images
- Support for TDX (Trust Domain Extensions) measurements
- Containerized build and runtime environment
- Reproducible builds with pinned package versions

## Usage

### Building the Container

```bash
docker build -t dstack-mr-cli .
```

### Running the Tool

```bash
# Basic usage
docker run --rm dstack-mr-cli [OPTIONS]

# With privileged access (may be required for some operations)
docker run --rm --privileged dstack-mr-cli [OPTIONS]
```

## Build Configuration

The container supports the following build arguments:

- `DSTACK_REV`: Git revision of the DStack repository (default: `c985b427b1909242953a15dcfaa7f812cb39c634`)

Example with custom revision:
```bash
docker build --build-arg DSTACK_REV=<commit-hash> -t dstack-mr-cli .
```

## Project Structure

- `dockerfile`: Multi-stage Docker build configuration
- `shared/`: Build utilities and package pinning
  - `pin-packages.sh`: Script for pinning Debian packages
  - `kms-pinned-packages.txt`: Pinned package versions for reproducible builds

## Source

This tool is built from the [DStack repository](https://github.com/Dstack-TEE/dstack), specifically the `dstack-mr-cli` package.

## License

This project follows the same license as the upstream DStack project (Apache 2.0).