# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# DStack Verifier - TEE Attestation Verification System

## Project Overview

The DStack Verifier is a comprehensive TypeScript-based system designed to verify Trusted Execution Environment (TEE) attestations in the DStack ecosystem. It provides robust verification capabilities for Key Management Service (KMS), Gateway, and ML application components using Intel TDX (Trust Domain Extensions), NVIDIA GPU attestations, and blockchain-based smart contract integration.

The project implements a multi-layered verification approach encompassing hardware attestation, operating system integrity, source code authenticity, and domain ownership validation through Certificate Transparency logs and ACME certificate management. It features a production-ready HTTP API server with database persistence, queue management, and scalable verification workflows.

## Key Development Notes

- **Runtime**: Uses Bun as the JavaScript runtime and package manager
- **Type Safety**: Strict TypeScript with modular type definitions in `src/types/`
- **Code Quality**: Biome for formatting and linting (single quotes, minimal semicolons)
- **External Dependencies**: Rust DCAP-QVL tool and Docker containers for measurements
- **Testing**: Vitest test framework with comprehensive test coverage
- **Backend Architecture**: Elysia HTTP server with PostgreSQL database and Redis queue management
- **Blockchain**: Smart contract integration with Base network via viem
- **Data Objects**: Structured verification data generation with real-time event system
- **Modular Verification**: Separate modules for hardware, OS, source code, and domain verification
- **Production Ready**: Docker deployment, database migrations, queue workers, and API documentation

## Architecture & Design

### Core Components

#### Abstract Base Classes

- **`Verifier` (`src/verifier.ts`)**: Abstract base class defining the core verification interface for TEE applications

  - `verifyHardware()`: Hardware attestation validation using Intel TDX/SGX quotes
  - `verifyOperatingSystem()`: OS integrity verification through measurement registers
  - `verifySourceCode()`: Source code authenticity via compose hash validation
  - `getQuote()`, `getAttestation()`, `getAppInfo()`: Data retrieval abstractions

- **`OwnDomain` (`src/verifier.ts`)**: Abstract class for TEE-controlled domain ownership verification
  - `verifyTeeControlledKey()`: Validates TEE-controlled cryptographic keys
  - `verifyCertificateKey()`: Certificate-to-TEE key matching verification
  - `verifyDnsCAA()`: DNS Certificate Authority Authorization validation
  - `verifyCTLog()`: Certificate Transparency log analysis for historical domain control

#### Concrete Implementations

**KmsVerifier (`src/kmsVerifier.ts`)**

- Implements TEE verification for Key Management Service instances
- Retrieves attestation data from DStack KMS smart contracts on Base blockchain
- Uses `KmsDataObjectGenerator` for structured verification data
- Integrates with modular verification functions for hardware, OS, and source code

**GatewayVerifier (`src/gatewayVerifier.ts`)**

- Extends KmsVerifier with domain ownership verification capabilities
- Implements the `OwnDomain` interface for complete domain control validation
- Uses `GatewayDataObjectGenerator` for comprehensive verification data
- Integrates domain verification module for certificate and DNS validation

**RedpillVerifier (`src/verifiers/redpillVerifier.ts`)**

- Application-specific verifier for ML workload verification
- Uses `AppDataObjectGenerator` for ML-specific data objects
- Supports NVIDIA GPU attestation verification
- Includes model-specific verification capabilities

**PhalaCloudVerifier (`src/verifiers/phalaCloudVerifier.ts`)**

- Phala Network cloud-specific verifier for ML workload verification
- Integrates with Phala Cloud API for system information retrieval
- Uses `AppDataObjectGenerator` for structured verification data
- Supports both CPU and GPU-based ML workload verification

### Data Object System

#### Data Object Generators (`src/dataObjects/`)

- **`BaseDataObjectGenerator`**: Abstract base class for generating structured verification data
  - Common CPU hardware, quote, OS, and code object generation
  - Type-specific object ID generation and field mapping
  - Calculation and measurement relationship definitions
- **`KmsDataObjectGenerator`**: KMS-specific data object generation
- **`GatewayDataObjectGenerator`**: Gateway verification data with domain control
- **`AppDataObjectGenerator`**: ML application verification data objects (formerly RedpillDataObjectGenerator)

