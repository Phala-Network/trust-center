CREATE TYPE "public"."app_config_type" AS ENUM('redpill', 'phala_cloud');--> statement-breakpoint
CREATE TYPE "public"."verification_task_status" AS ENUM('pending', 'active', 'completed', 'failed');--> statement-breakpoint
CREATE TABLE "verification_tasks" (
	"id" text PRIMARY KEY NOT NULL,
	"job_name" text DEFAULT 'verification' NOT NULL,
	"bull_job_id" text,
	"app_id" text NOT NULL,
	"app_name" text NOT NULL,
	"app_config_type" "app_config_type" NOT NULL,
	"contract_address" text NOT NULL,
	"model_or_domain" text NOT NULL,
	"app_metadata" jsonb,
	"verification_flags" jsonb,
	"status" "verification_task_status" DEFAULT 'pending' NOT NULL,
	"error_message" text,
	"s3_filename" text,
	"s3_key" text,
	"s3_bucket" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"started_at" timestamp,
	"finished_at" timestamp
);
--> statement-breakpoint
CREATE INDEX "verification_tasks_job_name_index" ON "verification_tasks" USING btree ("job_name");--> statement-breakpoint
CREATE INDEX "verification_tasks_status_index" ON "verification_tasks" USING btree ("status");--> statement-breakpoint
CREATE INDEX "verification_tasks_bull_job_id_index" ON "verification_tasks" USING btree ("bull_job_id");--> statement-breakpoint
CREATE INDEX "verification_tasks_created_at_index" ON "verification_tasks" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "verification_tasks_started_at_index" ON "verification_tasks" USING btree ("started_at");--> statement-breakpoint
CREATE INDEX "verification_tasks_finished_at_index" ON "verification_tasks" USING btree ("finished_at");--> statement-breakpoint
CREATE INDEX "verification_tasks_app_id_index" ON "verification_tasks" USING btree ("app_id");--> statement-breakpoint
CREATE INDEX "verification_tasks_app_name_index" ON "verification_tasks" USING btree ("app_name");--> statement-breakpoint
CREATE INDEX "verification_tasks_app_config_type_index" ON "verification_tasks" USING btree ("app_config_type");--> statement-breakpoint
CREATE INDEX "verification_tasks_contract_address_index" ON "verification_tasks" USING btree ("contract_address");--> statement-breakpoint
CREATE INDEX "verification_tasks_model_or_domain_index" ON "verification_tasks" USING btree ("model_or_domain");