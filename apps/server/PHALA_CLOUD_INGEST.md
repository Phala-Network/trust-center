# Phala Cloud push ingest

Trust Center accepts current-state pushes without a per-entity Cloud read API. Full sync repairs missed and out-of-order deliveries.

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

- `event_id`: UUID, reused for retries of one batch. Split larger pushes into batches with distinct IDs.
- `sent_at`: RFC3339 timestamp with timezone; update on every retry.
- `profiles`: rows from `/api/v1/stats/entity_profile`: `entity_type`, `entity_id`, `display_name`, `avatar_url`, `description`, `custom_domain`, `created_at`, `updated_at`.
- `apps`: rows from `/api/v1/stats/dstack_app`: `dstack_app_id`, `app_id`, `app_name`, `workspace_id`, `creator_id`, `chain_id`, `kms_contract_address`, `contract_address`, `base_image`, `tproxy_base_domain`, `gateway_domain_suffix`, `listed`, `username`, `email`, `app_created_at`, `vm_created_at`, `docker_compose_file`.
- Rows reuse full-sync parsers/converter. Numeric entity IDs must be positive PostgreSQL integers. Row timestamps must be RFC3339; `+00:00`/`Z`, absent fractions and six-digit microseconds are accepted. Profile `updated_at` may be null, including workspace rows. App creation timestamps are non-null, as in full sync.
- `deleted_profiles`: named `(entity_type, entity_id)` pairs; delete only these profiles.
- `deleted_apps`: numeric upstream **`app_id`**, not a `dstack_app_id` string. Match local `apps.profile_id` and mark `deleted=true`; retain verification history.
- Reject simultaneous upsert/delete of the same entity. Absence from a push has **no meaning**; no push invokes full-snapshot reconciliation.

### Authentication

Use a dedicated `PHALA_CLOUD_WEBHOOK_SECRET` shared by sender and receiver (at least 32 characters). Do not reuse `CRON_API_KEY` or the outbound Cloud credential. An empty/unset/short secret disables **only webhook ingress**, returning 503; other server functionality starts normally.

```text
Content-Type: application/json
X-Phala-Timestamp: <decimal Unix seconds>
X-Phala-Signature: sha256=<64 lowercase hex characters>
```

Signing bytes:

```text
ASCII(X-Phala-Timestamp) || ASCII(".") || exact raw UTF-8 request body
```

Compute HMAC-SHA256 with the shared secret, then lowercase hexadecimal encoding. Do not reserialize JSON between signing and sending. Constant-time signature comparison precedes JSON parsing. Both the authenticated header timestamp and body `sent_at` must be within **±300 seconds** of server time. Keep clocks synchronized. Retries refresh both timestamps and recalculate the signature, while preserving `event_id`.

### Responses

| Code | Meaning | Sender action |
| --- | --- | --- |
| 200 | Entity transaction committed; original or duplicate | Stop retrying |
| 400 | Invalid JSON/schema or contradictory tombstones | Permanent failure; fix payload |
| 401 | Bad/missing signature or stale/future timestamp | Permanent failure; check signing/clock |
| 413 | Body exceeds 2 MiB | Split into new batches |
| 503 | Receiver secret is missing or too short | Backoff/retry |
| 500 | Database apply/audit failed | Backoff/retry the same event ID |

```json
{"success": true, "event_id": "00000000-0000-4000-8000-000000000001", "duplicate": false}
```

Replay returns `duplicate: true`, with no entity mutation or second verification hint. **200 acknowledges committed entity state, not successful verification enqueue.** Queue failure does not change an already-committed event to 500.

## Transactions and verification

Entity writes and the success/idempotency audit row commit in one PostgreSQL transaction. Apply failure rolls back all writes; an error row is recorded outside the failed transaction. If PostgreSQL itself is unavailable, failure auditing cannot be persisted: return 500 and allow sender retry.

After commit, dispatch one asynchronous **best-effort** `syncSelectedTasks` call for the pushed `dstack_app_id` values. It uses the existing eligibility filter (nonempty domain/contract, not deleted). Profile-only pushes and tombstones do not queue verification. Redis readiness does not delay HTTP acknowledgement. Rejected enqueue logs the exception and stores a warning in the committed success row's `error_message`; this warning may arrive after the HTTP response.