#### Data Object Collection System (`src/utils/dataObjectCollector.ts`)

- **Global Data Object Management**: Centralized collection and event system for all verification data objects
- Real-time event emission for data object creation and updates with type-safe callbacks
- Relationship configuration and resolution between verifiers for complex verification workflows
- Streamlined API for external consumption with simplified event handling

### Modular Verification System

#### Verification Modules (`src/verification/`)

- **`hardwareVerification.ts`**: TEE quote verification using DCAP-QVL
- **`osVerification.ts`**: Operating system integrity and measurement validation
- **`sourceCodeVerification.ts`**: Source code authenticity via compose hash
- **`domainVerification.ts`**: Domain ownership and certificate validation

### Type System (`src/types/`)

- **`core.ts`**: Base types for quotes, events, and verification results
- **`attestation.ts`**: Intel and NVIDIA attestation bundle types
- **`application.ts`**: Application metadata and TCB information
- **`ui.ts`**: Data object structure and relationship definitions (formerly dataObjects.ts)
- **`domain.ts`**: ACME and Certificate Transparency types
- **`quote.ts`**: Quote parsing and verification result types
- **`utils.ts`**: Utility types for metadata and configuration
- **`api.ts`**: HTTP API request/response types with Zod validation schemas
- **`index.ts`**: Centralized type exports

### Backend Server System (`src/server/`)

#### Core Server Components

- **`app.ts`**: Functional Elysia application factory with plugin composition pipeline
- **`index.ts`**: Server lifecycle management with graceful shutdown handling
- **`db/schema.ts`**: PostgreSQL database schema with Drizzle ORM for verification task persistence
- **`db/index.ts`**: Database connection and query utilities

#### API Routes (`src/server/routes/`)

- **`health.ts`**: Health check endpoints for monitoring and load balancer integration
- **`tasks.ts`**: Verification task management endpoints (create, status, results)
- **`queue.ts`**: Queue status and management endpoints for operational visibility

#### Services (`src/server/services/`)

- **`queue.ts`**: BullMQ integration for background verification task processing
- **`r2.ts`**: Cloudflare R2 object storage integration for verification result persistence
- **`taskService.ts`**: High-level verification task orchestration and lifecycle management
- **`index.ts`**: Service lifecycle management with connection pooling and graceful cleanup

### Utility Modules

#### DCAP Quote Verification (`src/utils/dcap-qvl.ts`)

- Rust-based Intel DCAP-QVL integration for TDX/SGX quote verification
- Provides quote decoding and verification capabilities
- Handles temporary file management for CLI tool integration
- Supports both hex and binary quote formats
- Returns detailed verification results with advisory information

#### DStack Measurement (`src/utils/dstack-mr.ts`)

- Docker-based measurement tool integration for OS integrity verification
- Generates measurement registers (MRTD, RTMR0-3) from DStack images
- Configurable VM parameters for measurement accuracy
- Privileged container execution for measurement operations
- JSON output parsing with comprehensive error handling

#### Smart Contract Integration (`src/utils/dstackContract.ts`)

- Viem-based blockchain integration for Base network
- **`DstackKms`**: KMS registry contract interactions
  - Gateway app ID retrieval
  - KMS information extraction (keys, quotes, event logs)
- **`DstackApp`**: Application registry for compose hash validation
- Type-safe contract interactions with comprehensive ABI support

#### Data Object Collection (`src/utils/dataObjectCollector.ts`)

- Global data object collection and management system with singleton pattern
- Real-time event emission for data object creation and updates with type-safe callbacks
- Relationship configuration and resolution between verifiers for complex workflows
- Streamlined API with core functionality focus (removed deprecated UI-specific methods)

#### System Information Utilities (`src/utils/systemInfo.ts`)

- Modular system information retrieval functions extracted from verifiers
- `getPhalaCloudInfo()`: Phala Cloud API integration for DStack system information
- `getRedpillInfo()`: Direct contract-based system information retrieval
- Clean separation of concerns from verifier classes for better testability

## Project Structure

