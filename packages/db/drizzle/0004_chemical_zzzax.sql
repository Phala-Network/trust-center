ALTER TABLE "verification_tasks" ADD COLUMN "user" text;--> statement-breakpoint
CREATE INDEX "verification_tasks_user_index" ON "verification_tasks" USING btree ("user");