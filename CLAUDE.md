# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# Trust Center Monorepo - TEE Attestation Verification Platform

## Project Overview

The Trust Center is a comprehensive TypeScript-based platform for managing and verifying Trusted Execution Environment (TEE) attestations in the dstack ecosystem. It provides a full-stack solution with a background worker for verification task processing, database persistence, queue-based processing, and a Next.js web application for user interaction.

### Core Concept

dstack relies on TEE hardware to measure the programs it executes and generate **attestation reports** that are cryptographically signed by hardware to ensure authority and integrity. The dstack operating system is customized to perform comprehensive measurements of applications (Docker images), Key Management Services (KMS), and Gateway configurations, writing measurement digests into attestation reports.

Specifically, dstack leverages the **RTMR3 measurement register** in attestation reports to store a series of events that measure various application aspects. The dstack-verifier collects information from multiple sources (Docker images, application source code, OS source code, domains) and compares them with measurement values in attestation reports, helping users confirm the source code authenticity of applications they interact with.

### Verification Architecture

The platform implements a modular monorepo architecture with:
- **Verification Engine** (`@phala/dstack-verifier`): Core library with multi-entity, multi-phase verification
- **Database Layer** (`@phala/trust-center-db`): Shared schema, types, and ORM
- **Background Worker** (`apps/server`): Queue-based task processing
- **Web Application** (`apps/webapp`): User interface with direct database access

The system supports **four verification phases** for **three entity types**:
1. **Hardware Verification**: Intel TDX/SGX quote validation, NVIDIA GPU attestation
2. **OS Integrity**: MRTD and RTMR0-2 measurement comparison
3. **Source Code**: Compose hash extraction from RTMR3 and blockchain validation
4. **Domain Verification**: Zero Trust HTTPS implementation (Gateway only)

## Key Development Notes

- **Architecture**: Monorepo using Bun workspaces with Turbo for build orchestration
- **Runtime**: Uses Bun as the JavaScript runtime and package manager
- **Type Safety**: Strict TypeScript with modular type definitions across packages
- **Code Quality**: Biome for formatting and linting (single quotes, minimal semicolons)
- **Database**: PostgreSQL with Drizzle ORM in shared `@phala/trust-center-db` package
- **Background Worker**: BullMQ-based queue processing (no HTTP API)
- **Queue System**: Redis-based BullMQ for background verification processing
- **Storage**: S3-compatible object storage for verification results
- **Frontend**: Next.js web application with shadcn/ui components
- **Blockchain**: Smart contract integration with Base network via viem

## Monorepo Structure

```
trust-center-monorepo/
├── apps/                          # Applications
│   ├── server/                    # Backend API server
│   │   ├── src/
│   │   │   ├── env.ts            # Environment validation
│   │   │   ├── index.ts          # Server entry point
│   │   │   ├── types/            # Type definitions
│   │   │   └── services/         # Business logic services
│   │   │       ├── index.ts
│   │   │       ├── queue.ts      # BullMQ queue service
│   │   │       ├── dbMonitor.ts  # Database polling for new tasks
│   │   │       ├── s3.ts         # S3 storage service
│   │   │       └── taskService.ts # Database operations
│   │   └── package.json
│   └── webapp/                    # Next.js web application
│       ├── src/
│       │   ├── app/              # Next.js app router
│       │   ├── components/       # React components
│       │   └── lib/              # Utilities (direct DB access)
│       └── package.json
├── packages/                      # Shared packages
│   ├── db/                       # Database package
│   │   ├── schema.ts             # Database schema with Zod types
│   │   ├── index.ts              # DB connection utilities
│   │   ├── drizzle.config.ts     # Drizzle configuration
│   │   ├── drizzle/              # Migration files
│   │   ├── package.json          # @phala/trust-center-db
│   │   └── tsconfig.json
│   └── verifier/                 # Verification engine
│       ├── src/
│       │   ├── index.ts          # Package exports
│       │   ├── verificationService.ts
│       │   ├── config.ts         # Configuration types
│       │   ├── types/            # Type definitions
│       │   ├── verifiers/        # Verifier implementations
│       │   ├── verification/     # Verification modules
│       │   ├── utils/            # Utility functions
│       │   └── constants/        # Constants
│       └── package.json          # @phala/dstack-verifier
├── Dockerfile                     # Production Docker image
├── compose.yml                    # Production Docker Compose
├── compose.dev.yml                # Development Docker Compose
├── Makefile                       # Build and deployment commands
├── package.json                   # Root package.json
├── turbo.json                     # Turbo configuration
└── tsconfig.json                  # Root TypeScript config
```

