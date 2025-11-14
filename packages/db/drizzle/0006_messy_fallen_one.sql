CREATE TABLE "apps" (
	"id" text PRIMARY KEY NOT NULL,
	"profile_id" integer NOT NULL,
	"app_name" text NOT NULL,
	"app_config_type" "app_config_type" NOT NULL,
	"contract_address" text NOT NULL,
	"model_or_domain" text NOT NULL,
	"dstack_version" text,
	"workspace_id" integer NOT NULL,
	"creator_id" integer NOT NULL,
	"chain_id" integer,
	"kms_contract_address" text,
	"base_image" text NOT NULL,
	"tproxy_base_domain" text,
	"gateway_domain_suffix" text,
	"username" text,
	"email" text,
	"is_public" boolean DEFAULT false NOT NULL,
	"deleted" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp,
	"last_synced_at" timestamp,
	CONSTRAINT "apps_profileId_unique" UNIQUE("profile_id")
);
--> statement-breakpoint
DROP INDEX "verification_tasks_app_profile_id_index";--> statement-breakpoint
DROP INDEX "verification_tasks_app_name_index";--> statement-breakpoint
DROP INDEX "verification_tasks_app_config_type_index";--> statement-breakpoint
DROP INDEX "verification_tasks_contract_address_index";--> statement-breakpoint
DROP INDEX "verification_tasks_model_or_domain_index";--> statement-breakpoint
DROP INDEX "verification_tasks_dstack_version_index";--> statement-breakpoint
DROP INDEX "verification_tasks_is_public_index";--> statement-breakpoint
DROP INDEX "verification_tasks_user_index";--> statement-breakpoint
DROP INDEX "verification_tasks_workspace_id_index";--> statement-breakpoint
DROP INDEX "verification_tasks_creator_id_index";--> statement-breakpoint
ALTER TABLE "verification_tasks" ALTER COLUMN "app_id" DROP NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "app_profile_id_idx" ON "apps" USING btree ("profile_id");--> statement-breakpoint
CREATE INDEX "apps_app_name_index" ON "apps" USING btree ("app_name");--> statement-breakpoint
CREATE INDEX "apps_contract_address_index" ON "apps" USING btree ("contract_address");--> statement-breakpoint
CREATE INDEX "apps_workspace_id_index" ON "apps" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "apps_creator_id_index" ON "apps" USING btree ("creator_id");--> statement-breakpoint
CREATE INDEX "apps_is_public_index" ON "apps" USING btree ("is_public");--> statement-breakpoint
CREATE INDEX "apps_deleted_index" ON "apps" USING btree ("deleted");--> statement-breakpoint
CREATE INDEX "apps_app_config_type_index" ON "apps" USING btree ("app_config_type");--> statement-breakpoint
ALTER TABLE "verification_tasks" ADD CONSTRAINT "verification_tasks_app_id_apps_id_fk" FOREIGN KEY ("app_id") REFERENCES "public"."apps"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verification_tasks" DROP COLUMN "app_profile_id";--> statement-breakpoint
ALTER TABLE "verification_tasks" DROP COLUMN "app_name";--> statement-breakpoint
ALTER TABLE "verification_tasks" DROP COLUMN "app_config_type";--> statement-breakpoint
ALTER TABLE "verification_tasks" DROP COLUMN "dstack_version";--> statement-breakpoint
ALTER TABLE "verification_tasks" DROP COLUMN "contract_address";--> statement-breakpoint
ALTER TABLE "verification_tasks" DROP COLUMN "model_or_domain";--> statement-breakpoint
ALTER TABLE "verification_tasks" DROP COLUMN "is_public";--> statement-breakpoint
ALTER TABLE "verification_tasks" DROP COLUMN "user";--> statement-breakpoint
ALTER TABLE "verification_tasks" DROP COLUMN "workspace_id";--> statement-breakpoint
ALTER TABLE "verification_tasks" DROP COLUMN "creator_id";