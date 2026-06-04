-- Remove consignment infrastructure

-- Drop FK from product_items to owners
ALTER TABLE "product_items" DROP CONSTRAINT IF EXISTS "product_items_owner_id_owners_id_fk";--> statement-breakpoint

-- Drop consignment columns from product_items
ALTER TABLE "product_items" DROP COLUMN IF EXISTS "owner_type";--> statement-breakpoint
ALTER TABLE "product_items" DROP COLUMN IF EXISTS "owner_id";--> statement-breakpoint

-- Rename base_cost to unit_cost on product_items
ALTER TABLE "product_items" RENAME COLUMN "base_cost" TO "unit_cost";--> statement-breakpoint

-- Drop commission_amount from sale_details
ALTER TABLE "sale_details" DROP COLUMN IF EXISTS "commission_amount";--> statement-breakpoint

-- Drop owners table
DROP TABLE IF EXISTS "owners";--> statement-breakpoint

-- Create shareholders table
CREATE TABLE "shareholders" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "full_name" text NOT NULL,
  "email" text,
  "ownership_pct" numeric(5, 2) NOT NULL,
  "is_active" boolean NOT NULL DEFAULT true,
  "created_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint

-- Create shareholder_distributions table
CREATE TABLE "shareholder_distributions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "period_year" integer NOT NULL,
  "total_net_profit" numeric(14, 2) NOT NULL,
  "notes" text,
  "status" text NOT NULL DEFAULT 'pending',
  "declared_at" timestamp DEFAULT now() NOT NULL,
  "paid_at" timestamp,
  CONSTRAINT "uq_distribution_year" UNIQUE ("period_year")
);--> statement-breakpoint

-- Create shareholder_distribution_items table
CREATE TABLE "shareholder_distribution_items" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "distribution_id" uuid NOT NULL,
  "shareholder_id" uuid NOT NULL,
  "ownership_pct" numeric(5, 2) NOT NULL,
  "amount" numeric(14, 2) NOT NULL,
  "paid_at" timestamp,
  "cash_movement_id" uuid
);--> statement-breakpoint

-- Add FK constraints for distribution tables
ALTER TABLE "shareholder_distribution_items" ADD CONSTRAINT "shareholder_distribution_items_distribution_id_fk"
  FOREIGN KEY ("distribution_id") REFERENCES "public"."shareholder_distributions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint

ALTER TABLE "shareholder_distribution_items" ADD CONSTRAINT "shareholder_distribution_items_shareholder_id_fk"
  FOREIGN KEY ("shareholder_id") REFERENCES "public"."shareholders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint

-- Seed initial shareholders
INSERT INTO "shareholders" ("full_name", "email", "ownership_pct", "is_active")
VALUES
  ('Juan Diego Torres', NULL, 50.00, true),
  ('Frankly Estiven Chindicue Muñoz', NULL, 50.00, true)
ON CONFLICT DO NOTHING;
