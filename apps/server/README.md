# DStack Verifier

A comprehensive TypeScript-based system for verifying Trusted Execution Environment (TEE) attestations in the DStack ecosystem. Provides robust verification capabilities for Key Management Service (KMS) and Gateway components using Intel TDX, NVIDIA GPU attestations, and blockchain integration.

## Features

- **Backend API Service**: HTTP REST API with configurable verification steps and granular control flags
- **Hardware Attestation**: Intel TDX/SGX quote verification using production-grade DCAP-QVL
- **OS Integrity**: Operating system measurement validation through Docker-based tools
- **Source Code Verification**: Docker Compose hash validation against blockchain records
- **Domain Ownership**: Complete domain control verification with Certificate Transparency logs
- **Blockchain Integration**: Smart contract interactions on Base network for attestation data
- **Data Object System**: Structured verification data generation with UI interface
- **NVIDIA GPU Support**: ML workload attestation verification for GPU-enabled applications
- **Performance Control**: Skip slow operations like CT log and DNS queries with verification flags

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

> **Note**: The `dstack-mr-cli` measurement tool has been integrated into the main Dockerfile and is available as a local binary at `/usr/local/bin/dstack-mr-cli`. The separate `./dstack-mr-cli/` directory contains the original Docker build configuration for reference.

### Usage Modes

#### Simple REST API Server (Default)

Start the simple HTTP REST API server:

```bash
bun run start
```

#### Advanced Server Mode

Start the advanced Elysia HTTP API server with database and queue support:

```bash
bun run server
```

#### Development Mode

Start development servers with hot reload:

```bash
bun run dev         # Simple server
bun run server:dev  # Advanced server
```

The server starts on `http://localhost:3000` by default. Configure with environment variables:

```bash
PORT=8080 HOST=0.0.0.0 bun run start
```

## Usage Examples

### API Verification Requests

#### Redpill ML Application Verification (Fast Mode)

Skip potentially slow operations like Certificate Transparency log queries:

```bash
curl -X POST http://localhost:3000/verify \
  -H "Content-Type: application/json" \
  -d '{
    "app": {
      "contractAddress": "0x78601222ada762fa7cdcbc167aa66dd7a5f57ece",
      "model": "phala/deepseek-chat-v3-0324",
      "metadata": {
        "osSource": {
          "github_repo": "https://github.com/Dstack-TEE/dstack",
          "git_commit": "c06e524bd460fd9c9add",
          "version": "v0.5.3"
        },
        "hardware": {
          "cpuManufacturer": "Intel Corporation",
          "cpuModel": "Intel(R) Xeon(R) CPU",
          "securityFeature": "Intel Trust Domain Extensions (TDX)",
          "hasNvidiaSupport": true
        }
      }
    },
    "flags": {
      "hardware": true,
      "os": true,
      "sourceCode": true,
      "teeControlledKey": false,
      "certificateKey": false,
      "dnsCAA": false,
      "ctLog": false
    }
  }'
```

#### Phala Cloud Application Verification

```bash
curl -X POST http://localhost:3000/verify \
  -H "Content-Type: application/json" \
  -d '{
    "app": {
      "contractAddress": "0x78601222ada762fa7cdcbc167aa66dd7a5f57ece",
      "domain": "phala.network",
      "metadata": {
        "osSource": {
          "github_repo": "https://github.com/Dstack-TEE/dstack",
          "git_commit": "c06e524bd460fd9c9add",
          "version": "v0.5.3"
        },
        "hardware": {
          "cpuManufacturer": "Intel Corporation",
          "cpuModel": "Intel(R) Xeon(R) CPU",
          "securityFeature": "Intel Trust Domain Extensions (TDX)"
        }
      }
    },
    "flags": {
      "hardware": true,
      "os": true,
      "sourceCode": true,
      "teeControlledKey": true,
      "certificateKey": true,
      "dnsCAA": false,
      "ctLog": false
    }
  }'
```

#### Complete Response Format

```json
{
  "dataObjects": [...],
  "metadata": {
    "totalTimeMs": 2340,
    "stepTimes": {
      "hardware": 1200,
      "os": 1140
    },
    "executedSteps": ["hardware", "os"],
    "skippedSteps": ["dnsCAA", "ctLog"],
    "startedAt": "2024-01-01T00:00:00.000Z",
    "completedAt": "2024-01-01T00:00:02.340Z"
  },
  "errors": [],
  "success": true
}
```

### Programmatic Usage

#### Verifier Chain System

