import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth';
import { getChatConfig } from '@/lib/chat/settings';
import { explainGroqError, groqChat } from '@/lib/chat/groq';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

/** Admin: send one tiny message to check the key and model work. Optional body { apiKey, model } tests values before saving. */
export async function POST(request: NextRequest) {
  const auth = await requireRole(request, 'ADMIN');
  if (!auth.ok) return auth.response;
  try {
    const body = await request.json().catch(() => ({}));
    const cfg = await getChatConfig();
    const typed = typeof body.apiKey === 'string' ? body.apiKey.trim() : '';
    const apiKey = typed || cfg.apiKey;
    const model = (typeof body.model === 'string' && body.model.trim()) || cfg.model;
    if (!apiKey) return NextResponse.json({ ok: false, error: 'Add a Groq API key first.' });
    if (!/^[A-Za-z0-9._\/:-]{2,80}$/.test(model)) return NextResponse.json({ ok: false, error: 'The model name has characters that aren’t allowed.' });

    const started = Date.now();
    const res = await groqChat({
      apiKey, model, system: 'You are a connection test.', messages: [{ role: 'user', content: 'Reply with the single word: OK' }],
      temperature: 0, maxTokens: 8, stream: false, signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) return NextResponse.json({ ok: false, error: explainGroqError(res.status), status: res.status });
    const json = (await res.json().catch(() => ({}))) as { choices?: { message?: { content?: string } }[] };
    return NextResponse.json({ ok: true, model, ms: Date.now() - started, reply: (json.choices?.[0]?.message?.content ?? '').trim().slice(0, 60) });
  } catch (error) {
    const timedOut = (error as Error)?.name === 'TimeoutError' || (error as Error)?.name === 'AbortError';
    return NextResponse.json({ ok: false, error: timedOut ? 'Groq did not answer in time.' : 'Could not reach Groq from the server.' });
  }
}
