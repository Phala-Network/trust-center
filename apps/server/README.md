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

- `queue.ts`: existing BullMQ queue and verification worker.
- `taskService.ts`: verification-task database operations.
- `appService.ts`, `profileService.ts`: transactional entity writes.
- `syncService.ts`: full snapshot reconciliation and verification scheduling.
- `phalaCloudIngestService.ts`: partial push application and best-effort verification hint.
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

PROFILE_CRON_PATTERN='*/1 * * * *'
APP_CRON_PATTERN='*/1 * * * *'
TASKS_CRON_PATTERN='*/5 * * * *'
```

Reuse the existing `PHALA_CLOUD_API_KEY` for both Cloud reads and webhook HMAC verification; the sender uses the same existing value as `STATS_API_TOKEN`. Empty/unset disables reads and makes ingress return 503. No new environment variable or key-length requirement is introduced. `CRON_API_KEY` remains required for admin management only. Verification task cron reads the local DB and remains enabled without the Cloud credential. **Do not modify/add deployment environment settings for this feature**; existing cron overrides and Compose defaults stay unchanged. The application-only profile fallback is ten minutes when no pattern is supplied.

## Development

```sh
# Docker Compose from the repository root
make dev

# Or, in apps/server
bun run dev
```

Apply migrations before deploying the new ingest/audit feature. Production deployment and existing cron environment overrides are owner-controlled; see the linked deployment guide.
