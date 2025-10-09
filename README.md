# Trust Center Monorepo

A comprehensive TypeScript-based platform for managing and verifying Trusted Execution Environment (TEE) attestations in the dstack ecosystem. The Trust Center provides end-to-end verification of hardware attestation, OS integrity, source code authenticity, and domain ownership for TEE-protected applications.

## Overview

dstack relies on TEE hardware to measure the programs it executes and generate attestation reports cryptographically signed by the hardware to ensure authority and integrity. The platform uses customized operating systems to verify applications (Docker images), Key Management Services (KMS), and Gateway configurations, recording measurement digests in attestation reports.

Specifically, dstack leverages the **RTMR3 measurement register** in attestation reports to store a series of events that measure various aspects of applications. The dstack-verifier collects information from multiple sources (Docker images, source code, OS source, domains) and compares them against measurement values in attestation reports, helping users confirm the source code of applications they interact with.

## Project Structure

```
trust-center-monorepo/
├── apps/
│   ├── server/            # Background Worker (BullMQ Queue Processing)
│   └── webapp/            # Trust Center Web Application (Next.js)
├── packages/
│   ├── db/                # Database Package (@phala/trust-center-db)
│   └── verifier/          # Core TEE Verification Library (@phala/dstack-verifier)
│       ├── src/
│       │   ├── verifiers/        # Entity verifiers (App, KMS, Gateway)
│       │   ├── verification/     # Verification modules (hardware, OS, source, domain)
│       │   ├── utils/            # Measurement tools (dstack-mr, dcap-qvl)
│       │   └── dataObjects/      # Data collection and relationships
│       ├── external/
│       │   ├── dcap-qvl/         # Intel DCAP Quote Verification Library (Rust)
│       │   └── dstack-images/    # dstack OS images for verification
│       └── bin/                  # Compiled verification tools
├── Dockerfile             # Production Docker image (multi-stage build)
├── compose.yml            # Production Docker Compose
├── compose.dev.yml        # Development Docker Compose
└── Makefile               # Build and deployment commands
```

## Verification Architecture

### Verified Entities

For each application, dstack-verifier checks **three entities**:

1. **Application (App)** - The main application running in TEE
2. **Key Management Service (KMS)** - Cryptographic key management
3. **Gateway** - Network gateway with Zero Trust HTTPS

Each entity undergoes all verification phases independently.

### Verification Phases

#### 1. Hardware Verification
Validates TEE hardware authenticity using cryptographically signed attestation reports.

- **Intel TDX/SGX**: Quote verification via Intel DCAP-QVL (Rust-based)
- **NVIDIA GPU**: GPU attestation for GPU-enabled applications (Redpill only)
- **Measurement Registers**: Extracts MRTD, RTMR0-3 values
- **Certificate Chain**: Validates hardware certificates against trusted CAs

#### 2. OS Integrity Verification
Confirms the operating system matches known trusted dstack OS versions.

- **Measurement Calculation**: Uses `dstack-mr-cli` (Rust) or `dstack-mr` (Go) to calculate expected measurements
- **MRTD Validation**: Compares Trusted Domain measurement
- **RTMR Comparison**: Validates RTMR0-2 boot stage measurements against calculated values
- **Version Support**: Handles multiple dstack OS versions with version-specific logic

#### 3. Source Code Verification
Validates that the Docker compose file hash matches the on-chain registry.

- **Compose Hash Extraction**: Extracts SHA-256 hash from RTMR3 event log
- **Blockchain Registry**: Checks against allowed hashes in smart contracts (Base network)
- **Image Verification**: Validates Docker image tags and configurations
- **Sigstore Integration** (TODO): Link Docker images to GitHub source via transparency logs

#### 4. Domain Verification (Gateway Only)
Validates Zero Trust HTTPS implementation for Gateway entities.