```
dstack-verifier/
├── src/                           # Core source code
│   ├── types.ts                   # Legacy type definitions (being migrated)
│   ├── types/                     # Modular type system
│   │   ├── core.ts               # Base verification types
│   │   ├── attestation.ts        # Attestation bundle types
│   │   ├── application.ts        # App metadata and TCB types
│   │   ├── ui.ts                 # Data object structure types (formerly dataObjects.ts)
│   │   ├── domain.ts             # Domain verification types
│   │   ├── quote.ts              # Quote verification types
│   │   ├── utils.ts              # Utility and metadata types
│   │   ├── api.ts                # HTTP API request/response types
│   │   └── index.ts              # Centralized type exports
│   ├── verifier.ts                # Abstract base classes
│   ├── verifiers/                 # Verifier implementations
│   │   ├── kmsVerifier.ts        # KMS verification implementation
│   │   ├── gatewayVerifier.ts    # Gateway verification with domain validation
│   │   ├── redpillVerifier.ts    # ML application verifier (direct contract)
│   │   └── phalaCloudVerifier.ts # Phala Cloud ML application verifier
│   ├── dataObjects/               # Data object generation system
│   │   ├── baseDataObjectGenerator.ts      # Base generator class
│   │   ├── kmsDataObjectGenerator.ts       # KMS data objects
│   │   ├── gatewayDataObjectGenerator.ts   # Gateway data objects
│   │   └── appDataObjectGenerator.ts       # ML app data objects (formerly redpillDataObjectGenerator.ts)
│   ├── verification/              # Modular verification functions
│   │   ├── hardwareVerification.ts        # TEE hardware verification
│   │   ├── osVerification.ts               # OS integrity verification
│   │   ├── sourceCodeVerification.ts      # Source code verification
│   │   └── domainVerification.ts          # Domain ownership verification
│   ├── server/                    # Backend HTTP API server
│   │   ├── app.ts                # Elysia application factory
│   │   ├── index.ts              # Server lifecycle management
│   │   ├── db/                   # Database layer
│   │   │   ├── index.ts          # Database connection utilities
│   │   │   └── schema.ts         # Drizzle ORM schema definitions
│   │   ├── routes/               # API route handlers
│   │   │   ├── health.ts         # Health check endpoints
│   │   │   ├── tasks.ts          # Verification task endpoints
│   │   │   └── queue.ts          # Queue management endpoints
│   │   └── services/             # Backend services
│   │       ├── index.ts          # Service lifecycle management
│   │       ├── queue.ts          # BullMQ queue integration
│   │       ├── r2.ts             # Cloudflare R2 storage
│   │       └── taskService.ts    # Task orchestration service
│   ├── config.ts                  # Application configuration
│   ├── env.ts                     # Environment variable validation with @t3-oss/env-core
│   ├── verificationService.ts     # High-level verification orchestration
│   ├── consts.ts                  # Constants and configuration data
│   └── utils/                     # Utility modules
│       ├── dcap-qvl.ts           # Intel DCAP quote verification
│       ├── dstack-mr.ts          # DStack measurement integration
│       ├── dstackContract.ts     # Smart contract interactions
│       ├── systemInfo.ts         # System information utilities
│       ├── dataObjectCollector.ts # Global data object management
│       └── abi/                  # Smart contract ABI definitions
│           ├── DstackApp.json    # App registry contract ABI
│           └── DstackKms.json    # KMS registry contract ABI
├── external/                      # External dependencies and tools
│   ├── dcap-qvl/                 # Rust DCAP-QVL library and CLI
│   │   ├── src/                  # Rust library source
│   │   ├── cli/                  # CLI tool implementation
│   │   ├── sample/               # Sample quotes for testing
│   │   └── tests/                # Comprehensive test suite
│   └── dstack-images/            # DStack OS images and metadata
│       ├── dstack-0.5.3/         # CPU version artifacts
│       ├── dstack-nvidia-0.5.3/  # NVIDIA GPU version artifacts
│       └── dstack-nvidia-dev-0.5.3/ # NVIDIA dev version artifacts
├── dstack-mr-cli/               # Docker-based DStack measurement CLI (moved from root)
│   ├── dockerfile               # Multi-stage container build for measurement tools
│   ├── shared/                  # Shared configuration and scripts
│   │   ├── config-qemu.sh       # QEMU configuration for measurement
│   │   ├── pin-packages.sh      # Package pinning for reproducibility
│   │   ├── kms-pinned-packages.txt  # KMS-specific package versions
│   │   └── qemu-pinned-packages.txt # QEMU-specific package versions
│   └── README.md                # CLI documentation
├── bin/                          # Built executable binaries
├── drizzle/                      # Database migration files
├── index.ts                      # Main entry point with server startup
├── package.json                  # Project configuration with server scripts
├── tsconfig.json                 # TypeScript configuration
├── biome.json                    # Code formatting and linting rules
├── drizzle.config.ts             # Drizzle ORM configuration
├── vitest.config.ts              # Vitest test configuration
├── compose.yml                   # Docker Compose for production
├── compose.dev.yml               # Docker Compose for development
├── .env.example                  # Environment variable template
├── Makefile                      # Development and deployment commands
└── README.md                     # Basic project information
```

