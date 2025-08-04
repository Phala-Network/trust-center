# DStack Verifier - TEE Attestation Verification System

## Project Overview

The DStack Verifier is a comprehensive TypeScript-based system designed to verify Trusted Execution Environment (TEE) attestations in the DStack ecosystem. It provides robust verification capabilities for Key Management Service (KMS) and Gateway components using Intel TDX (Trust Domain Extensions), NVIDIA GPU attestations, and blockchain-based smart contract integration.

The project implements a multi-layered verification approach encompassing hardware attestation, operating system integrity, source code authenticity, and domain ownership validation through Certificate Transparency logs and ACME certificate management.

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
- Provides Certificate Authority public key extraction
- Supports hardware quote verification using DCAP-QVL
- Performs OS integrity validation through DStack image measurement
- Validates source code authenticity via compose hash comparison

**GatewayVerifier (`src/gatewayVerifier.ts`)**
- Extends KmsVerifier with domain ownership verification capabilities
- Implements the `OwnDomain` interface for complete domain control validation
- Retrieves attestation data from Gateway RPC endpoints
- Performs comprehensive certificate chain validation
- Analyzes Certificate Transparency logs for historical domain control evidence
- Validates DNS CAA records for ACME account restrictions
- Includes robust certificate parsing and trust chain verification

### Type System & Data Structures

#### Core Types (`src/types.ts`)
- **`Quote`**: Hexadecimal TEE quotes with strict type safety (`0x${string}`)
- **`EventLog`**: Array of measurement entries from TEE execution
- **`AttestationBundle`**: Complete attestation with Intel and NVIDIA evidence
- **`AppInfo`**: Comprehensive application metadata including TCB information
- **`TcbInfo`**: Trusted Computing Base measurements and configuration
- **`AcmeInfo`**: ACME account data for domain ownership verification
- **`CTVerificationResult`**: Certificate Transparency analysis results

#### Verification Events (`src/types.ts`)
- **`CalculationEvent`**: Tracks calculation operations with input/output references
- **`MeasurementEvent`**: Records measurement comparisons with pass/fail status
- **`DataObject`**: Structured data representation for report generation

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

#### Operations & Event System (`src/utils/operations.ts`)
- Event-driven calculation and measurement tracking
- **`calculate()`**: Wraps calculations with event emission for audit trails
- **`measure()`**: Wraps comparisons with detailed pass/fail tracking
- Global event collection system with custom emitter support
- Provides verification transparency and auditability

## Project Structure

```
dstack-verifier/
├── src/                           # Core source code
│   ├── types.ts                   # Type definitions and interfaces
│   ├── verifier.ts                # Abstract base classes
│   ├── kmsVerifier.ts             # KMS verification implementation
│   ├── gatewayVerifier.ts         # Gateway verification with domain validation
│   ├── consts.ts                  # Constants and configuration data
│   └── utils/                     # Utility modules
│       ├── dcap-qvl.ts           # Intel DCAP quote verification
│       ├── dstack-mr.ts          # DStack measurement integration
│       ├── dstackContract.ts     # Smart contract interactions
│       ├── operations.ts         # Event-driven operations tracking
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
│       └── dstack-0.5.3/         # Specific version artifacts
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

### Event Tracking
```typescript
import { calculate, measure, getCollectedEvents } from './src/utils/operations'

const hash = calculate('input', data, 'output', 'sha256', () => sha256(data))
const valid = measure(expected, actual, () => expected === actual)
const events = getCollectedEvents() // Audit trail
```

## Development Commands

```bash
# Install dependencies
bun install

# Run the main application with examples
bun run index.ts

# Build the DCAP-QVL CLI tool
bun run build:dcap-qvl

# Download DStack OS images for measurement
bun run download:dstack-0.5.3

# Format and lint code
bunx biome format --write .
bunx biome lint .
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
- ✅ Event-driven architecture with comprehensive audit trails
- ✅ Smart contract integration with Base network
- ✅ Docker-based measurement tool integration
- ✅ Comprehensive type system with strict TypeScript

### Architecture Strengths
- **Modular Design**: Clean separation between verification types and utilities
- **Type Safety**: Comprehensive TypeScript interfaces with runtime validation
- **Event Transparency**: Complete audit trail for all verification operations
- **External Integration**: Robust handling of external tools and services
- **Error Handling**: Comprehensive error management with detailed messages
- **Security Focus**: Production-grade cryptographic verification tools

### Development Notes
- The `consts.ts` file contains extensive configuration data and may benefit from modularization
- DCAP-QVL verification requires privileged Docker containers for measurement operations
- Smart contract addresses and configurations are currently hardcoded for the Base network
- NVIDIA GPU attestation support is implemented but may require additional testing
- Certificate Transparency log analysis includes rate limiting considerations for production use

This comprehensive verification system provides enterprise-grade TEE attestation validation with complete transparency, auditability, and security for the DStack ecosystem.