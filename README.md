# DStack Verifier

A comprehensive TypeScript-based system for verifying Trusted Execution Environment (TEE) attestations in the DStack ecosystem. Provides robust verification capabilities for Key Management Service (KMS) and Gateway components using Intel TDX, NVIDIA GPU attestations, and blockchain integration.

## Features

- **Hardware Attestation**: Intel TDX/SGX quote verification using production-grade DCAP-QVL
- **OS Integrity**: Operating system measurement validation through Docker-based tools
- **Source Code Verification**: Docker Compose hash validation against blockchain records
- **Domain Ownership**: Complete domain control verification with Certificate Transparency logs
- **Blockchain Integration**: Smart contract interactions on Base network for attestation data
- **Data Object System**: Structured verification data generation with UI interface
- **NVIDIA GPU Support**: ML workload attestation verification for GPU-enabled applications

## Architecture

The system implements a multi-layered verification approach with:

- **Abstract Base Classes**: `Verifier` and `OwnDomain` for extensible verification patterns
- **Concrete Implementations**: `KmsVerifier`, `GatewayVerifier`, and `RedpillVerifier`
- **Modular Verification**: Separate functions for hardware, OS, source code, and domain verification
- **Data Object Generators**: Structured verification data with relationship tracking
- **Smart Contract Integration**: Type-safe blockchain interactions via viem

## Quick Start

### Install Dependencies

```bash
bun install
```

### Build External Tools (one-time setup)

```bash
# Build Rust DCAP-QVL CLI tool
bun run build:dcap-qvl

# Download DStack OS images for measurement
bun run download:dstack-0.5.3
bun run download:dstack-nvidia-0.5.3
```

### Run Examples

```bash
bun run index.ts
```

## Usage Examples

### Basic KMS Verification

```typescript
import { KmsVerifier } from './src/kmsVerifier'

const kmsVerifier = new KmsVerifier('0xbfd2d557118fc650ea25a0e7d85355d335f259d8')
const hardwareValid = await kmsVerifier.verifyHardware()
const osValid = await kmsVerifier.verifyOperatingSystem()
const sourceValid = await kmsVerifier.verifySourceCode()
```

### Gateway Domain Verification

```typescript
import { GatewayVerifier } from './src/gatewayVerifier'

const gatewayVerifier = new GatewayVerifier(
  '0x...',
  'https://gateway.example.com:9204/'
)

const keyControlled = await gatewayVerifier.verifyTeeControlledKey()
const certValid = await gatewayVerifier.verifyCertificateKey()
const dnsValid = await gatewayVerifier.verifyDnsCAA()
const ctResult = await gatewayVerifier.verifyCTLog()
```

### Data Object Access

```typescript
import { UIDataInterface } from './src/ui-exports'

const ui = new UIDataInterface()
const allObjects = ui.getAllDataObjects()
const filteredObjects = ui.filterDataObjects({ type: 'hardware' })
```

## Development

### Code Quality

```bash
bunx biome format --write .    # Format code
bunx biome lint .              # Lint code
bunx biome check --write .     # Format and lint
```

### Type Checking

```bash
bunx tsc --noEmit
```

### Testing

```bash
# Run Rust tests for DCAP-QVL
cd external/dcap-qvl && cargo test
```

## Technology Stack

- **Runtime**: Bun - High-performance JavaScript runtime
- **Language**: TypeScript with strict type checking
- **Blockchain**: viem for Base network smart contract interactions
- **Attestation**: Intel DCAP-QVL (Rust) for TEE quote verification
- **Containers**: Docker for measurement tools and privileged operations
- **Code Quality**: Biome for formatting and linting

## Project Structure

```
src/
├── types/                     # Modular type system
├── verifier.ts               # Abstract base classes
├── kmsVerifier.ts            # KMS verification
├── gatewayVerifier.ts        # Gateway + domain verification
├── redpillVerifier.ts        # ML application verification
├── dataObjects/              # Data object generation
├── verification/             # Modular verification functions
├── utils/                    # Utility modules and integrations
└── ui-exports.ts            # UI interface for data access
```

This project uses [Bun](https://bun.com) as the JavaScript runtime and package manager.