```typescript
import { createVerifiers, executeVerifiers } from './src/verifierChain'
import type { RedpillConfig, VerificationFlags, SystemInfo } from './src/types'

// Create app configuration
const appConfig: RedpillConfig = {
  contractAddress: '0x78601222ada762fa7cdcbc167aa66dd7a5f57ece',
  model: 'phala/deepseek-chat-v3-0324',
  metadata: {
    osSource: {
      github_repo: 'https://github.com/Dstack-TEE/dstack',
      git_commit: 'c06e524bd460fd9c9add',
      version: 'v0.5.3' as const,
    },
    hardware: {
      cpuManufacturer: 'Intel Corporation',
      cpuModel: 'Intel(R) Xeon(R) CPU',
      securityFeature: 'Intel Trust Domain Extensions (TDX)',
      hasNvidiaSupport: true,
    },
  },
}

const flags: VerificationFlags = {
  hardware: true,
  os: true,
  sourceCode: true,
}

// Create and execute verifier chain
const systemInfo: SystemInfo = // ... retrieve system information
const verifiers = createVerifiers(appConfig, systemInfo)
const result = await executeVerifiers(verifiers, flags)

console.log('Success:', result.success)
console.log('Errors:', result.errors)
```

#### Direct Verifier Usage

```typescript
import { RedpillVerifier, GatewayVerifier } from './src/verifiers'
import type { AppMetadata } from './src/types/metadata'

// Create metadata
const metadata: AppMetadata = {
  osSource: {
    github_repo: 'https://github.com/Dstack-TEE/dstack',
    git_commit: 'c06e524bd460fd9c9add',
    version: 'v0.5.3' as const,
  },
  hardware: {
    cpuManufacturer: 'Intel Corporation',
    cpuModel: 'Intel(R) Xeon(R) CPU',
    securityFeature: 'Intel Trust Domain Extensions (TDX)',
  },
}

// Redpill verification
const redpillVerifier = new RedpillVerifier(
  '0x78601222ada762fa7cdcbc167aa66dd7a5f57ece',
  'phala/deepseek-chat-v3-0324',
  metadata,
  8453
)

const hardwareValid = await redpillVerifier.verifyHardware()
const osValid = await redpillVerifier.verifyOperatingSystem()
const sourceValid = await redpillVerifier.verifySourceCode()
```

#### Data Object Access

