# Trust Center Monorepo

A monorepo containing the DStack TEE verification infrastructure and trust center web application, managed with Turborepo.

## Project Structure

```
trust-center-monorepo/
├── apps/
│   ├── server/            # DStack Verifier HTTP API Server
│   └── webapp/            # Trust Center Web Application (Next.js)
└── packages/
    └── verifier/          # Core TEE Verification Library (@phala/dstack-verifier)
```

## Packages

### Verifier (`packages/verifier`)

The `@phala/dstack-verifier` package is a comprehensive TypeScript library for verifying Trusted Execution Environment (TEE) attestations. It provides robust verification capabilities for Key Management Service (KMS), Gateway, and ML application components.

**Key Features:**
- Hardware attestation verification (Intel TDX/SGX, NVIDIA GPU)
- Operating system integrity validation
- Source code authenticity verification
- Domain ownership validation
- Smart contract integration with Base network
- Modular verification architecture

**Tech Stack:** TypeScript, Viem, Zod

## Applications

### Server (`apps/server`)

Production-ready HTTP API server built on the `@phala/dstack-verifier` package, providing RESTful endpoints for TEE verification with database persistence and background job processing.

**Key Features:**
- RESTful API with OpenAPI documentation
- PostgreSQL database with Drizzle ORM
- Redis-backed job queue with BullMQ
- S3-compatible object storage
- Bearer token authentication
- Docker deployment ready

**Tech Stack:** Bun, TypeScript, Elysia, PostgreSQL, Redis, BullMQ

See [apps/server/README.md](apps/server/README.md) for detailed documentation.

### Web App (`apps/webapp`)

A modern Next.js trust center dashboard for visualizing TEE verification data, trust relationships, and system status. Provides interactive visualizations using React Flow and comprehensive UI components.

**Key Features:**
- Interactive data object visualization
- Trust relationship diagrams
- Real-time verification status
- Comprehensive UI component library (shadcn/ui)
- Dark mode support

**Tech Stack:** Next.js 15, React 19, TypeScript, Tailwind CSS, React Flow, shadcn/ui

## Getting Started

### Prerequisites

- [Bun](https://bun.sh/) >= 1.1.42
- Node.js >= 18 (for compatibility)
- PostgreSQL (for verifier)
- Redis (for verifier)
- Rust toolchain (for verifier's DCAP-QVL)
- Docker (optional, for containerized deployment)

### Installation

```bash
# Install all dependencies
bun install
```

### Development

#### Run all apps in development mode:
```bash
bun dev
```

#### Run specific app:
```bash
# Server API
bun run server:server:dev

# Web app dashboard
bun run webapp:dev
```

### Building

#### Build all apps:
```bash
bun run build
```

#### Build specific app:
```bash
bun run webapp:build
```

### Other Commands

```bash
# Format all code
bun run format

# Lint all code
bun run lint

# Type check all code
bun run typecheck

# Run tests
bun run test

# Clean all build artifacts and dependencies
bun run clean
```

## Database Commands

```bash
# Database operations (shared across all apps)
bun run db:generate   # Generate migrations
bun run db:migrate    # Run migrations
bun run db:push       # Push schema changes
bun run db:studio     # Open database studio
```

## Server-Specific Commands

```bash
# Start server
bun run server:start         # Simple HTTP server
bun run server:server        # Advanced Elysia server
bun run server:server:dev    # Development mode with hot reload
```

## Environment Variables

Each app has its own environment configuration:

- **Server**: See `apps/server/.env.example`
- **Web App**: See `apps/webapp/.env.example`

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

1. Clone the repository
2. Install dependencies: `bun install`
3. Create a feature branch
4. Make your changes
5. Run tests and type checking: `bun run test && bun run typecheck`
6. Submit a pull request

## License

See individual app directories for licensing information.

## Links

- [DStack TEE](https://github.com/Dstack-TEE)
- [Turborepo Documentation](https://turbo.build/repo/docs)
- [Bun Documentation](https://bun.sh/docs)
