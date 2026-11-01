import { NextRequest, NextResponse } from 'next/server';
import { requireRole } from '@/lib/auth';
import { getChatConfig, saveChatConfig, ChatConfigPatch } from '@/lib/chat/settings';
import { ASSISTANT_NAME_MAX, cleanAssistantName, clampNumber, DEFAULT_SYSTEM_PROMPT, LIMITS, SUGGESTED_MODELS } from '@/lib/chat/defaults';

export const dynamic = 'force-dynamic';

/** Admin: the chatbot's settings. The API key itself is never returned, only whether one is set and its last 4 characters. */
export async function GET(request: NextRequest) {
  const auth = await requireRole(request, 'ADMIN');
  if (!auth.ok) return auth.response;
  try {
    const c = await getChatConfig();
    return NextResponse.json({
      enabled: c.enabled,
      keySource: c.keySource,
      keyHint: c.keyHint,
      model: c.model,
      assistantName: c.assistantName,
      nameMax: ASSISTANT_NAME_MAX,
      systemPrompt: c.storedPrompt,
      defaultPrompt: DEFAULT_SYSTEM_PROMPT,
      temperature: c.temperature,
      maxTokens: c.maxTokens,
      ratePerMinute: c.ratePerMinute,
      tableMissing: c.tableMissing,
      updatedAt: c.updatedAt?.toISOString() ?? null,
      updatedByName: c.updatedByName,
      suggestedModels: SUGGESTED_MODELS,
      limits: LIMITS,
    });
  } catch (error) {
    console.error('GET /api/admin/chatbot error:', (error as Error)?.message);
    return NextResponse.json({ error: 'Chatbot settings could not be loaded.' }, { status: 500 });
  }
}

/** Admin: change any of the settings. `apiKey` replaces the saved key; `clearKey: true` removes it. */
export async function PUT(request: NextRequest) {
  const auth = await requireRole(request, 'ADMIN');
  if (!auth.ok) return auth.response;
  try {
    const body = await request.json().catch(() => ({}));
    const patch: ChatConfigPatch = {};
    const errors: string[] = [];

    if (body.enabled !== undefined) {
      if (typeof body.enabled !== 'boolean') errors.push('Enabled must be on or off.');
      else patch.enabled = body.enabled;
    }
    if (typeof body.apiKey === 'string' && body.apiKey.trim()) {
      const k = body.apiKey.trim();
      if (!/^gsk_[A-Za-z0-9_-]{20,200}$/.test(k)) errors.push('That doesn’t look like a Groq API key. Groq keys start with “gsk_”.');
      else patch.apiKey = k;
    }
    if (body.clearKey === true) patch.clearKey = true;
    if (body.model !== undefined) {
      const m = String(body.model).trim();
      if (!/^[A-Za-z0-9._\/:-]{2,80}$/.test(m)) errors.push('The model name has characters that aren’t allowed.');
      else patch.model = m;
    }
    if (body.assistantName !== undefined) {
      const n = cleanAssistantName(body.assistantName);
      if (!n) errors.push(`The name must be 1 to ${ASSISTANT_NAME_MAX} characters: letters, numbers and spaces (and . ' _ & + -).`);
      else patch.assistantName = n;
    }
    if (body.systemPrompt !== undefined) {
      const p = String(body.systemPrompt).trim();
      if (p.length > LIMITS.maxSystemPromptChars) errors.push(`The instructions are too long (limit ${LIMITS.maxSystemPromptChars} characters).`);
      else patch.systemPrompt = p;
    }
    if (body.temperature !== undefined) {
      const n = Number(body.temperature);
      if (!Number.isFinite(n) || n < LIMITS.temperature.min || n > LIMITS.temperature.max) errors.push(`Creativity must be between ${LIMITS.temperature.min} and ${LIMITS.temperature.max}.`);
      else patch.temperature = n;
    }
    if (body.maxTokens !== undefined) {
      const n = Number(body.maxTokens);
      if (!Number.isFinite(n) || n < LIMITS.maxTokens.min || n > LIMITS.maxTokens.max) errors.push(`Answer length must be between ${LIMITS.maxTokens.min} and ${LIMITS.maxTokens.max}.`);
      else patch.maxTokens = Math.round(n);
    }
    if (body.ratePerMinute !== undefined) {
      const n = Number(body.ratePerMinute);
      if (!Number.isFinite(n) || n < LIMITS.ratePerMinute.min || n > LIMITS.ratePerMinute.max) errors.push(`Messages per minute must be between ${LIMITS.ratePerMinute.min} and ${LIMITS.ratePerMinute.max}.`);
      else patch.ratePerMinute = Math.round(clampNumber(n, 1, 60, 12));
    }
    if (errors.length) return NextResponse.json({ errors }, { status: 400 });
    if (Object.keys(patch).length === 0) return NextResponse.json({ errors: ['Nothing to save.'] }, { status: 400 });

    // Switching on needs a key (saved now, or already saved, or from the environment).
    const current = await getChatConfig();
    if (patch.enabled === true && !patch.apiKey && !current.apiKey) {
      return NextResponse.json({ errors: ['Add a Groq API key before switching the assistant on.'] }, { status: 400 });
    }

    await saveChatConfig(patch, auth.user.name);
    return NextResponse.json({ success: true });
  } catch (error) {
    if ((error as { code?: string })?.code === 'P2022') {
      return NextResponse.json({ errors: ['The assistant name needs one more database column. See prisma/manual/chatbot_assistant_name.sql.'] }, { status: 500 });
    }
    if ((error as { code?: string })?.code === 'P2021') {
      return NextResponse.json({ errors: ['The chatbot settings table doesn’t exist yet. See prisma/manual/chatbot_tables.sql.'] }, { status: 500 });
    }
    console.error('PUT /api/admin/chatbot error:', (error as Error)?.message);
    return NextResponse.json({ errors: ['The settings could not be saved.'] }, { status: 500 });
  }
}