## Technology Stack

### Runtime & Build Tools

- **Bun**: High-performance JavaScript runtime and package manager
- **TypeScript**: Statically typed JavaScript with strict configuration
- **Biome**: Modern code formatting and linting with organized imports
- **Vitest**: Fast unit test runner with comprehensive coverage reporting
- **Drizzle ORM**: Type-safe database ORM with PostgreSQL support

### Backend Architecture

- **Elysia**: Fast and type-safe web framework with functional composition
- **PostgreSQL**: Robust relational database for verification task persistence
- **Redis**: High-performance in-memory database for queue management
- **BullMQ**: Redis-based queue system for background task processing
- **Cloudflare R2**: Object storage for verification results and artifacts

### Blockchain & Smart Contracts

- **viem**: Type-safe Ethereum client library for smart contract interactions
- **Base Network**: Layer 2 blockchain for attestation data storage
- Smart contract integration for KMS and App registry management

### Security & Attestation

- **Intel DCAP-QVL**: Rust-based quote verification for TDX/SGX attestations
- **Docker**: Containerized measurement tools with privileged execution
- **X.509 Certificates**: Certificate chain validation and trust verification
- **Certificate Transparency**: Historical certificate analysis for domain control

### External Integrations

- **crt.sh**: Certificate Transparency log querying for domain history
- **Google DNS**: DNS CAA record validation for domain restrictions
- **Let's Encrypt**: ACME protocol integration for certificate management
- **Phala Cloud API**: Integration with Phala Network cloud services for ML workload verification

## Key Features & Capabilities

### Hardware Attestation Verification

- Intel TDX/SGX quote validation using production-grade DCAP-QVL
- Cryptographic signature verification with advisory status reporting
- Support for both hexadecimal and binary quote formats
- Comprehensive error handling and temporary file management

### Operating System Integrity

- DStack OS image measurement using containerized tools
- Measurement register comparison (MRTD, RTMR0-3) with expected values
- VM configuration parameter validation for measurement accuracy
- Reproducible measurements with pinned package versions

### Source Code Authenticity

- Docker Compose hash validation against recorded event logs
- SHA256-based compose configuration integrity verification
- Event-driven calculation tracking for audit transparency
- Integration with smart contract compose hash registry

### Domain Ownership Verification

- Complete Certificate Transparency log analysis for historical control
- TEE-controlled ACME account key verification
- DNS CAA record validation for certificate authority restrictions
- Certificate chain validation with trusted root CA verification
- Public key comparison between certificates and TEE-controlled keys

### Event-Driven Architecture

- Comprehensive calculation and measurement event tracking
- Audit trail generation for all verification operations
- Custom event emitter support for external integration
- Pass/fail status tracking with detailed comparison data

## Configuration & Deployment

### Environment Configuration

The project uses `@t3-oss/env-core` for type-safe environment variable validation with comprehensive server configuration:

