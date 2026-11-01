/** Chatbot settings: read and save (server only). The API key comes from the database (encrypted) or, failing that, GROQ_API_KEY. */

import { prisma } from '@/lib/prisma';
import { decryptSecret, encryptSecret } from './crypto';
import { clampNumber, cleanAssistantName, DEFAULT_ASSISTANT_NAME, DEFAULT_MODEL, DEFAULT_SYSTEM_PROMPT, LIMITS } from './defaults';

export interface ChatConfig {
  enabled: boolean;
  /** The usable key (never sent to a browser). Null if none is configured. */
  apiKey: string | null;
  keySource: 'saved' | 'env' | 'none';
  /** Last 4 characters of the key in use, for display. */
  keyHint: string | null;
  model: string;
  assistantName: string;
  /** What the admin typed; empty means "use the built-in prompt". */
  storedPrompt: string;
  /** What is actually sent to the model (includes the assistant's name). */
  systemPrompt: string;
  temperature: number;
  maxTokens: number;
  ratePerMinute: number;
  /** True when the chat_settings table has not been created yet. */
  tableMissing: boolean;
  updatedAt: Date | null;
  updatedByName: string | null;
}

const TTL_MS = 15_000;
let cache: { at: number; value: ChatConfig } | null = null;
export const forgetChatConfig = () => {
  cache = null;
};

const envKey = () => (process.env.GROQ_API_KEY || '').trim() || null;
/** With no saved settings row, the assistant can be switched on from the server environment alone. */
const envEnabled = () => (process.env.CHATBOT_ENABLED || '').trim().toLowerCase() === 'true';

export async function getChatConfig(): Promise<ChatConfig> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.value;

  type Row = NonNullable<Awaited<ReturnType<typeof prisma.chatSetting.findUnique>>>;
  let row: (Omit<Row, 'assistantName'> & { assistantName?: string }) | null = null;
  let tableMissing = false;
  try {
    row = await prisma.chatSetting.findUnique({ where: { id: 'default' } });
  } catch (e) {
    const code = (e as { code?: string })?.code;
    if (code === 'P2021') tableMissing = true; // the table does not exist yet
    else if (code === 'P2022') {
      // The assistant_name column has not been added yet (prisma/manual/chatbot_assistant_name.sql): everything else still works.
      row = await prisma.chatSetting.findUnique({
        where: { id: 'default' },
        select: { id: true, enabled: true, apiKeyEnc: true, apiKeyHint: true, model: true, systemPrompt: true, temperature: true, maxTokens: true, ratePerMinute: true, updatedAt: true, updatedByName: true },
      });
    } else throw e;
  }

  const saved = row?.apiKeyEnc ? decryptSecret(row.apiKeyEnc) : null;
  const apiKey = saved ?? envKey();
  const stored = row?.systemPrompt?.trim() ?? '';
  const assistantName = cleanAssistantName(row?.assistantName) ?? DEFAULT_ASSISTANT_NAME;
  const value: ChatConfig = {
    enabled: row ? row.enabled : envEnabled(),
    apiKey,
    keySource: saved ? 'saved' : envKey() ? 'env' : 'none',
    keyHint: apiKey ? apiKey.slice(-4) : null,
    model: row?.model || DEFAULT_MODEL,
    storedPrompt: stored,
    assistantName,
    systemPrompt: `${stored || DEFAULT_SYSTEM_PROMPT}\n\nYour name is "${assistantName}". If asked your name, say it. Do not claim to be a person.`,
    temperature: clampNumber(row?.temperature, LIMITS.temperature.min, LIMITS.temperature.max, LIMITS.defaultTemperature),
    maxTokens: Math.round(clampNumber(row?.maxTokens, LIMITS.maxTokens.min, LIMITS.maxTokens.max, LIMITS.defaultMaxTokens)),
    ratePerMinute: Math.round(clampNumber(row?.ratePerMinute, LIMITS.ratePerMinute.min, LIMITS.ratePerMinute.max, LIMITS.defaultRatePerMinute)),
    tableMissing,
    updatedAt: row?.updatedAt ?? null,
    updatedByName: row?.updatedByName ?? null,
  };
  cache = { at: Date.now(), value };
  return value;
}

export interface ChatConfigPatch {
  enabled?: boolean;
  apiKey?: string; // non-empty: replace the saved key
  clearKey?: boolean;
  model?: string;
  assistantName?: string;
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
  ratePerMinute?: number;
}

export async function saveChatConfig(patch: ChatConfigPatch, by: string): Promise<void> {
  const data: Record<string, unknown> = { updatedByName: by };
  if (patch.enabled !== undefined) data.enabled = patch.enabled;
  if (patch.model !== undefined) data.model = patch.model;
  if (patch.assistantName !== undefined) data.assistantName = patch.assistantName;
  if (patch.systemPrompt !== undefined) data.systemPrompt = patch.systemPrompt;
  if (patch.temperature !== undefined) data.temperature = patch.temperature;
  if (patch.maxTokens !== undefined) data.maxTokens = patch.maxTokens;
  if (patch.ratePerMinute !== undefined) data.ratePerMinute = patch.ratePerMinute;
  if (patch.apiKey) {
    data.apiKeyEnc = encryptSecret(patch.apiKey);
    data.apiKeyHint = patch.apiKey.slice(-4);
  } else if (patch.clearKey) {
    data.apiKeyEnc = null;
    data.apiKeyHint = null;
  }
  await prisma.chatSetting.upsert({ where: { id: 'default' }, create: { id: 'default', ...data }, update: data });
  forgetChatConfig();
}
