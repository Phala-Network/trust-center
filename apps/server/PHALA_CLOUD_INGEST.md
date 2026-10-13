# Phala Cloud push ingest

Trust Center accepts current-state pushes; it does not call a per-entity Cloud read API. Full sync remains the repair path for missed and out-of-order deliveries.

## HTTP contract

`POST /webhooks/phala-cloud`, JSON UTF-8 body, **maximum 2 MiB** (2,097,152 raw bytes). All six fields are required, including empty arrays:

```json
{
  "event_id": "00000000-0000-4000-8000-000000000001",
  "sent_at": "2026-10-14T00:00:00+00:00",
  "profiles": [],
  "deleted_profiles": [{"entity_type": "user", "entity_id": 123}],
  "apps": [],
  "deleted_apps": [456]
}
```

- `event_id`: UUID, reused unchanged for all retries of one batch. Split larger pushes into batches with distinct IDs.
- `sent_at`: RFC3339 timestamp with timezone. Update it on every retry.
- `profiles`: row objects from `/api/v1/stats/entity_profile`: `entity_type`, `entity_id`, `display_name`, `avatar_url`, `description`, `custom_domain`, `created_at`, `updated_at`.
- `apps`: row objects from `/api/v1/stats/dstack_app`: `dstack_app_id`, `app_id`, `app_name`, `workspace_id`, `creator_id`, `chain_id`, `kms_contract_address`, `contract_address`, `base_image`, `tproxy_base_domain`, `gateway_domain_suffix`, `listed`, `username`, `email`, `app_created_at`, `vm_created_at`, `docker_compose_file`.
- Row schemas reuse the full-sync parsers/converter. Numeric entity IDs must be positive PostgreSQL integers. Row timestamps must be RFC3339; both `+00:00` and `Z`, absent fractional seconds and six-digit microseconds are accepted. Profile `updated_at` may be null, including every workspace row. App creation timestamps are non-null, as in the existing full-sync schema.
- `deleted_profiles`: named `(entity_type, entity_id)` pairs; delete only these profiles.
- `deleted_apps`: numeric upstream **`app_id`**, not a `dstack_app_id` string. Match local `apps.profile_id` and set `deleted=true`; do not delete verification history.
- Reject a payload that both upserts and deletes the same entity. Absence from any array has **no meaning**. No push invokes full-snapshot reconciliation.

### Authentication

Configure the same dedicated `PHALA_CLOUD_WEBHOOK_SECRET` on both sides (at least 32 characters). Do not reuse `CRON_API_KEY` or the outbound Cloud API credential. Empty/unset disables ingress.

Headers:

```text
Content-Type: application/json
X-Phala-Timestamp: <decimal Unix seconds>
X-Phala-Signature: sha256=<64 lowercase hex characters>
```

Signing bytes:

```text
ASCII(X-Phala-Timestamp) || ASCII(".") || exact raw UTF-8 request body
```

Use HMAC-SHA256 with the shared secret, then lowercase hexadecimal encoding. Do not reserialize the JSON between signing and sending. Authentication uses constant-time comparison before JSON parsing. Both the authenticated header timestamp and body `sent_at` must be within **±300 seconds** of server time. Keep hosts' clocks synchronized. Every retry updates `sent_at` and the header timestamp and recalculates the signature, while preserving `event_id`.

### Responses

| Code | Meaning | Sender action |
| --- | --- | --- |
| 200 | Entity transaction committed; original or duplicate delivery | Stop retrying |
| 400 | Invalid JSON/schema or contradictory upsert/delete | Permanent failure; fix payload |
| 401 | Bad/missing signature or stale/future timestamp | Permanent failure; check secret/signing/clock |
| 413 | Body exceeds 2 MiB | Split into new batches |
| 503 | Receiver signing secret is unset | Backoff/retry |
| 500 | Database apply/audit or verification hand-off failed | Backoff/retry the same event ID |

Successful body:

```json
{"success": true, "event_id": "00000000-0000-4000-8000-000000000001", "duplicate": false}
```

Successful replay returns `duplicate: true`, does not mutate entities or start a second successful hand-off. While the original delivery is still handing off verification, a concurrent duplicate can return 200 after the entity transaction has committed; persisted pending work is recovered independently.

## Transactions, verification and recovery

Entity changes and the event's success/pending audit row commit in one PostgreSQL transaction. A database failure rolls them all back; a sanitized error row is recorded outside that failed transaction. If PostgreSQL itself is unavailable, no receiver can persist its failure: return 500, retain console diagnostics and retry.