```typescript
// Core server settings
PORT: number (default: 3000)
HOST: string (default: 'localhost')

// Database and storage
DATABASE_URL: string (PostgreSQL connection)
REDIS_URL: string (Redis connection)
R2_ENDPOINT: string (Cloudflare R2 endpoint)
R2_ACCESS_KEY_ID: string
R2_SECRET_ACCESS_KEY: string
R2_BUCKET: string

// Queue configuration
QUEUE_NAME: string (default: 'verification-queue')
QUEUE_CONCURRENCY: string (default: '5')
QUEUE_MAX_ATTEMPTS: string (default: '3')
QUEUE_BACKOFF_DELAY: string (default: '2000')
```

### Build Scripts

- `build:dcap-qvl`: Compiles Rust DCAP-QVL CLI tool with release optimizations
- `download:dstack-0.5.3`: Downloads and extracts DStack OS images for measurement
- `server`: Starts the HTTP API server in production mode
- `server:dev`: Starts the server in development mode with hot reload
- `db:generate`: Generates database migration files
- `db:migrate`: Applies database migrations
- `db:push`: Pushes schema changes to database
- `test`: Runs test suite with Vitest
- `test:coverage`: Runs tests with coverage reporting

### Development Environment

- **Strict TypeScript**: Comprehensive type checking with latest ES features
- **Code Quality**: Biome formatting with single quotes and minimal semicolons
- **Import Organization**: Automatic import sorting and cleanup
- **Git Integration**: VCS-aware linting and formatting

### Container Architecture

- **Docker Compose**: Production and development environments with service orchestration
- **Multi-stage builds**: Separate containers for API server, queue workers, and measurement tools
- **Database integration**: PostgreSQL with automatic migration and connection pooling
- **Queue workers**: Redis-backed BullMQ workers for scalable background processing
- **Object storage**: Cloudflare R2 integration for verification artifact persistence
- **Health monitoring**: Built-in health check endpoints for load balancer integration

## Smart Contract Integration

### Base Network Deployment

- **DStack KMS Registry**: Stores KMS attestation data, certificates, and quotes
- **DStack App Registry**: Manages allowed compose hashes and application metadata
- **Public verification**: All attestation data publicly accessible on-chain
- **Type-safe interactions**: Comprehensive ABI integration with viem client

### Data Storage Format

- Hexadecimal-encoded quotes and event logs for efficient storage
- JSON-encoded metadata with parsing utilities for complex structures
- Certificate Authority public key storage for trust establishment
- Gateway application ID linking for trust relationship establishment

## Testing & Quality Assurance

### Test Suite Architecture

- **Vitest Framework**: Fast unit testing with TypeScript support and coverage reporting
- **Rust Tests**: Comprehensive DCAP-QVL functionality testing in `external/dcap-qvl/tests/`
- **Sample Validation**: Quote verification testing with known good/bad examples
- **Integration Tests**: Database, queue, and API endpoint testing
- **Coverage Reports**: Comprehensive test coverage tracking with detailed metrics

### TypeScript Type Safety

- **Strict Configuration**: Comprehensive type checking with latest ES features
- **Runtime Validation**: Zod schemas for API request/response validation
- **Type-Safe Environment**: `@t3-oss/env-core` for environment variable validation
- **Database Types**: Drizzle ORM with generated types for database operations
- **API Types**: Comprehensive request/response type definitions with validation

### Code Quality Standards

- Biome linting with recommended rules and nursery features
- Automatic import organization and code formatting
- TypeScript strict mode with comprehensive compiler checks
- Git-aware code quality with VCS integration

## Security Considerations

### Cryptographic Verification

- Production-grade Intel DCAP-QVL for hardware attestation
- Certificate chain validation with trusted root CA verification
- TEE-controlled key validation through quote report data analysis
- Secure hash comparison for compose integrity validation

### External Dependency Management

- Pinned package versions for reproducible builds
- Docker image verification with specific digests
- Minimal runtime dependencies to reduce attack surface
- Privileged container isolation for measurement operations

### Smart Contract Security

- Read-only contract interactions for attestation data retrieval
- Type-safe ABI integration to prevent call errors
- Public blockchain storage for transparency and auditability
- No private key handling in verifier components

## Usage Examples

#### HTTP API Server Mode