## Package Architecture

### @phala/trust-center-db

Database package providing PostgreSQL integration with Drizzle ORM.

**Exports:**
- `createDbConnection()`: Database connection factory
- `verificationTasksTable`: Drizzle table definition
- Zod Schemas: `TaskCreateRequestSchema`, `TaskSchema`, `VerificationFlagsSchema`
- Types: `Task`, `TaskCreateRequest`, `VerificationFlags`, `VerificationTaskStatus`, `AppConfigType`

**Schema:**
- `verification_tasks`: Task tracking with status, timestamps, and results
- Indexed fields for efficient querying (app_id, status, timestamps)
- JSONB fields for flexible metadata storage
- Zod schemas for runtime validation and type inference

**Scripts:**
- `db:migrate`: Apply database migrations using Drizzle Kit

**Location:** `packages/db/`

### @phala/dstack-verifier

Core verification engine for TEE attestation validation.

**Exports:**
- `VerificationService`: Main verification orchestration class
- Config types: `PhalaCloudConfig`, `VerificationFlags`
- API types: `VerificationResponse`, `VerificationError`
- Metadata types: `AppMetadata`, `OSSourceInfo`, `AppSourceInfo`, `HardwareInfo`, `GovernanceInfo`
- Schema: `AppMetadataSchema` (Zod validation)

**Architecture:**
- `VerificationService` (src/verificationService.ts): Top-level orchestration with DataObjectCollector instance per verification
- `Verifier Chain` (src/verifierChain.ts): Creates appropriate verifiers for Phala Cloud apps
- `Verifiers` (src/verifiers/): Entity-specific verifiers (App, KMS, Gateway) with legacy support
- `Verification Modules` (src/verification/): Isolated verification logic
  - `hardwareVerification.ts`: Intel DCAP-QVL integration
  - `osVerification.ts`: Measurement register comparison (MRTD, RTMR0-2)
  - `sourceCodeVerification.ts`: Compose hash extraction and validation
  - `domainVerification.ts`: Certificate, DNS CAA, CT log validation
- `DataObjectCollector` (src/utils/dataObjectCollector.ts): Collects verification metadata and relationships
- `Measurement Tools` (src/utils/):
  - `dcap-qvl.ts`: Intel quote verification wrapper
  - `dstack-mr.ts`: Measurement calculation tool integration (Rust/Go)
  - `imageDownloader.ts`: dstack OS image management
  - `dstackContract.ts`: Smart contract integration (Base network)

**Features:**
- Multi-entity verification: App, KMS, Gateway
- Multi-phase verification: Hardware → OS → Source Code → Domain
- Configurable verification flags for performance optimization
- Version-aware verification (legacy vs current dstack versions)
- Measurement register validation (MRTD, RTMR0-3)
- Smart contract integration for on-chain governance
- Concurrent verification support with isolated DataObjectCollectors

**External Dependencies:**
- `external/dcap-qvl/`: Rust-based Intel DCAP Quote Verification Library
- `external/dstack-images/`: dstack OS images for measurement calculation
- `bin/dcap-qvl`: Compiled quote verification binary

**Location:** `packages/verifier/`

### server (Backend API)

Background worker service with queue-based verification processing.

**Key Features:**
- PostgreSQL persistence for verification tasks
- Redis-based BullMQ queue for background processing
- S3-compatible storage for verification results
- Database polling via dbMonitor service
- No HTTP API endpoints (removed, webapp uses direct DB access)

**Services:**
- `queue.ts`: BullMQ queue and worker management
- `dbMonitor.ts`: Polls database for pending tasks and adds to queue
- `taskService.ts`: Database operations for tasks
- `s3.ts`: S3 storage for verification results

