-- Store-wise lead distribution: store logins, assigned leads, follow-up history and reminders.
-- Only creates NEW tables (and foreign keys to users); no existing table is changed. Safe to run more than once.
-- Why not `prisma db push`: the live user_sessions table differs from schema.prisma, so db push would alter it.
-- Run from the project folder:
--   set -a; . ./.env.local; set +a; DATABASE_URL="$DATABASE_URL_UNPOOLED" npx prisma db execute --file prisma/manual/store_leads.sql --schema prisma/schema.prisma

CREATE TABLE IF NOT EXISTS "store_accounts" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "pos_code" TEXT NOT NULL,
    "store_name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "store_accounts_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "store_accounts_user_id_key" ON "store_accounts"("user_id");
CREATE UNIQUE INDEX IF NOT EXISTS "store_accounts_pos_code_key" ON "store_accounts"("pos_code");

CREATE TABLE IF NOT EXISTS "store_leads" (
    "id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "customer_name" TEXT NOT NULL,
    "customer_mobile" TEXT NOT NULL,
    "requirement" TEXT NOT NULL,
    "remarks" TEXT,
    "pos_code" TEXT NOT NULL,
    "store_name" TEXT NOT NULL,
    "shared_by_id" TEXT,
    "shared_by_name" TEXT NOT NULL,
    "lead_id" TEXT,
    "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "interest" TEXT,
    "visit_intention" TEXT,
    "visit_updated_at" TIMESTAMP(3),
    "conversion" TEXT,
    "first_response_at" TIMESTAMP(3),
    "last_activity_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closed_at" TIMESTAMP(3),
    "billed_name" TEXT,
    "billed_mobile" TEXT,
    CONSTRAINT "store_leads_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "store_leads_client_id_key" ON "store_leads"("client_id");
CREATE INDEX IF NOT EXISTS "store_leads_pos_code_assigned_at_idx" ON "store_leads"("pos_code", "assigned_at");
CREATE INDEX IF NOT EXISTS "store_leads_shared_by_id_assigned_at_idx" ON "store_leads"("shared_by_id", "assigned_at");
CREATE INDEX IF NOT EXISTS "store_leads_first_response_at_assigned_at_idx" ON "store_leads"("first_response_at", "assigned_at");
CREATE INDEX IF NOT EXISTS "store_leads_conversion_idx" ON "store_leads"("conversion");

CREATE TABLE IF NOT EXISTS "lead_activities" (
    "id" TEXT NOT NULL,
    "store_lead_id" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "by_user_id" TEXT,
    "by_name" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "note" TEXT,
    "interest" TEXT,
    "visit_intention" TEXT,
    "conversion" TEXT,
    CONSTRAINT "lead_activities_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "lead_activities_store_lead_id_at_idx" ON "lead_activities"("store_lead_id", "at");

CREATE TABLE IF NOT EXISTS "lead_notifications" (
    "id" TEXT NOT NULL,
    "store_lead_id" TEXT NOT NULL,
    "pos_code" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "due_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "read_at" TIMESTAMP(3),
    "read_by_name" TEXT,
    CONSTRAINT "lead_notifications_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "lead_notifications_store_lead_id_kind_key" ON "lead_notifications"("store_lead_id", "kind");
CREATE INDEX IF NOT EXISTS "lead_notifications_pos_code_read_at_idx" ON "lead_notifications"("pos_code", "read_at");
CREATE INDEX IF NOT EXISTS "lead_notifications_created_at_idx" ON "lead_notifications"("created_at");

DO $$ BEGIN ALTER TABLE "store_accounts" ADD CONSTRAINT "store_accounts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "store_leads" ADD CONSTRAINT "store_leads_shared_by_id_fkey" FOREIGN KEY ("shared_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "lead_activities" ADD CONSTRAINT "lead_activities_store_lead_id_fkey" FOREIGN KEY ("store_lead_id") REFERENCES "store_leads"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "lead_notifications" ADD CONSTRAINT "lead_notifications_store_lead_id_fkey" FOREIGN KEY ("store_lead_id") REFERENCES "store_leads"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
