CREATE TABLE "sync_events" (
	"id" text PRIMARY KEY NOT NULL,
	"source" text NOT NULL,
	"event_id" text,
	"profile_count" integer DEFAULT 0 NOT NULL,
	"deleted_profile_count" integer DEFAULT 0 NOT NULL,
	"app_count" integer DEFAULT 0 NOT NULL,
	"deleted_app_count" integer DEFAULT 0 NOT NULL,
	"rows_changed" integer DEFAULT 0 NOT NULL,
	"result" text NOT NULL,
	"error_message" text,
	"received_at" timestamp DEFAULT now() NOT NULL,
	"finished_at" timestamp,
	"verification_app_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"verification_pending" boolean DEFAULT false NOT NULL,
	"verification_claim_id" text,
	"verification_claimed_at" timestamp,
	"verification_dispatched_app_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	CONSTRAINT "sync_events_eventId_unique" UNIQUE("event_id")
);
--> statement-breakpoint
CREATE INDEX "sync_events_received_at_index" ON "sync_events" USING btree ("received_at");--> statement-breakpoint
CREATE INDEX "sync_events_verification_pending_index" ON "sync_events" USING btree ("verification_pending");