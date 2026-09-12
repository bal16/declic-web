CREATE TYPE "photo_variant" AS ENUM('thumbnail', 'web', 'lightbox');--> statement-breakpoint
CREATE TYPE "post_status" AS ENUM('PROCESSING', 'PENDING', 'APPROVED', 'REJECTED', 'PUBLISHED', 'UNPUBLISHED', 'FAILED_PROCESSING');--> statement-breakpoint
CREATE TYPE "post_type" AS ENUM('SINGLE', 'SERIES');--> statement-breakpoint
CREATE TABLE "photo_derivatives" (
	"id" text PRIMARY KEY,
	"photo_item_id" text NOT NULL,
	"photo_variant" "photo_variant" NOT NULL,
	"s3_key" varchar(255) NOT NULL,
	"url" text NOT NULL,
	"width" integer NOT NULL,
	"height" integer NOT NULL,
	"size_bytes" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "photo_items" (
	"id" text PRIMARY KEY,
	"post_id" text NOT NULL,
	"item_order" integer NOT NULL,
	"original_s3_key" varchar(255) NOT NULL,
	"blurhash" varchar(255),
	"exif_metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "posts" (
	"id" text PRIMARY KEY,
	"exhibition_id" text NOT NULL,
	"photographer_id" text NOT NULL,
	"title" varchar(255) NOT NULL,
	"caption" text,
	"post_type" "post_type" NOT NULL,
	"post_status" "post_status" NOT NULL,
	"rejection_reason" text,
	"display_order" varchar(255),
	"likes_count" integer DEFAULT 0 NOT NULL,
	"comments_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"deleted_at" timestamp
);
--> statement-breakpoint
CREATE INDEX "photo_derivatives_photo_item_id_idx" ON "photo_derivatives" ("photo_item_id");--> statement-breakpoint
CREATE UNIQUE INDEX "photo_items_post_item_unique" ON "photo_items" ("post_id","item_order");--> statement-breakpoint
CREATE INDEX "photo_items_post_id_idx" ON "photo_items" ("post_id");--> statement-breakpoint
CREATE INDEX "posts_exhibition_id_idx" ON "posts" ("exhibition_id");--> statement-breakpoint
CREATE INDEX "posts_status_idx" ON "posts" ("post_status");--> statement-breakpoint
CREATE INDEX "posts_gallery_idx" ON "posts" ("exhibition_id","post_status");--> statement-breakpoint
CREATE INDEX "posts_photographer_id_idx" ON "posts" ("photographer_id");--> statement-breakpoint
CREATE INDEX "posts_created_at_idx" ON "posts" ("created_at");--> statement-breakpoint
CREATE INDEX "posts_display_order_idx" ON "posts" ("display_order");--> statement-breakpoint
CREATE INDEX "posts_type_idx" ON "posts" ("post_type");--> statement-breakpoint
ALTER TABLE "photo_derivatives" ADD CONSTRAINT "photo_derivatives_photo_item_id_photo_items_id_fkey" FOREIGN KEY ("photo_item_id") REFERENCES "photo_items"("id");--> statement-breakpoint
ALTER TABLE "photo_items" ADD CONSTRAINT "photo_items_post_id_posts_id_fkey" FOREIGN KEY ("post_id") REFERENCES "posts"("id");