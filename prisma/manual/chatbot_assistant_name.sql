-- Lets the admin rename the chat assistant. Safe to run more than once. Run from the project folder:
--   set -a; . ./.env.local; set +a; DATABASE_URL="$DATABASE_URL_UNPOOLED" npx prisma db execute --file prisma/manual/chatbot_assistant_name.sql --schema prisma/schema.prisma
ALTER TABLE "chat_settings" ADD COLUMN IF NOT EXISTS "assistant_name" TEXT NOT NULL DEFAULT 'Assistant';
