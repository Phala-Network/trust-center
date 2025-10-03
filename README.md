# Trust Center Monorepo

A monorepo containing the DStack TEE verification infrastructure and trust center web application, managed with Turborepo.

## Project Structure

```
trust-center-monorepo/
├── apps/
│   ├── server/            # Background Worker (BullMQ Queue Processing)
│   └── webapp/            # Trust Center Web Application (Next.js)
├── packages/
│   ├── db/                # Database Package (@phala/trust-center-db)
│   └── verifier/          # Core TEE Verification Library (@phala/dstack-verifier)
├── Dockerfile             # Production Docker image
├── compose.yml            # Production Docker Compose
├── compose.dev.yml        # Development Docker Compose
└── Makefile               # Build and deployment commands
```

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
- Operating system integrity validation
- Source code authenticity verification
- Domain ownership validation
- Smart contract integration with Base network
- Modular verification architecture

**Tech Stack:** TypeScript, Viem, Zod

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

### Other Commands

```bash
# Type check all code
bun run typecheck
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
