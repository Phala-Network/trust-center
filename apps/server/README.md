# Trust Center Server

Bun/Elysia service with a BullMQ worker for TEE attestation verification and authenticated synchronization endpoints.

## Architecture

1. Full-sync cron jobs populate apps and profiles from Phala Cloud.
2. Signed pushes apply partial entity updates and queue verification for pushed eligible apps.
3. The task cron queues apps needing verification from the database.
4. A BullMQ worker verifies each app, stores results in S3-compatible storage and updates PostgreSQL task status.

Inbound routes:

- `/health/*`: service health.
- `/cron/*`: management, manual task creation and private sync audit, protected by `CRON_API_KEY`.
- `POST /webhooks/phala-cloud`: HMAC-authenticated current-state pushes.

See [Phala Cloud ingest contract and deployment guide](PHALA_CLOUD_INGEST.md) for signing headers, schemas, response codes, idempotency/recovery, audit access and tests.

## Services

- `queue.ts`, `queueProducer.ts`: BullMQ worker and bounded verification enqueue.
- `taskService.ts`: verification-task database operations.
- `appService.ts`, `profileService.ts`: transactional entity writes.
- `syncService.ts`: full snapshot reconciliation and verification scheduling.
- `phalaCloudIngestService.ts`: partial push application and durable verification hand-off.
- `syncEventService.ts`: private synchronization audit.
- `s3.ts`: verification result storage.

## Environment Variables

```sh
DATABASE_URL=postgresql://...
REDIS_URL=redis://localhost:6379
QUEUE_NAME=verification-queue
QUEUE_CONCURRENCY=5
QUEUE_MAX_ATTEMPTS=1
QUEUE_BACKOFF_DELAY=2000

S3_ENDPOINT=https://...
S3_ACCESS_KEY_ID=...
S3_SECRET_ACCESS_KEY=...
S3_BUCKET=verification-results

# Supply secrets securely; do not commit real values.
CRON_API_KEY=...
PHALA_CLOUD_API_KEY=...
PHALA_CLOUD_WEBHOOK_SECRET=...

PROFILE_CRON_PATTERN='*/10 * * * *'
APP_CRON_PATTERN='*/1 * * * *'
TASKS_CRON_PATTERN='*/5 * * * *'
```

`PHALA_CLOUD_API_KEY` is optional; without it full Cloud reads are disabled. `PHALA_CLOUD_WEBHOOK_SECRET` is independently optional; empty/unset disables ingress with 503. A configured webhook secret requires at least 32 characters. `CRON_API_KEY` is required.

## Development

```sh
# Docker Compose from the repository root
make dev

# Or, in apps/server
bun run dev
```

Apply migrations before deploying the new ingest/audit feature. Production deployment and existing cron environment overrides are owner-controlled; see the linked deployment guide.