**Location:** `apps/server/`

### webapp (Frontend)

Next.js web application for user interaction with the verification platform.

**Key Features:**
- Modern React with App Router
- shadcn/ui component library
- Tailwind CSS styling
- Direct database access via Drizzle (no API layer)
- Server Actions for task creation

**Architecture:**
- Uses `@phala/trust-center-db` directly for data access
- Server creates tasks by inserting into database
- dbMonitor in server app picks up tasks and queues them
- No HTTP API calls between webapp and server

**Location:** `apps/webapp/`

## Technology Stack

### Build Tools & Monorepo

- **Bun**: High-performance JavaScript runtime and package manager
- **Turbo**: Incremental build system for monorepo orchestration
- **TypeScript**: Statically typed JavaScript with strict configuration
- **Biome**: Modern code formatting and linting

### Backend Stack

- **Bun**: JavaScript runtime and package manager
- **PostgreSQL**: Relational database for task persistence
- **Drizzle ORM**: Type-safe database ORM with migrations
- **Redis**: In-memory store for queue management
- **BullMQ**: Queue system for background processing
- **S3 Storage**: Object storage for verification results
- **TypeScript**: Strict type safety across all services

### Frontend Stack

- **Next.js**: React framework with App Router
- **React**: UI library
- **Tailwind CSS**: Utility-first CSS framework
- **shadcn/ui**: Component library

### Verification Stack

- **Intel DCAP-QVL**: Rust-based quote verification library (custom build)
- **dstack-mr-cli**: Rust-based measurement register calculation (latest versions)
- **dstack-mr**: Go-based measurement calculation (legacy versions)
- **qemu-tdx**: Modified QEMU for ACPI table extraction and measurement
- **viem**: Ethereum client for smart contract integration
- **Base Network**: L2 blockchain for on-chain governance and compose hash registry
- **Zod**: Runtime schema validation for all verification data

## Configuration & Environment

### Server Environment Variables

```typescript
// Core server
PORT: number (default: 3000)
HOST: string (default: 'localhost')

// Database
DATABASE_URL: string (PostgreSQL connection)

// Redis Queue
REDIS_URL: string
QUEUE_NAME: string
QUEUE_CONCURRENCY: string
QUEUE_MAX_ATTEMPTS: string
QUEUE_BACKOFF_DELAY: string

// S3 Storage
S3_ENDPOINT: string
S3_ACCESS_KEY_ID: string
S3_SECRET_ACCESS_KEY: string
S3_BUCKET: string
```

### Database Management

```bash
# In packages/db directory
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

## Development Workflow

### Build Scripts

```bash
# Development (using Docker Compose)
make dev                 # Start development environment
make logs                # View container logs
make shell               # Open shell in container
make down                # Stop containers
make clean               # Remove containers and volumes

# Production (using Docker Compose)
make prod                # Start production environment
make status              # Show container status
make health              # Check service health

# Manual development (without Docker)
cd apps/server && bun run dev     # Start server worker
cd apps/webapp && bun run dev     # Start webapp

