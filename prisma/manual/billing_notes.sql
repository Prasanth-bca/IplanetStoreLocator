-- Billing notes: customers billed on a different number from the one the rep spoke to. Safe to run more than once.
-- Why not `prisma db push`: the live user_sessions table differs from schema.prisma, so db push would alter it.
-- Run from the project folder:
--   set -a; . ./.env.local; set +a; DATABASE_URL="$DATABASE_URL_UNPOOLED" npx prisma db execute --file prisma/manual/billing_notes.sql --schema prisma/schema.prisma
CREATE TABLE IF NOT EXISTS "billing_notes" (
    "id" TEXT NOT NULL,
    "booking_date" DATE NOT NULL,
    "billed_phone" TEXT,
    "dialled_phone" TEXT,
    "customer_name" TEXT,
    "model" TEXT,
    "location" TEXT,
    "status" TEXT NOT NULL DEFAULT 'NOTED',
    "invoice" TEXT,
    "value" INTEGER,
    "remarks" TEXT,
    "agent_code" TEXT,
    "agent_name" TEXT NOT NULL,
    "created_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_by_name" TEXT,
    CONSTRAINT "billing_notes_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "billing_notes_booking_date_idx" ON "billing_notes"("booking_date");
CREATE INDEX IF NOT EXISTS "billing_notes_billed_phone_idx" ON "billing_notes"("billed_phone");
CREATE INDEX IF NOT EXISTS "billing_notes_dialled_phone_idx" ON "billing_notes"("dialled_phone");
CREATE INDEX IF NOT EXISTS "billing_notes_created_by_id_booking_date_idx" ON "billing_notes"("created_by_id", "booking_date");
DO $$ BEGIN
  ALTER TABLE "billing_notes" ADD CONSTRAINT "billing_notes_created_by_id_fkey"
    FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
