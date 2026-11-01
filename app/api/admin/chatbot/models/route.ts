import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth';
import { getChatConfig } from '@/lib/chat/settings';
import { explainGroqError, listChatModels } from '@/lib/chat/groq';

export const dynamic = 'force-dynamic';

/** Admin: the chat models the saved key can use today, straight from Groq (so the list is never out of date). */
export async function GET(request: NextRequest) {
  const auth = await requireRole(request, 'ADMIN');
  if (!auth.ok) return auth.response;
  try {
    const cfg = await getChatConfig();
    if (!cfg.apiKey) return NextResponse.json({ error: 'Save a Groq API key first.' }, { status: 400 });
    const r = await listChatModels(cfg.apiKey);
    if (!r.ok) return NextResponse.json({ error: explainGroqError(r.status) }, { status: 502 });
    return NextResponse.json({ models: r.models });
  } catch {
    return NextResponse.json({ error: 'Could not reach Groq from the server.' }, { status: 502 });
  }
}