Verification uses the existing `syncSelectedTasks` eligibility filter, only for the pushed `dstack_app_id` values. Deletes and profile-only pushes do not queue verification. This bypasses the normal full-sync task tick, not the existing eligibility requirements (nonempty domain/contract and not deleted).

PostgreSQL and Redis cannot share a transaction. The committed audit row therefore includes pending app IDs. Dispatch uses a two-minute database lease, **without holding a database transaction or connection across Redis calls**. The queue producer has bounded retries and a ten-second command timeout, separate from the worker's unlimited-retry connection. Successful app hand-offs get durable per-app receipts. Partial failures retry only unreceipted IDs; jobs have deterministic event/app task IDs to cover enqueue-before-receipt crashes. `retry-webhook-verification` runs every minute and reclaims expired leases, up to 20 events per run. Sender retries also recover pending work without reapplying entity changes.

Entity application is idempotent per `event_id`. External queue delivery remains at-least-once across a crash between Redis enqueue and its PostgreSQL receipt: BullMQ job IDs and existing verification task IDs normally deduplicate that window, but are not an eternal exactly-once guarantee if both histories are deleted. Never purge pending audit rows. Do not introduce a sync-log retention policy that removes event IDs still eligible for sender replay.

Local full sync and push writes share an advisory transaction lock. This prevents interleaved local reconciliation, **not** source version ordering: a delayed older event or a snapshot fetched before a push can still overwrite newer state. Periodic full sync repairs it. There is no version watermark, incremental cursor or 304 implementation in this PR.

## Private sync audit

`GET /cron/sync-events`, authenticated with `Authorization: Bearer <CRON_API_KEY>`.

Optional query fields:

- `limit`: 1–100, default 50.
- `offset`: 0–10,000, default 0.
- `source`: `push`, `cron-profiles`, `cron-apps`.
- `result`: `pending`, `success`, `error`.

Returns `{success: true, events: [...]}`, newest first. Invalid queries return 400; absent/incorrect authentication returns 401. It is not exposed through the public app/verification APIs.

Each push event has one row (failed retries update it); each full sync run gets a distinct row. Counts record input entities, actual changed profile/app rows, result, sanitized error, timestamps and private verification recovery state. Full-sync changed counts exclude no-op updates and bookkeeping timestamps; zero on an unchanged snapshot is expected. `apps.last_synced_at` now reflects the last state-changing bulk sync rather than every no-op fetch. Empty full snapshots retain the existing safety behavior (do not delete everything).

Use changed counts across several days to decide whether pushes cover enough writes to lower full sync further. **This PR does not lower app sync** and does not change full sync to six hours/daily.

## Deployment (owner-controlled)

1. Apply database migrations **before** starting the new server:
   ```sh
   cd packages/db
   bun run migrate
   ```
   Use the deployment's existing secure `DATABASE_URL` injection. Do not point tests at production.
2. Generate/store a dedicated random signing secret securely and set `PHALA_CLOUD_WEBHOOK_SECRET` on both receiver and sender. Never put it in git or a PR comment. Empty/unset receiver secret returns 503.
3. Set production `PROFILE_CRON_PATTERN='*/10 * * * *'` explicitly if an existing environment overrides it; otherwise the updated application and Compose defaults apply. **Leave `APP_CRON_PATTERN` unchanged.** Updating a Compose `.env` requires recreating the server container, not merely restarting the unchanged container.
4. Roll out receiver, confirm authenticated private audit access, then enable sender. Forward the two signing headers and unmodified body through the reverse proxy. A proxy configured below 2 MiB must have its limit raised for the full advertised contract.
5. Observe errors, pending verification and full-sync changed-row counts. Rollout/production configuration changes are the owner's decision; this PR does not deploy them.

## Tests

Pure transport/authentication tests run without PostgreSQL:

```sh
bun test apps/server/src/routes/phalaCloudWebhook.test.ts
```

For complete HTTP, transaction, audit, no-op-count and lifecycle tests, provision a **disposable loopback** PostgreSQL database, run migrations against it, then:

```sh
TEST_DATABASE_URL='postgres://postgres@127.0.0.1:55439/trust_center_ingest_test' \
  bun test apps/server/src/routes/phalaCloudWebhook.test.ts \
           apps/server/src/services/partialWrites.test.ts \
           apps/server/src/services/syncService.test.ts --max-concurrency 1
bun run --cwd apps/server typecheck
bun run --cwd packages/db typecheck
```

HTTP tests truncate the disposable database; service tests use isolated schemas. Non-loopback test URLs are rejected. Without `TEST_DATABASE_URL`, database tests are explicitly skipped, not claimed as passed.
