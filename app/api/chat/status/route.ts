import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { getChatConfig } from '@/lib/chat/settings';

export const dynamic = 'force-dynamic';

/** Any signed-in person: is the assistant switched on (and has a key)? Decides whether the chat button shows. */
export async function GET(request: NextRequest) {
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;
  try {
    const cfg = await getChatConfig();
    return NextResponse.json({ enabled: cfg.enabled && !!cfg.apiKey, name: cfg.assistantName });
  } catch {
    return NextResponse.json({ enabled: false, name: 'Assistant' });
  }
}
