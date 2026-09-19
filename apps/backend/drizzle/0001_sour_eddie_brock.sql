ALTER TABLE "devices" ADD COLUMN "capture_interval_seconds" integer DEFAULT 60 NOT NULL;--> statement-breakpoint
ALTER TABLE "devices" ADD COLUMN "target_type" text DEFAULT 'anaquel' NOT NULL;--> statement-breakpoint
ALTER TABLE "devices" ADD COLUMN "target_label" text;--> statement-breakpoint
ALTER TABLE "scans" ADD COLUMN "subject_visible" boolean DEFAULT true NOT NULL;