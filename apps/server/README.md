# Trust Center Server

Background worker service for TEE attestation verification processing. This is a queue-based worker that processes verification tasks from a BullMQ queue.

## Architecture

The server is a **background worker** (not an HTTP API server). It:

1. Polls the database for pending verification tasks via `dbMonitor`
2. Adds tasks to a BullMQ queue
3. Processes tasks using `VerificationService` from `@phala/dstack-verifier`
4. Stores results in S3-compatible storage
5. Updates task status in PostgreSQL

## Services

- **queue.ts**: BullMQ queue and worker management
- **dbMonitor.ts**: Polls database for pending tasks and adds to queue
- **taskService.ts**: Database operations for verification tasks
- **appService.ts**: App data management and sync operations
- **s3.ts**: S3 storage for verification results

## Environment Variables

```bash
# Database
DATABASE_URL=postgresql://...

# Redis Queue
REDIS_URL=redis://localhost:6379
QUEUE_NAME=verification-tasks
QUEUE_CONCURRENCY=2
QUEUE_MAX_ATTEMPTS=1
QUEUE_BACKOFF_DELAY=5000

# S3 Storage
S3_ENDPOINT=https://...
S3_ACCESS_KEY_ID=...
S3_SECRET_ACCESS_KEY=...
S3_BUCKET=verification-results
```

## Development

```bash
# Start the worker (uses Docker Compose from root)
cd ../..
make dev

# Or run directly
bun run dev
```

## Task Flow

```
webapp → PostgreSQL (insert task) → dbMonitor → BullMQ → worker → S3 + PostgreSQL (update)
```

The webapp creates tasks by inserting into the `verification_tasks` table. The `dbMonitor` service detects new tasks and queues them for processing.