- **TEE-Controlled Keys**: Ensures TLS private keys are generated and controlled by TEE
- **Certificate Validation**: Validates certificate chain and ACME (Let's Encrypt) integration
- **DNS CAA Records**: Verifies DNS Certification Authority Authorization
- **Certificate Transparency**: Checks CT logs for certificate transparency (optional, slow)

## Packages

### Database (`packages/db`)

The `@phala/trust-center-db` package provides PostgreSQL integration with Drizzle ORM, shared types, and Zod schemas.

**Key Features:**
- Drizzle ORM for type-safe database access
- Zod schemas for runtime validation
- Centralized type definitions
- Database migration management

**Tech Stack:** TypeScript, Drizzle ORM, PostgreSQL, Zod

### Verifier (`packages/verifier`)

The `@phala/dstack-verifier` package is a comprehensive TypeScript library for verifying Trusted Execution Environment (TEE) attestations.

**Key Features:**
- Hardware attestation verification (Intel TDX/SGX, NVIDIA GPU)
- Operating system integrity validation (MRTD, RTMR0-3)
- Source code authenticity verification (compose hash)
- Domain ownership validation (Zero Trust HTTPS)
- Smart contract integration with Base network
- Modular verification architecture with configurable flags
- Multi-entity verification (App, KMS, Gateway)

**Architecture:**
- `VerificationService`: Orchestrates verification workflow
- `Verifier Chain`: Chain-of-responsibility pattern for entity verification
- `DataObjectCollector`: Collects and tracks verification metadata
- Verification Modules: Isolated modules for each verification phase

**Tech Stack:** TypeScript, Viem, Zod, Rust (dcap-qvl, dstack-mr-cli), Go (dstack-mr)

## Applications

### Server (`apps/server`)

Background worker service that processes verification tasks from a Redis queue. No HTTP endpoints.

**Key Features:**
- BullMQ queue worker for background processing
- Database polling via dbMonitor service
- S3-compatible object storage for results
- PostgreSQL persistence for task state
- Docker deployment ready

**Tech Stack:** Bun, TypeScript, PostgreSQL, Redis, BullMQ

### Web App (`apps/webapp`)

A modern Next.js trust center dashboard with direct database access (no API layer).

**Key Features:**
- Interactive data object visualization
- Trust relationship diagrams
- Real-time verification status
- Direct Drizzle database queries
- Server Actions for task creation
- Comprehensive UI component library (shadcn/ui)

**Tech Stack:** Next.js 15, React 19, TypeScript, Tailwind CSS, React Flow, shadcn/ui

## Getting Started

### Prerequisites

- [Bun](https://bun.sh/) >= 1.2.23
- Node.js >= 18 (for compatibility)
- PostgreSQL (for task persistence)
- Redis (for queue management)
- Docker (recommended for complete environment)

**For native verifier development:**
- Rust toolchain >= 1.86 (for dcap-qvl and dstack-mr-cli)
- Go >= 1.23 (for legacy dstack-mr tool)
- Build essentials (gcc, pkg-config, libssl-dev)

### Installation

```bash
# Install all dependencies
bun install
```

### Development with Docker Compose

```bash
# Start development environment (Postgres, Redis, Server, Webapp)
make dev

# View logs
make logs

# Open shell in container
make shell

# Stop containers
make down

# Clean up containers and volumes
make clean
```

### Manual Development (without Docker)

```bash
# Start server worker
cd apps/server && bun run dev

# Start webapp
cd apps/webapp && bun run dev
```

### Production Deployment

```bash
# Start production environment
make prod

# Check service health
make health

# View status
make status
```

### Database Commands

```bash
cd packages/db

# Generate migration files
drizzle-kit generate

# Apply migrations
bun run migrate

# Push schema changes
drizzle-kit push

# Open database studio
drizzle-kit studio
```

### Local Test Server (Verifier Package)

The verifier package includes a standalone HTTP API server for testing verification operations:

```bash
# Navigate to verifier package
cd packages/verifier

# Start test server with hot reload (default: http://localhost:3000)
bun run dev

# Or specify custom host/port
PORT=8080 HOST=0.0.0.0 bun run dev
```

**Available Endpoints:**
- `GET /` - Service information and available endpoints
- `GET /health` - Health check
- `POST /verify` - Execute verification with JSON body

**Example Request:**
```bash
curl -X POST http://localhost:3000/verify \
  -H "Content-Type: application/json" \
  -d '{
    "app": {
      "contractAddress": "0x1234...",
      "model": "phala/llama-3.1-8b",
      "metadata": {
        "osSource": {
          "github_repo": "https://github.com/Dstack-TEE/meta-dstack",
          "git_commit": "abc123",
          "version": "v0.5.3"
        }
      }
    },
    "flags": {
      "hardware": true,
      "os": true,
      "sourceCode": true
    }
  }'
```

**Note:** This test server is for development only. Production deployments use the background worker architecture.

### Other Commands

```bash
# Type check all code
bun run typecheck
```

## Environment Variables

Each app has its own environment configuration:

- **Server**: See [apps/server/.env.example](apps/server/.env.example)
  - `DATABASE_URL`: PostgreSQL connection string
  - `REDIS_URL`: Redis connection string
  - `S3_*`: S3-compatible storage credentials
  - `QUEUE_*`: BullMQ queue configuration

- **Web App**: See [apps/webapp/.env.example](apps/webapp/.env.example)
  - `DATABASE_URL`: PostgreSQL connection string (direct Drizzle access)
  - `NEXT_PUBLIC_*`: Public environment variables

## Monorepo Management

This monorepo uses [Turborepo](https://turbo.build/) for efficient task execution and caching.

### Key Features:
- **Parallel execution**: Runs tasks across workspaces in parallel
- **Smart caching**: Caches build outputs and only rebuilds what changed
- **Task pipelines**: Defines dependencies between tasks
- **Filtered execution**: Run tasks for specific apps using `--filter`

### Configuration

- `turbo.json`: Defines the task pipeline and caching strategy
- `package.json`: Workspace configuration and shared scripts

## Contributing

We welcome contributions to the Trust Center project! Here's how to get started:

### Getting Started

1. **Fork and Clone**
   ```bash
   git clone https://github.com/YOUR_USERNAME/dstack-verifier.git
   cd dstack-verifier
   ```

2. **Install Dependencies**
   ```bash
   bun install
   ```

3. **Build External Tools** (for verifier development)
   ```bash
   # Build Intel DCAP Quote Verification Library
   cd packages/verifier
   bun run build:dcap-qvl
   ```

### Development Workflow

1. **Create a Feature Branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make Your Changes**
   - Follow the existing code style (Biome formatting)
   - Add tests for new functionality
   - Update documentation as needed

3. **Code Quality Checks**
   ```bash
   # Format code
   bunx biome format --write .

   # Lint code
   bunx biome lint .

   # Fix formatting and lint issues
   bunx biome check --write .

   # Type check
   bun run typecheck
   ```

4. **Test Your Changes**
   ```bash
   # Run the test server (for verifier changes)
   cd packages/verifier && bun run dev

   # Run the full stack locally
   make dev
   ```

5. **Commit and Push**
   ```bash
   git add .
   git commit -m "feat: description of your changes"
   git push origin feature/your-feature-name
   ```

6. **Submit a Pull Request**
   - Open a PR against the `main` branch
   - Provide a clear description of your changes
   - Link any related issues

### Code Style Guidelines

- **Format:** Single quotes, minimal semicolons (enforced by Biome)
- **Imports:** Organized automatically (external packages first, then internal)
- **Types:** Use strict TypeScript with explicit types
- **Naming:** camelCase for variables/functions, PascalCase for classes/types

### Project-Specific Notes

- **Verifier Package:** Each `VerificationService` instance must be created per verification task to avoid data pollution
- **Database Changes:** Run `drizzle-kit generate` in `packages/db` to create migrations
- **External Dependencies:** The verifier requires Rust (dcap-qvl, dstack-mr-cli) and Go (dstack-mr) tools

### Need Help?

- Check the [Trust Center Documentation](https://deepwiki.com/Phala-Network/trust-center)
- Review [CLAUDE.md](CLAUDE.md) for detailed architecture information
- Open an issue for questions or bug reports

## License

See individual app directories for licensing information.

## API Usage Examples

### Basic Verification

```typescript
import { VerificationService } from '@phala/dstack-verifier'

// Create a verification service instance
const service = new VerificationService()

// Verify a Redpill application
const result = await service.verify({
  contractAddress: '0x1234...',
  model: 'phala/llama-3.1-8b',
  metadata: {
    osSource: {
      github_repo: 'https://github.com/Dstack-TEE/meta-dstack',
      git_commit: 'abc123...',
      version: 'v0.5.3'
    }
  }
}, {
  hardware: true,
  os: true,
  sourceCode: true,
  teeControlledKey: true,
  certificateKey: true,
  dnsCAA: false,
  ctLog: false
})

// Check verification results
if (result.success) {
  console.log('Verification passed!')
  console.log('Data objects:', result.dataObjects)
  console.log('Relationships:', result.relationships)
} else {
  console.error('Verification failed:', result.errors)
}
```

### Phala Cloud Verification

```typescript
// Verify a Phala Cloud application
const result = await service.verify({
  contractAddress: '0x5678...',
  domain: 'myapp.phala.network',
})
```

### Selective Verification

```typescript
// Skip slow verification steps
const result = await service.verify({
  contractAddress: '0x...',
  model: 'phala/model-name',
}, {
  hardware: true,
  os: true,
  sourceCode: true,
  teeControlledKey: true,
  certificateKey: false,  // Skip certificate validation
  dnsCAA: false,           // Skip DNS queries
  ctLog: false,            // Skip CT log queries (slow)
})
```

## Technical Details

### Measurement Registers

dstack uses Intel TDX/SGX measurement registers to ensure system integrity:

- **MRTD**: Measurement of entire Trusted Domain (OS image, kernel, initramfs)
- **RTMR0**: First boot stage measurements
- **RTMR1**: Second boot stage measurements
- **RTMR2**: Third boot stage measurements
- **RTMR3**: Application measurements (compose hash, configuration events)

### Verification Tools

- **dcap-qvl**: Rust-based Intel DCAP Quote Verification Library
- **dstack-mr-cli**: Rust-based measurement calculation tool (latest versions)
- **dstack-mr**: Go-based measurement calculation tool (legacy versions)
- **qemu-tdx**: Modified QEMU for ACPI table extraction

### Smart Contracts

The verifier integrates with smart contracts on Base network:

- **DstackApp**: Application registry with allowed compose hashes
- **DstackKms**: KMS configuration and governance
- Contract ABIs located in [packages/verifier/src/utils/abi/](packages/verifier/src/utils/abi/)

## Development Roadmap

- [x] Hardware attestation (Intel TDX/SGX)
- [x] OS integrity verification (MRTD, RTMR0-2)
- [x] Source code verification (compose hash)
- [x] Domain verification (Zero Trust HTTPS)
- [x] Multi-entity verification (App, KMS, Gateway)
- [x] Smart contract integration (Base network)
- [ ] Sigstore integration for image-to-source linking
- [ ] Certificate chain validation improvements
- [ ] On-chain compose hash registry validation
- [ ] Full network verification results

## Links

- [dstack TEE](https://github.com/Dstack-TEE)
- [Trust Center Documentation](https://deepwiki.com/Phala-Network/trust-center)
- [Turborepo Documentation](https://turbo.build/repo/docs)
- [Bun Documentation](https://bun.sh/docs)
- [Intel TDX](https://www.intel.com/content/www/us/en/developer/tools/trust-domain-extensions/overview.html)
