-- Market Price & Offers tables. Safe to run more than once; creates new tables only.
-- Why not `prisma db push`: the live user_sessions table differs from schema.prisma, so db push would alter it.
-- Run from the project folder:
--   set -a; . ./.env.local; set +a; DATABASE_URL="$DATABASE_URL_UNPOOLED" npx prisma db execute --file prisma/manual/market_price.sql --schema prisma/schema.prisma
CREATE TABLE IF NOT EXISTS "market_settings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "sales_enabled" BOOLEAN NOT NULL DEFAULT true,
    "store_enabled" BOOLEAN NOT NULL DEFAULT false,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_by_name" TEXT,
    CONSTRAINT "market_settings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "market_prices" (
    "id" TEXT NOT NULL,
    "product_key" TEXT NOT NULL,
    "product_label" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "retailer_name" TEXT,
    "mrp" INTEGER,
    "selling_price" INTEGER NOT NULL,
    "availability" TEXT NOT NULL DEFAULT 'UNKNOWN',
    "source_url" TEXT NOT NULL,
    "source_kind" TEXT NOT NULL DEFAULT 'MANUAL',
    "source_name" TEXT,
    "entered_by_name" TEXT,
    "fetched_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "market_prices_pkey" PRIMARY KEY ("id")
);
-- NULLS NOT DISTINCT so one row per product+platform even when retailer_name is empty (needs Postgres 15+; Neon has it).
CREATE UNIQUE INDEX IF NOT EXISTS "market_prices_product_key_platform_retailer_name_key" ON "market_prices"("product_key", "platform", "retailer_name") NULLS NOT DISTINCT;
CREATE INDEX IF NOT EXISTS "market_prices_product_key_idx" ON "market_prices"("product_key");
CREATE INDEX IF NOT EXISTS "market_prices_category_idx" ON "market_prices"("category");

CREATE TABLE IF NOT EXISTS "market_offers" (
    "id" TEXT NOT NULL,
    "price_id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "bank" TEXT,
    "discount_amount" INTEGER,
    "discount_percent" DOUBLE PRECISION,
    "min_amount" INTEGER,
    "max_discount" INTEGER,
    "valid_from" TIMESTAMP(3),
    "valid_until" TIMESTAMP(3),
    "variants" TEXT,
    "terms" TEXT,
    "link" TEXT,
    CONSTRAINT "market_offers_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "market_offers_price_id_idx" ON "market_offers"("price_id");
DO $$ BEGIN
  ALTER TABLE "market_offers" ADD CONSTRAINT "market_offers_price_id_fkey"
    FOREIGN KEY ("price_id") REFERENCES "market_prices"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