The existing `sync-tasks` cron, normally every five minutes, is the fallback for eligible apps lacking a recent report. It uses a separately exposed local-DB `taskSync`, so it runs in **push-only deployments without `PHALA_CLOUD_API_KEY`**. Existing recent-report and failure cooldowns remain unchanged: a recently verified or cooling-down app is not guaranteed another attempt within five minutes. There is no persistent verification outbox, lease, receipt, hash-based task ID, new queue producer or separate recovery cron.

Both full-sync paths take the same PostgreSQL advisory lock **before fetching their upstream snapshot**, then apply it and audit within that transaction. Push writes wait during a full fetch; a full sync waiting behind a push cannot use a pre-push snapshot. Single-app conversion failures are logged and skipped, preserving the main branch's behavior; an all-unconvertible nonempty snapshot fails before mutation. Skipped app IDs remain in the full snapshot's presence set, so they are not falsely marked deleted.

Push-to-push source ordering is still unversioned: a delayed older push can overwrite newer state, corrected by a later full sync. No incremental cursor or 304 implementation is included.

## Private audit and retention

`GET /cron/sync-events`, using `Authorization: Bearer <CRON_API_KEY>`.

Optional query fields: `limit` 1–100 (default 50), `offset` 0–10,000 (default 0), `source` (`push`, `cron-profiles`, `cron-apps`) and `result` (`success`, `error`). Invalid queries return 400; missing/wrong credentials return 401.

Returns `{success: true, events: [...]}`, newest first. Explicitly selected fields are `id`, `source`, `eventId`, profile/app input and deletion counts, `rowsChanged`, `result`, `errorMessage`, `receivedAt`, `finishedAt`. The list is not exposed through public app/verification APIs. A success row with `errorMessage` is a post-commit verification warning, not a rolled-back entity transaction.

One row per push event; failed retries update it. Each full-sync run gets a distinct row. Actual business changed-row counts exclude bookkeeping timestamps; an unchanged snapshot reports zero. **Every observed app still refreshes `last_synced_at`**, as before. The business-field comparison list must be updated with new mapped app fields, with its existing per-field tests.

The existing daily cleanup cron deletes **all sync audit rows older than 30 days**, including push `event_id` idempotency markers. Normal sender retries span hours, not 30 days. After retention expires an old event may apply again; full sync is the repair fallback. This bounded replay horizon is intentional. Empty full snapshots retain the existing safeguard against wiping all entities.

Use full-sync changed counts over several days before considering six-hour/daily intervals. This PR changes the profile default to ten minutes only; **app sync is not lowered**.

## Deployment (owner-controlled)

1. Apply the new migration before starting the receiver, using secure deployment `DATABASE_URL` injection:
   ```sh
   bun run --cwd packages/db migrate
   ```
   Migration `0008_sync_events` creates only the private audit table. This PR is unmerged/undeployed; its revised migration replaces the earlier review version containing dispatch internals. A local test/preview database already migrated against that earlier version must be recreated or reconciled before re-running migration; do not treat editing an applied migration as a production upgrade procedure.
2. Securely generate/store the dedicated shared secret on sender and receiver. Never commit/post it. Missing/short receiver secret returns 503 without preventing other server features.
3. If production overrides the cron, explicitly set `PROFILE_CRON_PATTERN='*/10 * * * *'`; otherwise new application/Compose defaults apply. **Leave `APP_CRON_PATTERN` unchanged.** Recreate the server container after a Compose environment update; restarting an old container does not update its environment.
4. Deploy receiver, confirm private audit access, then enable sender. Proxy must forward signing headers and unmodified body and allow up to 2 MiB.
5. Observe errors/warnings and full-sync changed counts. Deployment and production changes remain the owner's decision; none are performed by this PR.

## Tests

Without PostgreSQL, integration tests explicitly skip:

```sh
bun test apps/server/src
```

Provision a **disposable loopback PostgreSQL database**, migrate it, then run complete HTTP, transaction, ordering, retention and lifecycle tests:

```sh
TEST_DATABASE_URL='postgres://postgres@127.0.0.1:55439/trust_center_ingest_test' \
  bun test apps/server/src --max-concurrency 1
bun run typecheck
```

HTTP tests truncate the disposable database; service tests use isolated schemas. Non-loopback URLs are rejected. Queue/fetch boundaries are substituted; no Cloud, storage or verifier service is contacted. CI supplies a migrated PostgreSQL service and runs the complete server suite.
