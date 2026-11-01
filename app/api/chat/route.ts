import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';
import { getChatConfig } from '@/lib/chat/settings';
import { allowRequest, cleanMessages } from '@/lib/chat/messages';
import { explainGroqError, groqChat } from '@/lib/chat/groq';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/**
 * Any signed-in person. Body: { messages: [{ role: "user" | "assistant", content }] }.
 * Streams the model's answer back as server-sent events in the OpenAI chunk format.
 * The Groq key and the system prompt stay on the server.
 */
export async function POST(request: NextRequest) {
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;

  try {
    const cfg = await getChatConfig();
    if (!cfg.enabled || !cfg.apiKey) return NextResponse.json({ error: 'The assistant is not switched on yet.' }, { status: 503 });

    const gate = allowRequest(auth.user.id, cfg.ratePerMinute);
    if (!gate.ok) {
      return NextResponse.json({ error: `You’re sending messages quickly. Please wait ${gate.retryAfterSec} seconds.` }, { status: 429, headers: { 'Retry-After': String(gate.retryAfterSec) } });
    }

    const body = await request.json().catch(() => null);
    const cleaned = cleanMessages(body?.messages);
    if (!cleaned.ok) return NextResponse.json({ error: cleaned.error }, { status: 400 });

    const upstream = await groqChat({
      apiKey: cfg.apiKey,
      model: cfg.model,
      system: cfg.systemPrompt,
      messages: cleaned.messages,
      temperature: cfg.temperature,
      maxTokens: cfg.maxTokens,
      stream: true,
      signal: AbortSignal.any([request.signal, AbortSignal.timeout(55_000)]),
    });

    if (!upstream.ok || !upstream.body) {
      // Log the status only: never the key, and never the person's message.
      console.error('Chat: Groq returned', upstream.status);
      return NextResponse.json({ error: explainGroqError(upstream.status) }, { status: upstream.status === 429 ? 429 : 502 });
    }

    return new Response(upstream.body, {
      headers: { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-store, no-transform', 'X-Accel-Buffering': 'no' },
    });
  } catch (error) {
    if ((error as Error)?.name === 'AbortError' || (error as Error)?.name === 'TimeoutError') {
      return NextResponse.json({ error: 'The assistant took too long. Please try again.' }, { status: 504 });
    }
    console.error('POST /api/chat error:', (error as Error)?.message);
    return NextResponse.json({ error: 'The assistant could not answer. Please try again.' }, { status: 500 });
  }
}
