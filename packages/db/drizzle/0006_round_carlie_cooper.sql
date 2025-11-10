ALTER TABLE "profiles" ALTER COLUMN "entity_id" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "profiles" ALTER COLUMN "display_name" DROP NOT NULL;