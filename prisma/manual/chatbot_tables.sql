-- Chatbot settings (one row). Safe to run more than once.
-- Why not `prisma db push`: the live user_sessions table differs from schema.prisma, so db push would alter it.
-- Run from the project folder:
--   set -a; . ./.env.local; set +a; DATABASE_URL="$DATABASE_URL_UNPOOLED" npx prisma db execute --file prisma/manual/chatbot_tables.sql --schema prisma/schema.prisma
CREATE TABLE IF NOT EXISTS "chat_settings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "api_key_enc" TEXT,
    "api_key_hint" TEXT,
    "model" TEXT NOT NULL DEFAULT 'llama-3.3-70b-versatile',
    "system_prompt" TEXT NOT NULL DEFAULT '',
    "temperature" DOUBLE PRECISION NOT NULL DEFAULT 0.6,
    "max_tokens" INTEGER NOT NULL DEFAULT 800,
    "rate_per_minute" INTEGER NOT NULL DEFAULT 12,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_by_name" TEXT,
    CONSTRAINT "chat_settings_pkey" PRIMARY KEY ("id")
);
