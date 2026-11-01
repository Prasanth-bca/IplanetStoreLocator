/** Talks to Groq's OpenAI-compatible API (server only). The key is passed in; it is never logged or returned. */

import type { ChatMessage } from './messages';

const BASE = () => (process.env.GROQ_BASE_URL || 'https://api.groq.com/openai/v1').replace(/\/+$/, '');

export interface GroqCall {
  apiKey: string;
  model: string;
  system: string;
  messages: ChatMessage[];
  temperature: number;
  maxTokens: number;
  stream: boolean;
  signal?: AbortSignal;
}

/** A short, safe explanation for staff; never includes the key or Groq's raw body. */
export function explainGroqError(status: number): string {
  if (status === 401 || status === 403) return 'The assistant’s API key was not accepted. Ask an admin to check it.';
  if (status === 404 || status === 400) return 'The assistant’s model is not available. Ask an admin to pick another model.';
  if (status === 413) return 'That conversation is too long. Start a new chat.';
  if (status === 429) return 'The assistant is busy right now (free limit reached). Please try again in a minute.';
  if (status >= 500) return 'The assistant service is having trouble. Please try again shortly.';
  return 'The assistant could not answer. Please try again.';
}

export async function groqChat(c: GroqCall): Promise<Response> {
  return fetch(`${BASE()}/chat/completions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${c.apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: c.model,
      messages: [{ role: 'system', content: c.system }, ...c.messages],
      temperature: c.temperature,
      max_tokens: c.maxTokens,
      stream: c.stream,
    }),
    signal: c.signal,
    cache: 'no-store',
  });
}

export interface GroqModel {
  id: string;
  owner: string | null;
  context: number | null;
}

/** Models the key can use for chat (speech, audio and safety models are left out). */
export async function listChatModels(apiKey: string): Promise<{ ok: true; models: GroqModel[] } | { ok: false; status: number }> {
  const res = await fetch(`${BASE()}/models`, { headers: { Authorization: `Bearer ${apiKey}` }, cache: 'no-store', signal: AbortSignal.timeout(15000) });
  if (!res.ok) return { ok: false, status: res.status };
  const body = (await res.json().catch(() => ({}))) as { data?: { id: string; owned_by?: string; context_window?: number; active?: boolean }[] };
  const models = (body.data ?? [])
    .filter((m) => m.active !== false && !/whisper|tts|playai|guard|orpheus|embed|distil-whisper/i.test(m.id))
    .map((m) => ({ id: m.id, owner: m.owned_by ?? null, context: m.context_window ?? null }))
    .sort((a, b) => a.id.localeCompare(b.id));
  return { ok: true, models };
}