# Quality
bun run typecheck        # Type check all packages
```

### Package Structure Guidelines

- **Shared types** go in `@phala/trust-center-db` (use Zod schemas for validation)
- **Database schema** is centralized in `@phala/trust-center-db/schema.ts`
- **Verification logic** stays in `@phala/dstack-verifier`
- **Queue and worker services** are in `apps/server/src/services/`
- **UI components** are in `apps/webapp/src/components/`
- **Server Actions** for database operations are in `apps/webapp/src/lib/`

## Architecture Notes

### Task Flow

1. **Task Creation**: Webapp creates task by inserting into `verification_tasks` table with `status='pending'`
2. **Task Detection**: Server's `dbMonitor` polls for tasks where `status='pending' AND bullJobId IS NULL`
3. **Queue Addition**: dbMonitor adds task to BullMQ queue and updates `bullJobId`
4. **Task Processing**: BullMQ worker picks up task, runs verification, updates status and results
5. **Result Storage**: Verification results stored in S3, metadata in database

### Database Access Pattern

- **Webapp**: Direct Drizzle queries for reading/writing tasks
- **Server**: Uses `taskService.ts` for task updates, `dbMonitor.ts` for queue management
- **No REST API**: All communication via shared database

## Security Considerations

### Cryptographic Verification

- **Hardware Attestation**: Production Intel DCAP-QVL with certificate chain validation
- **Measurement Integrity**: Secure hash comparison for MRTD and RTMR registers
- **TEE-Controlled Keys**: Validates that TLS private keys are generated and managed by TEE
- **Compose Hash**: SHA-256 hash validation against blockchain registry
- **Certificate Validation**: Full chain validation with trusted root CAs
- **Smart Contract Integration**: Read-only contract calls for governance and registry

### Data Security

- **No API Endpoints**: Server is a background worker only, no HTTP exposure
- **Direct Database Access**: Webapp uses Drizzle for type-safe database queries
- **Input Validation**: Zod schemas validate all external data
- **Environment Isolation**: Separate environments for dev/prod with different credentials

### Database Security

- Connection pooling with proper credential management
- Prepared statements via Drizzle ORM
- Environment-based configuration
- No sensitive data in version control

## Testing & Quality

### Type Safety

- Strict TypeScript across all packages
- Zod schemas for runtime validation
- Drizzle ORM generated types
- Type-safe environment variables

### Code Quality

- Biome linting and formatting
- Automatic import organization
- Consistent code style across monorepo
- Git-aware quality checks

## Deployment

### Docker Compose

```bash
# Production (from root)
docker compose up -d        # or: make prod

# Development (from root)
docker compose -f compose.dev.yml up    # or: make dev
```

### Service Architecture

- **Server Worker**: Background worker processing verification queue
- **Webapp**: Next.js application on port 3000 (dev only)
- **PostgreSQL**: Database on port 5432 (dev only, prod uses Supabase)
- **Redis**: Queue backend on port 6379
- **Object Storage**: S3-compatible storage

## Usage Examples

### Server Development

```bash
# Start server worker in development mode
cd apps/server
bun run dev

# Or use Docker Compose
make dev
make logs
```

### Database Operations

```bash
cd packages/db

# Generate migration files
drizzle-kit generate

# Apply migrations
bun run migrate

# Push schema changes
drizzle-kit push

# Inspect database
drizzle-kit studio
```

### Verification Service

```typescript
import { VerificationService } from '@phala/dstack-verifier'

// Create a new service instance (important: one per verification task)
const service = new VerificationService()

