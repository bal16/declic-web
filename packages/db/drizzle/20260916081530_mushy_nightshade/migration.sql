CREATE TYPE "exhibition_phase" AS ENUM('PRE_EVENT', 'LIVE', 'ARCHIVED', 'DRAFT');--> statement-breakpoint
CREATE TYPE "job_log_status" AS ENUM('running', 'completed', 'failed_retryable', 'failed_terminal');--> statement-breakpoint
CREATE TABLE "exhibitions" (
	"id" text PRIMARY KEY,
	"title" varchar(255) NOT NULL,
	"slug" varchar(255) NOT NULL,
	"description" text,
	"phase" "exhibition_phase" DEFAULT 'DRAFT'::"exhibition_phase" NOT NULL,
	"poster_s3_key" varchar(255),
	"location" varchar(255),
	"start_date" timestamp NOT NULL,
	"end_date" timestamp NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "job_logs" (
	"id" text PRIMARY KEY,
	"job_id" varchar(255) NOT NULL,
	"post_id" text NOT NULL,
	"photo_item_id" text NOT NULL,
	"attempt" integer NOT NULL,
	"max_attempts" integer NOT NULL,
	"status" "job_log_status" NOT NULL,
	"error_name" varchar(255),
	"error_message" text,
	"error_stack" text,
	"duration_ms" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "exhibitions_start_date_idx" ON "exhibitions" ("start_date");--> statement-breakpoint
CREATE INDEX "exhibitions_end_date_idx" ON "exhibitions" ("end_date");--> statement-breakpoint
CREATE INDEX "exhibitions_phase_idx" ON "exhibitions" ("phase");--> statement-breakpoint
CREATE INDEX "exhibitions_slug_idx" ON "exhibitions" ("slug");--> statement-breakpoint
CREATE INDEX "exhibitions_created_by_idx" ON "exhibitions" ("created_by");--> statement-breakpoint
CREATE INDEX "job_logs_job_id_idx" ON "job_logs" ("job_id");--> statement-breakpoint
CREATE INDEX "job_logs_post_id_idx" ON "job_logs" ("post_id");--> statement-breakpoint
CREATE INDEX "job_logs_photo_item_id_idx" ON "job_logs" ("photo_item_id");--> statement-breakpoint
CREATE INDEX "job_logs_status_idx" ON "job_logs" ("status");--> statement-breakpoint
CREATE INDEX "job_logs_created_at_idx" ON "job_logs" ("created_at");--> statement-breakpoint
ALTER TABLE "job_logs" ADD CONSTRAINT "job_logs_post_id_posts_id_fkey" FOREIGN KEY ("post_id") REFERENCES "posts"("id");--> statement-breakpoint
ALTER TABLE "job_logs" ADD CONSTRAINT "job_logs_photo_item_id_photo_items_id_fkey" FOREIGN KEY ("photo_item_id") REFERENCES "photo_items"("id");--> statement-breakpoint
INSERT INTO "exhibitions" ("id", "title", "slug", "phase", "start_date", "end_date", "created_by", "created_at", "updated_at") VALUES ('it-ex', 'Legacy Exhibition', 'legacy', 'LIVE', '2026-01-01', '2027-01-01', 'system', NOW(), NOW()) ON CONFLICT DO NOTHING;--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_exhibition_id_exhibitions_id_fkey" FOREIGN KEY ("exhibition_id") REFERENCES "exhibitions"("id");