```bash
# Start the API server (now default behavior)
bun run index.ts

# Or explicitly start server
bun run server

# Start development server with hot reload
bun run server:dev

# Check server health
curl http://localhost:3000/health

# Create verification task via API
curl -X POST http://localhost:3000/api/v1/tasks \
  -H "Content-Type: application/json" \
  -d '{
    "appId": "0x78601222ada762fa7cdcbc167aa66dd7a5f57ece",
    "appName": "phala/deepseek-chat-v3-0324",
    "verifierType": "redpill",
    "payload": {
      "app": {
        "contractAddress": "0x78601222ada762fa7cdcbc167aa66dd7a5f57ece",
        "model": "phala/deepseek-chat-v3-0324"
      },
      "flags": {
        "hardware": true,
        "os": true,
        "sourceCode": true
      }
    }
  }'

# Check task status
curl http://localhost:3000/api/v1/tasks/{task-id}

# Get queue statistics
curl http://localhost:3000/api/v1/queue/stats
```

#### Database & Migration Management

```bash
# Generate migration files
bun run db:generate

# Apply database migrations
bun run db:migrate

# Push schema changes directly
bun run db:push

# Open database studio
bun run db:studio
```

#### Development & Testing

```bash
# Run test suite
bun run test

# Run tests with coverage
bun run test:coverage

# Run tests in watch mode
bun run test:watch

# Type checking
bun run typecheck

# Code formatting and linting
bun run check
```

#### Basic KMS Verification

```typescript
import { KmsVerifier } from "./src/verifiers/kmsVerifier";

const kmsVerifier = new KmsVerifier(
  "0xbfd2d557118fc650ea25a0e7d85355d335f259d8"
);
const hardwareValid = await kmsVerifier.verifyHardware();
const osValid = await kmsVerifier.verifyOperatingSystem();
const sourceValid = await kmsVerifier.verifySourceCode();
```

#### Gateway Domain Verification

```typescript
import { GatewayVerifier } from "./src/verifiers/gatewayVerifier";

const gatewayVerifier = new GatewayVerifier(
  "0x...",
  "https://gateway.example.com:9204/"
);

const keyControlled = await gatewayVerifier.verifyTeeControlledKey();
const certValid = await gatewayVerifier.verifyCertificateKey();
const dnsValid = await gatewayVerifier.verifyDnsCAA();
const ctResult = await gatewayVerifier.verifyCTLog();
```

#### Phala Cloud Application Verification

```typescript
import { PhalaCloudVerifier } from "./src/verifiers/phalaCloudVerifier";

const phalaVerifier = new PhalaCloudVerifier(
  "0x78601222ada762fa7cdcbc167aa66dd7a5f57ece",
  "phala.network"
);

// Get DStack information directly from Phala Cloud API
const dstackInfo = await phalaVerifier.getDstackInfo(
  "78601222ada762fa7cdcbc167aa66dd7a5f57ece"
);
const hardwareValid = await phalaVerifier.verifyHardware();
const osValid = await phalaVerifier.verifyOperatingSystem();
const sourceValid = await phalaVerifier.verifySourceCode();
```

#### Data Object Access and Event Integration

```typescript
import {
  getAllDataObjects,
  addDataObjectEventListener,
  configureVerifierRelationships,
} from "./src/utils/dataObjectCollector";

// Get all verification data objects
const allObjects = getAllDataObjects();

// Listen for data object events
addDataObjectEventListener((event) => {
  console.log("Data object event:", event.type, event.objectId);
});

// Configure relationships between verifiers
configureVerifierRelationships({
  kms: { objectIdPrefix: "kms", layer: 1 },
  gateway: { objectIdPrefix: "gateway", layer: 2 },
});
```

#### Verification Service Integration

```typescript
import { VerificationService } from "./src/verificationService";
import { getPhalaCloudInfo } from "./src/utils/systemInfo";

// Initialize verification service
const service = new VerificationService();

// Get system information
const systemInfo = await getPhalaCloudInfo(
  "0x78601222ada762fa7cdcbc167aa66dd7a5f57ece"
);

// Perform verification
const response = await service.verifyPhalaCloud({
  app: {
    contractAddress: "0x78601222ada762fa7cdcbc167aa66dd7a5f57ece",
    domain: "phala.network",
    metadata: systemInfo,
  },
  flags: {
    hardware: true,
    os: true,
    sourceCode: true,
  },
});

console.log("Success:", response.success);
console.log("DataObjects:", response.dataObjects.length);
console.log("Errors:", response.errors);
```

