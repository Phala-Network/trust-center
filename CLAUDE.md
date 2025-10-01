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
│   │   │   └── server/           # Server implementation
│   │   │       ├── app.ts        # Elysia application factory
│   │   │       ├── index.ts      # Server lifecycle
│   │   │       ├── plugin/       # Authentication plugins
│   │   │       ├── routes/       # API endpoints
│   │   │       │   ├── health.ts
│   │   │       │   ├── apps/     # App management endpoints
│   │   │       │   ├── tasks/    # Task management endpoints
│   │   │       │   └── queue.ts  # Queue management
│   │   │       └── services/     # Business logic services
│   │   │           ├── index.ts
│   │   │           ├── queue.ts
│   │   │           ├── s3.ts
│   │   │           └── taskService.ts
│   │   └── package.json
│   └── webapp/                    # Next.js web application
│       ├── src/
│       │   ├── app/              # Next.js app router
│       │   ├── components/       # React components
│       │   └── lib/              # Utilities
│       └── package.json
├── packages/                      # Shared packages
│   ├── db/                       # Database package
│   │   ├── schema.ts             # Database schema
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
├── package.json                  # Root package.json
├── turbo.json                    # Turbo configuration
└── tsconfig.json                 # Root TypeScript config
```

## Package Architecture

### @phala/trust-center-db

Database package providing PostgreSQL integration with Drizzle ORM.

**Exports:**
- `createDbConnection()`: Database connection factory
- `verificationTasksTable`: Drizzle table definition
- Types: `VerificationTask`, `VerificationTaskStatus`, `AppConfigType`

**Schema:**
- `verification_tasks`: Task tracking with status, timestamps, and results
- Indexed fields for efficient querying (app_id, status, timestamps)
- JSONB fields for flexible metadata storage

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

Elysia-based REST API server with queue-based verification processing.

**Key Features:**
- OpenAPI documentation with Swagger UI
- Bearer token authentication
- PostgreSQL persistence for verification tasks
- Redis-based BullMQ queue for background processing
- S3-compatible storage for verification results
- Comprehensive task management endpoints

**API Endpoints:**
- `POST /api/v1/tasks` - Create verification task
- `GET /api/v1/tasks/:id` - Get task status
- `GET /api/v1/tasks` - List tasks with filtering
- `POST /api/v1/tasks/:id/cancel` - Cancel task
- `POST /api/v1/tasks/:id/retry` - Retry failed task
- `DELETE /api/v1/tasks/:id` - Delete task
- `GET /api/v1/apps` - List unique apps
- `GET /api/v1/apps/:id` - Get app details
- `GET /api/v1/health` - Health check

**Location:** `apps/server/`

### webapp (Frontend)

Next.js web application for user interaction with the verification platform.

**Key Features:**
- Modern React with App Router
- shadcn/ui component library
- Tailwind CSS styling
- Type-safe API integration

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
# Generate migration files
bun run db:generate

# Apply migrations
bun run db:migrate

# Push schema changes
bun run db:push

# Open database studio
bun run db:studio
```

## Development Workflow

### Build Scripts

```bash
# Development
bun run dev              # Start all apps in dev mode
bun run server:dev       # Server only
bun run webapp:dev       # Webapp only

# Production
bun run build            # Build all packages and apps
bun run server:start     # Start production server
bun run webapp:start     # Start production webapp

# Quality
bun run typecheck        # Type check all packages
bun run lint             # Lint all packages
bun run format           # Format all packages
bun run test             # Run all tests

# Database
bun run db:generate      # Generate migrations
bun run db:push          # Push schema changes
```

### Package Structure Guidelines

- **Shared types** go in `@phala/trust-center-db` or `@phala/dstack-verifier`
- **Database schema** is centralized in `@phala/trust-center-db`
- **Verification logic** stays in `@phala/dstack-verifier`
- **API routes and services** are in `apps/server/src/server/`
- **UI components** are in `apps/webapp/src/components/`

## API Documentation

### Task Creation

```typescript
POST /api/v1/tasks
Content-Type: application/json

{
  "appId": "0x78601222ada762fa7cdcbc167aa66dd7a5f57ece",
  "appName": "phala/deepseek-chat",
  "appConfigType": "redpill",
  "contractAddress": "0x78601222ada762fa7cdcbc167aa66dd7a5f57ece",
  "modelOrDomain": "phala/deepseek-chat",
  "metadata": {
    "osSource": {
      "github_repo": "https://github.com/Phala-Network/dstack",
      "git_commit": "abc123",
      "version": "v0.5.3"
    }
  },
  "flags": {
    "hardware": true,
    "os": true,
    "sourceCode": true
  }
}
```

### Task Status

```typescript
GET /api/v1/tasks/:id

Response:
{
  "task": {
    "id": "uuid",
    "status": "completed",
    "appId": "...",
    "s3Filename": "...",
    "dataObjects": ["..."],
    "createdAt": "2024-01-01T00:00:00Z",
    "finishedAt": "2024-01-01T00:05:00Z"
  }
}
```

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
# Production
docker compose up -d

# Development
docker compose -f compose.dev.yml up
```

### Service Architecture

- **API Server**: Elysia application on port 3000
- **Queue Workers**: BullMQ workers for background tasks
- **PostgreSQL**: Database on port 5432
- **Redis**: Queue backend on port 6379
- **Object Storage**: S3-compatible storage

## Usage Examples

### Server Development

```bash
# Start server in development mode
cd apps/server
bun run dev

# Type check
bun run typecheck

# Run specific endpoint
curl http://localhost:3000/health
```

### Database Operations

```bash
# Add migration
bun run db:generate

# Apply changes
bun run db:push

# Inspect database
bun run db:studio
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
- Database extracted to `@phala/trust-center-db` package
- Verifier minimized exports to essential types only
- Drizzle configuration moved to db package
- Server code remains in `apps/server/src/server/`
