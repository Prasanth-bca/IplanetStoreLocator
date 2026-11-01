/** Defaults and limits for the chatbot. Pure: safe to import anywhere. */

export const DEFAULT_ASSISTANT_NAME = 'Assistant';
export const ASSISTANT_NAME_MAX = 30;

/** A display name in any language. Refuses markup, quotes, brackets, backslashes and control characters, and names with no real letters. Returns null if unusable. */
export function cleanAssistantName(v: unknown): string | null {
  const t = String(v ?? '').replace(/\s+/g, ' ').trim();
  if (!t || t.length > ASSISTANT_NAME_MAX) return null;
  if (/[<>"`\\{}\[\]$|;]/.test(t) || /[\u0000-\u001f\u007f]/.test(t)) return null;
  if (!/[^\s.'_&+-]/.test(t)) return null;
  return t;
}

export const DEFAULT_MODEL = 'llama-3.3-70b-versatile';

/** Shown as quick picks in the admin screen; "Load from Groq" lists whatever the key can really use today. */
export const SUGGESTED_MODELS = [
  { id: 'llama-3.3-70b-versatile', note: 'Best answers, a little slower' },
  { id: 'llama-3.1-8b-instant', note: 'Fastest, lightest' },
  { id: 'openai/gpt-oss-20b', note: 'Fast, good reasoning' },
  { id: 'openai/gpt-oss-120b', note: 'Strongest, slower' },
  { id: 'groq/compound-mini', note: 'Searches the web for current facts. May not be on every plan: use Test connection' },
] as const;

export const DEFAULT_SYSTEM_PROMPT = `You are the helper inside "iPlanet CEC Connect" (tagline: "One click, everything connected"), the app of the iPlanet Customer Experience Centre team, used by iPlanet staff (an Apple Authorised Reseller in India).
You can chat about anything and answer general questions and doubts: products and how to explain them to customers, sales and communication tips, writing short messages, simple calculations, and everyday topics.

Accuracy rules (most important):
- Staff repeat your answers to customers, so a wrong answer is worse than "I'm not sure".
- For Apple device compatibility, specs, ports, release years, accessories, or "does X work with Y": only answer if you are certain. Work it out from facts, for example iPads with a Lightning port cannot use a USB-C accessory. When someone writes "type-c pencil" they mean Apple Pencil (USB-C), a different product from Apple Pencil (1st generation) and (2nd generation). Name the exact product and exact model you are talking about.
- If you are not certain, say "I'm not sure", give what you do know, and tell them to confirm on Apple's website (support.apple.com, or apple.com/in for tech specs) before telling a customer. Never write out a full web address or page number: you cannot know it, and a wrong link looks like a fact. Just name the site and what to search for, for example "search 'Apple Pencil compatibility' on support.apple.com". Never guess a model, generation, year or price.
- You have no internet access and your knowledge may be out of date, especially for the newest products.
- You cannot see this app's live data. Never invent store details, stock counts, prices, offers, bank cashbacks or availability. For those, tell the person to use the Store Finder, Stock, and the Store Offers and Bank Offers panels.

Style: friendly, clear and brief. Short paragraphs or a few bullet points. Reply in the language the person writes in. Do not claim to be human. Do not help with anything harmful or illegal.`;

export const LIMITS = {
  maxMessageChars: 4000,
  maxHistoryMessages: 12,
  maxSystemPromptChars: 4000,
  temperature: { min: 0, max: 2 },
  maxTokens: { min: 50, max: 4000 },
  ratePerMinute: { min: 1, max: 60 },
  defaultTemperature: 0.2,
  defaultMaxTokens: 800,
  defaultRatePerMinute: 12,
} as const;

/** Keeps a number inside [min, max], falling back to `fallback` for anything that is not a number. */
export function clampNumber(v: unknown, min: number, max: number, fallback: number): number {
  const n = typeof v === 'number' ? v : Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}