## Essential Development Commands

```bash
# Install dependencies
bun install

# Start the HTTP API server
bun run index.ts

# Development server with hot reload
bun run server:dev

# Code quality and formatting
bunx biome format --write .    # Format code
bunx biome lint .              # Lint code
bunx biome check --write .     # Format and lint in one command

# Database operations
bun run db:generate           # Generate migration files
bun run db:migrate           # Apply migrations
bun run db:push             # Push schema changes
bun run db:studio           # Open database studio

# Testing
bun run test                # Run test suite
bun run test:coverage      # Run tests with coverage
bun run test:watch         # Watch mode testing

# Build dependencies (run once or when needed)
bun run build:dcap-qvl                    # Build Rust DCAP-QVL CLI tool
bun run download:dstack-0.5.3             # Download DStack OS images
bun run download:dstack-nvidia-0.5.3      # Download NVIDIA DStack images
bun run download:dstack-nvidia-dev-0.5.3  # Download NVIDIA dev DStack images

# Run Rust tests for DCAP-QVL
cd external/dcap-qvl && cargo test

# TypeScript type checking
bunx tsc --noEmit
```

## Current Implementation Status

### Completed Features

- ✅ Complete KMS verification with smart contract integration
- ✅ Hardware attestation verification using DCAP-QVL
- ✅ Operating system integrity validation through measurement
- ✅ Source code authenticity verification via compose hashes
- ✅ Gateway verification with domain ownership validation
- ✅ Certificate Transparency log analysis and verification
- ✅ TEE-controlled key validation and certificate matching
- ✅ DNS CAA record verification for domain control
- ✅ Data object system with structured verification data generation
- ✅ Production-ready HTTP API server with Elysia framework
- ✅ PostgreSQL database integration with Drizzle ORM
- ✅ Redis-based queue system with BullMQ for background processing
- ✅ Cloudflare R2 object storage for verification result persistence
- ✅ Smart contract integration with Base network
- ✅ Docker-based measurement tool integration
- ✅ Comprehensive type system with Zod validation schemas
- ✅ Modular verification functions with clean separation
- ✅ NVIDIA GPU attestation support for ML workloads
- ✅ Phala Cloud API integration for ML workload verification
- ✅ System information utilities extracted from verifiers
- ✅ Streamlined data object collection with event system

### Architecture Strengths

- **Production Ready**: Full backend system with database, queues, and API endpoints
- **Scalable Architecture**: Redis queues with configurable worker concurrency
- **Type Safety**: Comprehensive TypeScript interfaces with Zod runtime validation
- **Data Persistence**: PostgreSQL integration with automated migrations
- **Object Storage**: Cloudflare R2 integration for artifact persistence
- **Modular Design**: Clean separation between verification types and utilities
- **Event-Driven**: Real-time data object events with streamlined collection system
- **External Integration**: Robust handling of external tools and services
- **Error Handling**: Comprehensive error management with detailed messages
- **Security Focus**: Production-grade cryptographic verification tools
- **ML Workload Support**: Complete GPU attestation verification with Phala Cloud integration

### Development Notes

- **Server-First Architecture**: The main entry point now starts the HTTP API server by default
- **Database Integration**: PostgreSQL with Drizzle ORM provides robust data persistence
- **Queue Management**: BullMQ with Redis enables scalable background verification processing
- **Simplified Data Objects**: UI-specific functionality removed in favor of streamlined core API
- **System Info Utilities**: DStack information retrieval extracted from verifiers for better modularity
- **Environment Safety**: Type-safe environment variable validation with comprehensive configuration
- **Container Orchestration**: Docker Compose setup for both development and production environments
- **Migration Support**: Database schema versioning with automated migration capabilities

This comprehensive verification system provides enterprise-grade TEE attestation validation with complete transparency, auditability, scalability, and production readiness for the DStack ecosystem.
