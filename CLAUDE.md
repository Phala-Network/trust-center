# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# DStack Verifier - TEE Attestation Verification System

## Project Overview

The DStack Verifier is a comprehensive TypeScript-based system designed to verify Trusted Execution Environment (TEE) attestations in the DStack ecosystem. It provides robust verification capabilities for Key Management Service (KMS) and Gateway components using Intel TDX (Trust Domain Extensions), NVIDIA GPU attestations, and blockchain-based smart contract integration.

The project implements a multi-layered verification approach encompassing hardware attestation, operating system integrity, source code authenticity, and domain ownership validation through Certificate Transparency logs and ACME certificate management.

## Key Development Notes

- **Runtime**: Uses Bun as the JavaScript runtime and package manager
- **Type Safety**: Strict TypeScript with modular type definitions in `src/types/`
- **Code Quality**: Biome for formatting and linting (single quotes, minimal semicolons)
- **External Dependencies**: Rust DCAP-QVL tool and Docker containers for measurements
- **Testing**: Rust test suite in `external/dcap-qvl/tests/`
- **Blockchain**: Smart contract integration with Base network via viem
- **Data Objects**: Structured verification data generation with UI interface
- **Modular Verification**: Separate modules for hardware, OS, source code, and domain verification

## Architecture & Design

### Core Components

#### Abstract Base Classes
- **`Verifier` (`src/verifier.ts`)**: Abstract base class defining the core verification interface for TEE applications
  - `verifyHardware()`: Hardware attestation validation using Intel TDX/SGX quotes
  - `verifyOperatingSystem()`: OS integrity verification through measurement registers
  - `verifySourceCode()`: Source code authenticity via compose hash validation
  - `getQuote()`, `getAttestation()`, `getAppInfo()`: Data retrieval abstractions
  - `getMetadata()`: Verification metadata and capabilities

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

**RedpillVerifier (`src/redpillVerifier.ts`)**
- Application-specific verifier for ML workload verification
- Uses `RedpillDataObjectGenerator` for ML-specific data objects
- Supports NVIDIA GPU attestation verification
- Includes model-specific verification capabilities

### Data Object System

#### Data Object Generators (`src/dataObjects/`)
- **`BaseDataObjectGenerator`**: Abstract base class for generating structured verification data
  - Common CPU hardware, quote, OS, and code object generation
  - Type-specific object ID generation and field mapping
  - Calculation and measurement relationship definitions
- **`KmsDataObjectGenerator`**: KMS-specific data object generation
- **`GatewayDataObjectGenerator`**: Gateway verification data with domain control
- **`RedpillDataObjectGenerator`**: ML application verification data objects

#### UI Interface (`src/ui-exports.ts`)
- **`UIDataInterface`**: Complete interface for accessing verification data objects
- Real-time event listening and data object updates
- Filtering by type, kind, layer with statistics and relationship resolution
- Export capabilities for visualization and external consumption

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
- **`dataObjects.ts`**: Data object structure and relationship definitions
- **`domain.ts`**: ACME and Certificate Transparency types
- **`quote.ts`**: Quote parsing and verification result types
- **`utils.ts`**: Utility types for metadata and configuration
- **`schemas.ts`**: Zod validation schemas for runtime type safety
- **`index.ts`**: Centralized type exports

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
- Global data object collection and management system
- Real-time event emission for data object creation and updates
- Relationship configuration and resolution between verifiers
- Filtering and querying capabilities for UI consumption

## Project Structure