// Phala Cloud app verification
const result = await service.verify({
  appId: '0x1234567890abcdef',
  domain: 'myapp.phala.network',
  metadata: {
    osSource: {
      github_repo: 'https://github.com/Dstack-TEE/meta-dstack',
      git_commit: 'abc123',
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
  ctLog: false  // Skip slow CT log queries
})
```

### Important Concurrency Note

Each `VerificationService` instance maintains its own `DataObjectCollector` to prevent data pollution between concurrent verifications. **Always create a new instance per verification task:**

```typescript
// ✅ Correct: New instance per task
async function verifyTask(taskId: string) {
  const service = new VerificationService()
  return await service.verify(config, flags)
}

// ❌ Wrong: Shared instance will cause data pollution
const sharedService = new VerificationService()
async function verifyTask(taskId: string) {
  return await sharedService.verify(config, flags)
}
```

## Verification Technical Details

### Measurement Registers (RTMR)

dstack leverages Intel TDX/SGX measurement registers to ensure system integrity:

- **MRTD** (Measurement Register for Trusted Domain): Captures the entire Trusted Domain measurement including OS image, kernel, and initramfs. This is calculated during TD initialization.

- **RTMR0** (Runtime Measurement Register 0): First boot stage measurements. Updated during early boot process.

- **RTMR1** (Runtime Measurement Register 1): Second boot stage measurements. Updated during system initialization.

- **RTMR2** (Runtime Measurement Register 2): Third boot stage measurements. Updated during final boot stages.

- **RTMR3** (Runtime Measurement Register 3): Application-specific measurements. Used by dstack to store event logs including:
  - `compose-hash` event: SHA-256 hash of Docker Compose configuration
  - Application configuration events
  - Gateway and KMS configuration events

### Verification Flow for Each Entity

Each entity (App, KMS, Gateway) follows this verification chain:

```
1. Hardware Verification
   ├─ Fetch attestation report from entity endpoint
   ├─ Extract quote data using DCAP-QVL (Rust binary)
   ├─ Validate certificate chain against Intel root CA
   ├─ Extract MRTD, RTMR0-3, and event log
   └─ For GPU apps: Validate NVIDIA GPU attestation via Redpill API

2. OS Integrity Verification
   ├─ Determine dstack OS version from systemInfo
   ├─ Download corresponding OS images from external/dstack-images/
   ├─ Calculate expected measurements using:
   │  ├─ dstack-mr-cli (Rust) for latest versions
   │  └─ dstack-mr (Go) for legacy versions
   ├─ Compare calculated vs actual:
   │  ├─ MRTD (Trusted Domain measurement)
   │  ├─ RTMR0 (boot stage 1)
   │  ├─ RTMR1 (boot stage 2)
   │  └─ RTMR2 (boot stage 3)
   └─ All must match exactly

3. Source Code Verification
   ├─ Extract event log from RTMR3
   ├─ Find "compose-hash" event in event log
   ├─ Calculate SHA-256 hash of provided compose config
   ├─ Compare calculated hash with extracted hash
   └─ For on-chain apps: Verify hash is registered in smart contract

4. Domain Verification (Gateway only)
   ├─ TEE-Controlled Key Verification:
   │  ├─ Extract public key from quote report data
   │  ├─ Extract public key from TLS certificate
   │  └─ Verify they match (TEE controls the private key)
   ├─ Certificate Validation:
   │  ├─ Validate certificate chain
   │  ├─ Check certificate is valid (not expired)
   │  └─ Verify issued by Let's Encrypt (ACME)
   ├─ DNS CAA Verification (optional, slow):
   │  └─ Query DNS CAA records to verify domain authorization
   └─ Certificate Transparency (optional, very slow):
      └─ Query crt.sh for CT log entries
```

### Verifier Chain Pattern

The system uses a chain-of-responsibility pattern:

```typescript
// For Phala Cloud apps (current versions)
PhalaCloudKmsVerifier → GatewayVerifier → PhalaCloudVerifier

// For Phala Cloud apps (legacy versions)
LegacyKmsStubVerifier → LegacyGatewayStubVerifier → PhalaCloudVerifier
```

Each verifier:
1. Fetches entity-specific data (attestation, config)
2. Runs verification phases based on flags
3. Generates DataObjects with verification results
4. Passes to next verifier in chain

### DataObject System

The `DataObjectCollector` tracks verification results in a structured format:

- **DataObject**: Represents a verified entity (App, KMS, Gateway) with:
  - `id`: Unique identifier
  - `name`: Display name
  - `type`: "app", "kms", "gateway"
  - `info`: Verification metadata (measurements, hashes, certificates, etc.)
  - `checks`: Array of verification check results

- **ObjectRelationship**: Represents dependencies between entities:
  - `from`: Source entity ID
  - `to`: Target entity ID
  - `type`: Relationship type ("uses_kms", "uses_gateway", etc.)

This structure powers the web UI's visualization of trust relationships.

## Migration Notes

### Recent Changes

- Monorepo restructure with packages and apps separation
- Database extracted to `@phala/trust-center-db` package with Zod schemas
- Removed all HTTP API endpoints - webapp uses direct database access
- Server is now a background worker with queue processing only
- Webapp uses Next.js Server Actions with direct Drizzle queries
- Docker files moved to root (Dockerfile, compose.yml, compose.dev.yml, Makefile)
- Database migrations managed in `packages/db/` with `db:migrate` script
- Task flow: webapp → database → dbMonitor → queue → worker → results
- Fixed critical concurrency bug: Each VerificationService now creates its own DataObjectCollector
- Added support for both dstack-mr-cli (Rust) and dstack-mr (Go) for measurement calculation
- Improved OS version detection and image downloading logic