```typescript
import {
  getAllDataObjects,
  addDataObjectEventListener,
  configureVerifierRelationships,
} from './src/utils/dataObjectCollector'

// Get all verification data objects
const allObjects = getAllDataObjects()

// Listen for data object events
addDataObjectEventListener((event) => {
  console.log('Data object event:', event.type, event.objectId)
})

// Configure relationships between verifiers
configureVerifierRelationships({
  kms: { objectIdPrefix: 'kms', layer: 1 },
  gateway: { objectIdPrefix: 'gateway', layer: 2 },
})
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

## Configuration & Environment Variables

### Server Configuration

- `PORT`: Server port (default: 3000)
- `HOST`: Server host (default: localhost)
- `BEARER_TOKEN`: Bearer token for API authentication (optional, for production)

### Verifier Configuration

- `KMS_CONTRACT_ADDRESS`: Default KMS contract address
- `KMS_OS_VERSION`: Default KMS OS version
- `KMS_GIT_REVISION`: Default KMS git revision
- `GATEWAY_CONTRACT_ADDRESS`: Default Gateway contract address
- `GATEWAY_RPC_ENDPOINT`: Default Gateway RPC endpoint
- `GATEWAY_OS_VERSION`: Default Gateway OS version
- `GATEWAY_GIT_REVISION`: Default Gateway git revision
- `REDPILL_CONTRACT_ADDRESS`: Default Redpill contract address
- `REDPILL_MODEL`: Default Redpill model identifier
- `REDPILL_OS_VERSION`: Default Redpill OS version
- `REDPILL_GIT_REVISION`: Default Redpill git revision

### Verification Flags

Control which verification steps to execute:

- `hardware`: TEE quote verification (usually fast)
- `os`: Operating system measurement verification (moderate speed)
- `sourceCode`: Compose hash verification (fast)
- `teeControlledKey`: TEE-controlled key verification (fast)
- `certificateKey`: Certificate key matching (fast)
- `dnsCAA`: DNS CAA record verification ⚠️ **can be slow due to DNS queries**
- `ctLog`: Certificate Transparency log verification ⚠️ **can be very slow due to crt.sh queries**

**Performance Tip**: For faster API responses, set `dnsCAA` and `ctLog` to `false` to skip potentially slow network operations.

## Technology Stack

- **Runtime**: Bun - High-performance JavaScript runtime
- **Language**: TypeScript with strict type checking
- **API Framework**: Bun's built-in HTTP server with REST endpoints
- **Blockchain**: viem for Base network smart contract interactions
- **Attestation**: Intel DCAP-QVL (Rust) for TEE quote verification
- **Containers**: Docker for measurement tools and privileged operations
- **Code Quality**: Biome for formatting and linting
- **Validation**: Zod for runtime schema validation

## Authentication

The advanced Elysia server includes Bearer token authentication for protected endpoints:

- **Simple Server**: All endpoints are public (no authentication)
- **Advanced Server**: 
  - **Public endpoints**: `/health/*` (no authentication required)
  - **Protected endpoints**: `/api/v1/tasks/*` and `/api/v1/queue/*` (require Bearer token)

### Making Authenticated Requests

Include the Bearer token in the `Authorization` header:

```bash
curl -H "Authorization: Bearer your-token-here" \
     http://localhost:3000/api/v1/tasks
```

For development, any non-empty token is accepted. For production, implement proper token validation in `/src/server/middleware/auth.ts`.

See [AUTHENTICATION.md](./AUTHENTICATION.md) for detailed authentication documentation.

## API Endpoints

### GET /

Returns service information and available endpoints.

### GET /health

Returns server health status and uptime.

### POST /verify

Execute verification operations with configurable parameters and verification flags.

**Request Format (Redpill):**

```json
{
  "app": {
    "contractAddress": "0x78601222ada762fa7cdcbc167aa66dd7a5f57ece",
    "model": "phala/deepseek-chat-v3-0324",
    "metadata": {
      "osSource": {
        "github_repo": "https://github.com/Dstack-TEE/dstack",
        "git_commit": "c06e524bd460fd9c9add",
        "version": "v0.5.3"
      },
      "hardware": {
        "cpuManufacturer": "Intel Corporation",
        "cpuModel": "Intel(R) Xeon(R) CPU",
        "securityFeature": "Intel Trust Domain Extensions (TDX)",
        "hasNvidiaSupport": true
      }
    }
  },
  "flags": {
    "hardware": true,
    "os": true,
    "sourceCode": true,
    "teeControlledKey": false,
    "certificateKey": false,
    "dnsCAA": false,     // Default: false (can be slow)
    "ctLog": false       // Default: false (very slow)
  }
}
```

**Request Format (Phala Cloud):**

```json
{
  "app": {
    "contractAddress": "0x78601222ada762fa7cdcbc167aa66dd7a5f57ece",
    "domain": "phala.network",
    "metadata": {
      "osSource": {
        "github_repo": "https://github.com/Dstack-TEE/dstack",
        "git_commit": "c06e524bd460fd9c9add",
        "version": "v0.5.3"
      },
      "hardware": {
        "cpuManufacturer": "Intel Corporation",
        "cpuModel": "Intel(R) Xeon(R) CPU",
        "securityFeature": "Intel Trust Domain Extensions (TDX)"
      }
    }
  },
  "flags": {
    "hardware": true,
    "os": true,
    "sourceCode": true,
    "teeControlledKey": true,
    "certificateKey": true,
    "dnsCAA": false,     // Default: false (can be slow)
    "ctLog": false       // Default: false (very slow)
  }
}
```

**Response Format:**

```json
{
  "dataObjects": [...],
  "completedAt": "2024-01-01T00:00:02.340Z",
  "errors": [
    {
      "message": "Error description if any"
    }
  ],
  "success": true
}
```

## Project Structure

```
src/
├── config.ts                 # Configuration system and environment variables
├── index.ts                  # Main entry point (simple REST API server)
├── test-server.ts            # Simple REST API server implementation
├── verificationService.ts    # High-level verification orchestration
├── verifierChain.ts          # Verifier chain creation and execution
├── types/                    # Modular type system
│   ├── api.ts               # API request/response types
│   ├── metadata.ts          # Structured metadata types
│   ├── verifierChain.ts     # Verifier chain types
│   └── ...                  # Core, attestation, domain types
├── constants/               # Constants and configuration
├── verifier.ts              # Abstract base classes
├── verifiers/               # Verifier implementations
│   ├── index.ts            # Centralized exports
│   ├── kmsVerifier.ts      # KMS verification
│   ├── gatewayVerifier.ts  # Gateway + domain verification
│   └── ...                 # Redpill, Phala Cloud verifiers
├── dataObjects/             # Data object generation
├── verification/            # Modular verification functions
├── server/                  # Advanced Elysia server (database + queues)
├── utils/                   # Utility modules and integrations
└── schemas.ts              # Validation schemas
```

For detailed API usage instructions, see [API_USAGE.md](./API_USAGE.md).

This project uses [Bun](https://bun.com) as the JavaScript runtime and package manager.