```
dstack-verifier/
├── src/                           # Core source code
│   ├── types.ts                   # Legacy type definitions (being migrated)
│   ├── schemas.ts                 # Zod validation schemas for runtime type safety
│   ├── types/                     # Modular type system
│   │   ├── core.ts               # Base verification types
│   │   ├── attestation.ts        # Attestation bundle types
│   │   ├── application.ts        # App metadata and TCB types
│   │   ├── dataObjects.ts        # Data object structure types
│   │   ├── domain.ts             # Domain verification types
│   │   ├── quote.ts              # Quote verification types
│   │   ├── utils.ts              # Utility and metadata types
│   │   └── index.ts              # Centralized type exports
│   ├── verifier.ts                # Abstract base classes
│   ├── kmsVerifier.ts             # KMS verification implementation
│   ├── gatewayVerifier.ts         # Gateway verification with domain validation
│   ├── redpillVerifier.ts         # ML application verifier
│   ├── dataObjects/               # Data object generation system
│   │   ├── baseDataObjectGenerator.ts      # Base generator class
│   │   ├── kmsDataObjectGenerator.ts       # KMS data objects
│   │   ├── gatewayDataObjectGenerator.ts   # Gateway data objects
│   │   └── redpillDataObjectGenerator.ts   # ML app data objects
│   ├── verification/              # Modular verification functions
│   │   ├── hardwareVerification.ts        # TEE hardware verification
│   │   ├── osVerification.ts               # OS integrity verification
│   │   ├── sourceCodeVerification.ts      # Source code verification
│   │   └── domainVerification.ts          # Domain ownership verification
│   ├── ui-exports.ts              # UI interface for data object access
│   ├── consts.ts                  # Constants and configuration data
│   └── utils/                     # Utility modules
│       ├── dcap-qvl.ts           # Intel DCAP quote verification
│       ├── dstack-mr.ts          # DStack measurement integration
│       ├── dstackContract.ts     # Smart contract interactions
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
├── shared/                       # Shared configuration and scripts
│   ├── config-qemu.sh           # QEMU configuration for measurement
│   ├── pin-packages.sh          # Package pinning for reproducibility
│   ├── kms-pinned-packages.txt  # KMS-specific package versions
│   └── qemu-pinned-packages.txt # QEMU-specific package versions
├── bin/                          # Built executable binaries
├── index.ts                      # Main entry point and examples
├── package.json                  # Project configuration and dependencies
├── tsconfig.json                 # TypeScript configuration
├── biome.json                    # Code formatting and linting rules
├── dockerfile                    # Multi-stage container build
└── README.md                     # Basic project information
```

## Technology Stack

### Runtime & Build Tools
- **Bun**: High-performance JavaScript runtime and package manager
- **TypeScript**: Statically typed JavaScript with strict configuration
- **Biome**: Modern code formatting and linting with organized imports

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

### Build Scripts
- `build:dcap-qvl`: Compiles Rust DCAP-QVL CLI tool with release optimizations
- `download:dstack-0.5.3`: Downloads and extracts DStack OS images for measurement

### Development Environment
- **Strict TypeScript**: Comprehensive type checking with latest ES features
- **Code Quality**: Biome formatting with single quotes and minimal semicolons
- **Import Organization**: Automatic import sorting and cleanup
- **Git Integration**: VCS-aware linting and formatting

### Container Architecture
- **Multi-stage Docker build**: Separate stages for QEMU, Rust compilation, and runtime
- **Privileged execution**: Required for measurement operations and QEMU integration
- **Pinned dependencies**: Reproducible builds with exact version specifications
- **Minimal runtime**: Debian-slim base with only necessary runtime dependencies

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

### Rust Test Suite
- Comprehensive DCAP-QVL functionality testing
- Sample quote validation with known good/bad examples
- Collateral retrieval testing with multiple sources
- Quote parsing and verification result validation

### TypeScript Type Safety
- Strict null checks and indexed access validation
- Comprehensive interface definitions with optional field handling
- Runtime type validation with parsing utilities
- Error handling with detailed error message construction

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

### Data Object Access and UI Integration
```typescript
import { UIDataInterface } from './src/ui-exports'

const ui = new UIDataInterface()
const allObjects = ui.getAllDataObjects()
const filteredObjects = ui.filterDataObjects({ type: 'hardware' })
const relationships = ui.getObjectRelationships()
```

## Essential Development Commands

```bash
# Install dependencies
bun install

# Run the main application with examples
bun run index.ts

# Code quality and formatting
bunx biome format --write .    # Format code
bunx biome lint .              # Lint code
bunx biome check --write .     # Format and lint in one command

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
- ✅ UI interface for data object access and visualization
- ✅ Smart contract integration with Base network
- ✅ Docker-based measurement tool integration
- ✅ Comprehensive type system with Zod validation schemas
- ✅ Modular verification functions with clean separation
- ✅ NVIDIA GPU attestation support for ML workloads

### Architecture Strengths
- **Modular Design**: Clean separation between verification types and utilities
- **Type Safety**: Comprehensive TypeScript interfaces with Zod runtime validation
- **Data Object System**: Structured verification data with UI access layer
- **External Integration**: Robust handling of external tools and services
- **Error Handling**: Comprehensive error management with detailed messages
- **Security Focus**: Production-grade cryptographic verification tools
- **NVIDIA Support**: Complete GPU attestation verification for ML workloads

### Development Notes
- The `consts.ts` file contains extensive configuration data and may benefit from modularization
- DCAP-QVL verification requires privileged Docker containers for measurement operations
- Smart contract addresses and configurations are currently hardcoded for the Base network
- Event-driven operations system has been refactored into data object collection system
- The `operations.ts` module has been removed in favor of integrated data object tracking
- Zod schemas provide comprehensive runtime validation for all JSON parsing operations

This comprehensive verification system provides enterprise-grade TEE attestation validation with complete transparency, auditability, and security for the DStack ecosystem.