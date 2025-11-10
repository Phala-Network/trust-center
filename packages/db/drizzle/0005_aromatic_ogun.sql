CREATE TYPE "public"."profile_entity_type" AS ENUM('app', 'user', 'workspace');--> statement-breakpoint
CREATE TABLE "profiles" (
	"id" text PRIMARY KEY NOT NULL,
	"entity_type" "profile_entity_type" NOT NULL,
	"entity_id" integer NOT NULL,
	"display_name" text,
	"avatar_url" text,
	"description" text,
	"custom_domain" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "verification_tasks" ADD COLUMN "app_profile_id" text;--> statement-breakpoint
ALTER TABLE "verification_tasks" ADD COLUMN "workspace_id" text;--> statement-breakpoint
ALTER TABLE "verification_tasks" ADD COLUMN "creator_id" text;--> statement-breakpoint
CREATE UNIQUE INDEX "entity_unique_idx" ON "profiles" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "profiles_entity_type_index" ON "profiles" USING btree ("entity_type");--> statement-breakpoint
CREATE INDEX "profiles_entity_id_index" ON "profiles" USING btree ("entity_id");--> statement-breakpoint
CREATE INDEX "profiles_display_name_index" ON "profiles" USING btree ("display_name");--> statement-breakpoint
CREATE INDEX "profiles_custom_domain_index" ON "profiles" USING btree ("custom_domain");--> statement-breakpoint
CREATE INDEX "verification_tasks_app_profile_id_index" ON "verification_tasks" USING btree ("app_profile_id");--> statement-breakpoint
CREATE INDEX "verification_tasks_workspace_id_index" ON "verification_tasks" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "verification_tasks_creator_id_index" ON "verification_tasks" USING btree ("creator_id");