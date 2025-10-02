# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# Trust Center Monorepo - TEE Attestation Verification Platform

## Project Overview

The Trust Center is a comprehensive TypeScript-based platform for managing and verifying Trusted Execution Environment (TEE) attestations in the DStack ecosystem. It provides a full-stack solution with a backend API server for verification task management, database persistence, queue-based processing, and a Next.js web application for user interaction.

The platform implements a modular monorepo architecture with separate packages for the verification engine, database layer, and applications. It features production-ready verification workflows with Intel TDX attestation, NVIDIA GPU verification, blockchain integration, and comprehensive verification data management.

## Key Development Notes

- **Architecture**: Monorepo using Bun workspaces with Turbo for build orchestration
- **Runtime**: Uses Bun as the JavaScript runtime and package manager
- **Type Safety**: Strict TypeScript with modular type definitions across packages
- **Code Quality**: Biome for formatting and linting (single quotes, minimal semicolons)
- **Database**: PostgreSQL with Drizzle ORM in shared `@phala/trust-center-db` package
- **API Server**: Elysia-based REST API with OpenAPI documentation
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
- Config types: `RedpillConfig`, `PhalaCloudConfig`, `VerificationFlags`
- API types: `VerificationResponse`, `VerificationError`
- Metadata types: `AppMetadata`, `OSSourceInfo`, `AppSourceInfo`, etc.
- Schema: `AppMetadataSchema` (Zod validation)

**Features:**
- Hardware attestation (Intel TDX/SGX quote verification)
- OS integrity verification (measurement registers)
- Source code authenticity (compose hash validation)
- Domain ownership verification (CT logs, DNS CAA, certificates)
- Modular verification system with configurable flags

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

- **Elysia**: Fast and type-safe web framework
- **PostgreSQL**: Relational database for task persistence
- **Drizzle ORM**: Type-safe database ORM
- **Redis**: In-memory store for queue management
- **BullMQ**: Queue system for background processing
- **S3 Storage**: Object storage for verification results

### Frontend Stack

- **Next.js**: React framework with App Router
- **React**: UI library
- **Tailwind CSS**: Utility-first CSS framework
- **shadcn/ui**: Component library

### Verification Stack

- **Intel DCAP-QVL**: Rust-based quote verification
- **Docker**: Measurement tools
- **viem**: Ethereum client for smart contracts
- **Base Network**: L2 blockchain for attestation storage

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

- Production Intel DCAP-QVL for hardware attestation
- Certificate chain validation with trusted CAs
- TEE-controlled key validation
- Secure hash comparison for compose integrity

### API Security

- Bearer token authentication for protected endpoints
- Input validation with Zod schemas
- Rate limiting and request validation
- CORS configuration for frontend integration

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

const service = new VerificationService()
const result = await service.verify({
  contractAddress: '0x...',
  model: 'phala/model-name',
}, {
  hardware: true,
  os: true,
  sourceCode: true,
})
```

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
