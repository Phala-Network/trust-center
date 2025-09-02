CREATE TYPE "public"."app_config_type" AS ENUM('redpill', 'phala_cloud');--> statement-breakpoint
CREATE TYPE "public"."verification_task_status" AS ENUM('pending', 'active', 'completed', 'failed');--> statement-breakpoint
CREATE TABLE "verification_tasks" (
	"id" text PRIMARY KEY NOT NULL,
	"jobName" text DEFAULT 'verification' NOT NULL,
	"bullJobId" text,
	"appId" text NOT NULL,
	"appName" text NOT NULL,
	"appConfigType" "app_config_type" NOT NULL,
	"contractAddress" text NOT NULL,
	"modelOrDomain" text NOT NULL,
	"appMetadata" jsonb,
	"verificationFlags" jsonb NOT NULL,
	"status" "verification_task_status" DEFAULT 'pending' NOT NULL,
	"errorMessage" text,
	"s3Filename" text,
	"s3Key" text,
	"s3Bucket" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"startedAt" timestamp,
	"finishedAt" timestamp
);
--> statement-breakpoint
CREATE INDEX "verification_tasks_jobName_index" ON "verification_tasks" USING btree ("jobName");--> statement-breakpoint
CREATE INDEX "verification_tasks_status_index" ON "verification_tasks" USING btree ("status");--> statement-breakpoint
CREATE INDEX "verification_tasks_bullJobId_index" ON "verification_tasks" USING btree ("bullJobId");--> statement-breakpoint
CREATE INDEX "verification_tasks_createdAt_index" ON "verification_tasks" USING btree ("createdAt");--> statement-breakpoint
CREATE INDEX "verification_tasks_startedAt_index" ON "verification_tasks" USING btree ("startedAt");--> statement-breakpoint
CREATE INDEX "verification_tasks_finishedAt_index" ON "verification_tasks" USING btree ("finishedAt");--> statement-breakpoint
CREATE INDEX "verification_tasks_appId_index" ON "verification_tasks" USING btree ("appId");--> statement-breakpoint
CREATE INDEX "verification_tasks_appName_index" ON "verification_tasks" USING btree ("appName");--> statement-breakpoint
CREATE INDEX "verification_tasks_appConfigType_index" ON "verification_tasks" USING btree ("appConfigType");--> statement-breakpoint
CREATE INDEX "verification_tasks_contractAddress_index" ON "verification_tasks" USING btree ("contractAddress");--> statement-breakpoint
CREATE INDEX "verification_tasks_modelOrDomain_index" ON "verification_tasks" USING btree ("modelOrDomain");