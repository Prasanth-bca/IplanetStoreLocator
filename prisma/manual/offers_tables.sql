-- Offers feature: new tables only (store offers, bank offers, campaigns, import log).
-- Safe to run more than once. It deliberately does NOT touch any existing table.
--
-- Why this file exists instead of `prisma db push`: the live database's "user_sessions" table differs
-- slightly from prisma/schema.prisma (foreign key and timestamp column types), and `db push` would
-- alter that live table. Apply this file instead:
--
--   set -a; . ./.env.local; set +a
--   DATABASE_URL="$DATABASE_URL_UNPOOLED" npx prisma db execute --file prisma/manual/offers_tables.sql --schema prisma/schema.prisma
--
CREATE TABLE IF NOT EXISTS "offer_campaigns" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "label" TEXT NOT NULL DEFAULT '',
    "theme" TEXT NOT NULL DEFAULT 'None',
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "offer_campaigns_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "store_offers" (
    "id" TEXT NOT NULL,
    "offer_id" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "product_name" TEXT NOT NULL,
    "variant" TEXT,
    "storage" TEXT,
    "offer_type" TEXT NOT NULL,
    "trade_in" TEXT,
    "customer" TEXT NOT NULL,
    "discount_type" TEXT NOT NULL,
    "discount_value" DOUBLE PRECISION,
    "is_up_to" BOOLEAN,
    "offer_text" TEXT NOT NULL,
    "eligibility" TEXT,
    "combinable" BOOLEAN NOT NULL DEFAULT true,
    "valid_from" DATE,
    "valid_until" DATE,
    "terms" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Active',
    "source" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "store_offers_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "bank_offers" (
    "id" TEXT NOT NULL,
    "offer_id" TEXT NOT NULL,
    "bank" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "product_name" TEXT NOT NULL,
    "variant" TEXT,
    "match_type" TEXT NOT NULL,
    "match_text" TEXT NOT NULL,
    "card_type" TEXT,
    "offer_type" TEXT NOT NULL,
    "amount" INTEGER,
    "percent" DOUBLE PRECISION,
    "min_txn" INTEGER,
    "max_cashback" INTEGER,
    "emi_type" TEXT NOT NULL,
    "details" TEXT,
    "rv_from" INTEGER,
    "rv_to" INTEGER,
    "combinable" BOOLEAN NOT NULL DEFAULT true,
    "valid_from" DATE,
    "valid_until" DATE,
    "terms" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Active',
    "source" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "bank_offers_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "offer_imports" (
    "id" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "imported_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "imported_by_id" TEXT,
    "imported_by_name" TEXT,
    "store_count" INTEGER NOT NULL,
    "bank_count" INTEGER NOT NULL,
    "campaign_count" INTEGER NOT NULL,
    "warnings" TEXT,

    CONSTRAINT "offer_imports_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "store_offers_offer_id_key" ON "store_offers"("offer_id");

CREATE INDEX IF NOT EXISTS "store_offers_category_idx" ON "store_offers"("category");

CREATE INDEX IF NOT EXISTS "store_offers_product_name_idx" ON "store_offers"("product_name");

CREATE INDEX IF NOT EXISTS "bank_offers_category_idx" ON "bank_offers"("category");

CREATE UNIQUE INDEX IF NOT EXISTS "bank_offers_offer_id_bank_key" ON "bank_offers"("offer_id", "bank");

CREATE INDEX IF NOT EXISTS "offer_imports_imported_at_idx" ON "offer_imports"("imported_at");

-- Valid From is optional (blank = already started). Safe to run on tables created before this change.
ALTER TABLE "store_offers" ALTER COLUMN "valid_from" DROP NOT NULL;
ALTER TABLE "bank_offers" ALTER COLUMN "valid_from" DROP NOT NULL;
