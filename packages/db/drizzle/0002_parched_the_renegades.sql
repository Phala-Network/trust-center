ALTER TABLE "verification_tasks" ADD COLUMN "dstack_version" text;--> statement-breakpoint
ALTER TABLE "verification_tasks" ADD COLUMN "data_objects" jsonb;--> statement-breakpoint
CREATE INDEX "verification_tasks_dstack_version_index" ON "verification_tasks" USING btree ("dstack_version");