/** Cleans the conversation the browser sends before it goes to the model. Pure. */

import { LIMITS } from './defaults';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export type Cleaned = { ok: true; messages: ChatMessage[] } | { ok: false; error: string };

/**
 * Keeps only user/assistant turns (never a "system" message from the browser), trims and length-limits each,
 * keeps the most recent few, and requires the last one to be from the user.
 */
export function cleanMessages(input: unknown): Cleaned {
  if (!Array.isArray(input) || input.length === 0) return { ok: false, error: 'Type a message first.' };
  const last = input[input.length - 1] as { content?: unknown } | null;
  if (last && typeof last.content === 'string' && last.content.trim().length > LIMITS.maxMessageChars) {
    return { ok: false, error: `That message is too long (limit ${LIMITS.maxMessageChars} characters).` };
  }
  const out: ChatMessage[] = [];
  for (const m of input) {
    if (!m || typeof m !== 'object') continue;
    const role = (m as { role?: unknown }).role;
    const content = (m as { content?: unknown }).content;
    if ((role !== 'user' && role !== 'assistant') || typeof content !== 'string') continue;
    const text = content.trim();
    if (!text) continue;
    out.push({ role, content: text.slice(0, LIMITS.maxMessageChars) });
  }
  const recent = out.slice(-LIMITS.maxHistoryMessages);
  while (recent.length && recent[0].role !== 'user') recent.shift(); // a conversation starts with the person
  if (recent.length === 0 || recent[recent.length - 1].role !== 'user') return { ok: false, error: 'Type a message first.' };
  return { ok: true, messages: recent };
}

/** Sliding one-minute limiter, per person. Per server instance (good enough to stop a runaway loop or abuse of a free key). */
const hits = new Map<string, number[]>();
export function allowRequest(key: string, perMinute: number, now = Date.now()): { ok: true } | { ok: false; retryAfterSec: number } {
  const recent = (hits.get(key) ?? []).filter((t) => now - t < 60_000);
  if (recent.length >= perMinute) {
    hits.set(key, recent);
    return { ok: false, retryAfterSec: Math.max(1, Math.ceil((60_000 - (now - recent[0])) / 1000)) };
  }
  recent.push(now);
  hits.set(key, recent);
  if (hits.size > 5000) Array.from(hits.entries()).forEach(([k, v]) => v.every((t) => now - t >= 60_000) && hits.delete(k));
  return { ok: true };
}
