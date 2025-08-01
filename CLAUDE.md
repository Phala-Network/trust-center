# DStack Verifier Project

## Overview
The DStack Verifier is a TypeScript-based project for verifying TEE (Trusted Execution Environment) attestations in the DStack ecosystem. It provides verification capabilities for KMS (Key Management Service) and Gateway components using Intel TDX (Trust Domain Extensions) and NVIDIA GPU attestations.

## Architecture

### Core Components
- **Abstract Verifier Base Class** (`src/verifier.ts`): Defines the interface for all verifiers
- **KmsVerifier** (`src/kmsVerifier.ts`): Verifies KMS attestations using smart contract data
- **GatewayVerifier** (`src/gatewayVerifier.ts`): Verifies Gateway attestations (incomplete implementation)

### Key Features
1. **Hardware Verification**: TDX quote verification using DCAP-QVL
2. **Operating System Verification**: DStack image measurement verification
3. **Source Code Verification**: Compose hash verification through event logs
4. **Smart Contract Integration**: Retrieves attestation data from blockchain

## Project Structure

### Root Files
- `index.ts`: Main entry point with example DataObject interface
- `package.json`: Project configuration, dependencies, and build scripts
- `tsconfig.json`: TypeScript configuration
- `biome.json`: Code formatting and linting configuration
- `README.md`: Basic project information
- `dockerfile`: Container configuration

### Source Directory (`src/`)
- `types.ts`: Core type definitions for attestations, quotes, event logs, and app info
- `consts.ts`: Constants and hardcoded configurations (large file, 33k+ tokens)
- `verifier.ts`: Abstract base class for all verifiers
- `kmsVerifier.ts`: KMS verification implementation
- `gatewayVerifier.ts`: Gateway verification stub
- `utils/`: Utility modules
  - `dcap-qvl.ts`: DCAP quote verification library wrapper
  - `dstack-mr.ts`: DStack measurement and Docker integration
  - `dstackContract.ts`: Smart contract interaction utilities
  - `operations.ts`: Calculation and measurement operations
  - `abi/`: Smart contract ABI files
    - `DstackApp.json`: App registry contract ABI
    - `DstackKms.json`: KMS registry contract ABI

### External Dependencies (`external/`)
- `dcap-qvl/`: Rust-based DCAP quote verification library
  - Includes CLI tool, library code, and test samples
  - Supports both SGX and TDX quote verification
- `dstack-images/`: Container images and metadata for DStack OS

### Shared Resources (`shared/`)
- Configuration scripts for QEMU and KMS
- Package pinning scripts

## Key Technologies

### Languages & Frameworks
- **TypeScript**: Primary development language
- **Rust**: For DCAP-QVL library (external dependency)
- **Bun**: Runtime and package manager

### Blockchain Integration
- **viem**: Ethereum client library for smart contract interaction
- Smart contracts for attestation data storage and retrieval

### Security & Attestation
- **Intel DCAP-QVL**: Quote verification for TDX/SGX
- **Docker**: For isolated measurement execution
- **TDX/SGX**: Hardware-based attestation technologies

## Development Workflow

### Build Scripts
- `build:dcap-qvl`: Builds the Rust DCAP-QVL CLI tool
- `download:dstack-0.5.3`: Downloads DStack OS images

### Code Quality
- **Biome**: Formatting and linting with strict rules
- **TypeScript**: Strict mode enabled with comprehensive type checking

### Testing
- Rust tests for DCAP-QVL functionality
- Sample quote files for testing verification

## Key Data Structures

### Attestation Types
- `Quote`: Hexadecimal string representing TDX/SGX quotes
- `EventLog`: Array of measurement events from TEE
- `AttestationBundle`: Complete attestation with Intel and NVIDIA evidence
- `AppInfo`: Application configuration and TCB information
- `TcbInfo`: Trusted Computing Base measurements

### Verification Flow
1. Retrieve quote and event log from source (smart contract or direct)
2. Verify hardware attestation using DCAP-QVL
3. Verify OS integrity through image measurements
4. Verify source code through compose hash validation

## Current Status
- **KmsVerifier**: Fully implemented with smart contract integration
- **GatewayVerifier**: Stub implementation, needs completion
- **Core infrastructure**: Complete with comprehensive type system
- **External tools**: DCAP-QVL and DStack measurement tools integrated

## Git Status
- Modified: `bun.lock`
- Untracked: `src/gatewayVerifier.ts`, `src/utils/operations.ts`
- Recent commits focus on Rust DStack measurement integration and KMS verification

## Development Commands
```bash
# Install dependencies
bun install

# Run the application
bun run index.ts

# Build DCAP-QVL tool
bun run build:dcap-qvl

# Download DStack images
bun run download:dstack-0.5.3
```

## Notes for Development
- The `consts.ts` file is extremely large (33k+ tokens) and may need refactoring
- DCAP-QVL verification requires privileged Docker containers
- Smart contract addresses and configurations are hardcoded
- NVIDIA GPU attestation support is included but may not be fully implemented