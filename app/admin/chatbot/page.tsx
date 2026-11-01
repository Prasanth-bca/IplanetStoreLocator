'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, ArrowLeft, Bot, CheckCircle, Eye, EyeOff, Home, KeyRound, Loader2, Plug, RefreshCw, Save, Trash2 } from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';

interface Config {
  enabled: boolean;
  keySource: 'saved' | 'env' | 'none';
  keyHint: string | null;
  model: string;
  assistantName: string;
  nameMax: number;
  systemPrompt: string;
  defaultPrompt: string;
  temperature: number;
  maxTokens: number;
  ratePerMinute: number;
  tableMissing: boolean;
  updatedAt: string | null;
  updatedByName: string | null;
  suggestedModels: { id: string; note: string }[];
  limits: { temperature: { min: number; max: number }; maxTokens: { min: number; max: number }; ratePerMinute: { min: number; max: number }; maxSystemPromptChars: number };
}
interface LiveModel {
  id: string;
  owner: string | null;
  context: number | null;
}

const input =
  'w-full rounded-xl border border-gray-200 bg-white/80 px-3.5 py-2.5 text-sm text-gray-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30 dark:border-white/10 dark:bg-white/5 dark:text-white';
const card = 'space-y-4 rounded-3xl border border-gray-200/80 bg-white p-5 dark:border-white/10 dark:bg-pal-card-dark';

export default function ChatbotAdminPage() {
  const [cfg, setCfg] = useState<Config | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  // form state
  const [enabled, setEnabled] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [model, setModel] = useState('');
  const [assistantName, setAssistantName] = useState('Assistant');
  const [prompt, setPrompt] = useState('');
  const [temperature, setTemperature] = useState(0.6);
  const [maxTokens, setMaxTokens] = useState(800);
  const [rate, setRate] = useState(12);
  const [liveModels, setLiveModels] = useState<LiveModel[] | null>(null);
  // actions
  const [busy, setBusy] = useState<'save' | 'test' | 'models' | 'clear' | null>(null);
  const [toast, setToast] = useState<{ ok: boolean; text: string } | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [testResult, setTestResult] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/chatbot');
      const b = await res.json();
      if (!res.ok) throw new Error(b.error || 'Could not load the settings');
      setCfg(b);
      setEnabled(b.enabled);
      setModel(b.model);
      setAssistantName(b.assistantName);
      setPrompt(b.systemPrompt);
      setTemperature(b.temperature);
      setMaxTokens(b.maxTokens);
      setRate(b.ratePerMinute);
      setLoadError(null);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Could not load the settings');
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(t);
  }, [toast]);

  const save = async (extra: Record<string, unknown> = {}, quiet = false) => {
    setBusy(extra.clearKey ? 'clear' : 'save');
    setErrors([]);
    try {
      const body = { enabled, model, assistantName, systemPrompt: prompt, temperature, maxTokens, ratePerMinute: rate, ...(apiKey.trim() ? { apiKey: apiKey.trim() } : {}), ...extra };
      const res = await fetch('/api/admin/chatbot', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const b = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErrors(b.errors ?? [b.error || 'The settings could not be saved.']);
        return false;
      }
      setApiKey('');
      setShowKey(false);
      await load();
      if (!quiet) setToast({ ok: true, text: 'Saved. The chat window uses these settings right away.' });
      return true;
    } catch {
      setErrors(['Something went wrong. Please try again.']);
      return false;
    } finally {
      setBusy(null);
    }
  };

  const test = async () => {
    setBusy('test');
    setTestResult(null);
    try {
      const res = await fetch('/api/admin/chatbot/test', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ apiKey: apiKey.trim() || undefined, model }) });
      const b = await res.json();
      setTestResult(b.ok ? { ok: true, text: `Working. ${b.model} answered in ${b.ms} ms${b.reply ? ` (“${b.reply}”)` : ''}.` } : { ok: false, text: b.error || 'The test failed.' });
    } catch {
      setTestResult({ ok: false, text: 'The test could not be run.' });
    } finally {
      setBusy(null);
    }
  };

  const loadModels = async () => {
    setBusy('models');
    try {
      const res = await fetch('/api/admin/chatbot/models');
      const b = await res.json();
      if (!res.ok) throw new Error(b.error || 'Could not load models');
      setLiveModels(b.models);
      setToast({ ok: true, text: `${b.models.length} models available to your key.` });
    } catch (e) {
      setToast({ ok: false, text: e instanceof Error ? e.message : 'Could not load models' });
    } finally {
      setBusy(null);
    }
  };

  const removeKey = async () => {
    if (!window.confirm('Remove the saved API key? The assistant will switch off until a new key is added.')) return;
    setEnabled(false);
    if (await save({ clearKey: true, enabled: false }, true)) setToast({ ok: true, text: 'The saved key was removed.' });
  };

  const hasKey = cfg ? cfg.keySource !== 'none' || !!apiKey.trim() : false;
  const keyText = !cfg ? '' : cfg.keySource === 'saved' ? `Saved key ending in ${cfg.keyHint}` : cfg.keySource === 'env' ? `Using the server’s GROQ_API_KEY (ends in ${cfg.keyHint})` : 'No key yet';

  return (
    <div className="min-h-screen bg-gray-50 pb-16 dark:bg-pal-page-dark">
      <header className="sticky top-0 z-40 border-b border-gray-200 bg-white/90 px-4 py-3.5 backdrop-blur dark:border-white/10 dark:bg-pal-bar-dark/90 sm:px-6 lg:px-8 2xl:px-12">
        <div className="flex w-full items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <Link href="/admin" aria-label="Back to admin" className="rounded-xl bg-gray-100 p-2 text-gray-600 dark:bg-zinc-800 dark:text-gray-300"><ArrowLeft className="h-4 w-4" /></Link>
            <h1 className="flex items-center gap-2 truncate text-lg font-extrabold text-gray-950 dark:text-white"><Bot className="h-5 w-5 shrink-0 text-blue-600" /> Assistant (chatbot)</h1>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/" aria-label="Home" title="Home" className="rounded-xl bg-gray-100 p-2 text-gray-600 hover:text-blue-600 dark:bg-zinc-800 dark:text-gray-300"><Home className="h-4 w-4" /></Link>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-4xl space-y-5 px-4 py-6 sm:px-6">
        {loadError && <p role="alert" className="flex items-start gap-2 text-sm text-red-600"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {loadError}</p>}
        {!cfg && !loadError && <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-gray-400" /></div>}

        {cfg && (
          <>
            {cfg.tableMissing && (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
                <p className="flex items-start gap-2"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /><span><strong>The settings table doesn’t exist yet</strong>, so nothing can be saved. See <code className="rounded bg-white/70 px-1 dark:bg-black/30">prisma/manual/chatbot_tables.sql</code> for the one command that creates it. Until then the assistant can run from the server’s environment alone: set <code className="rounded bg-white/70 px-1 dark:bg-black/30">GROQ_API_KEY</code> and <code className="rounded bg-white/70 px-1 dark:bg-black/30">CHATBOT_ENABLED=true</code>.</span></p>
              </div>
            )}

            {/* on / off */}
            <section className={card}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-bold text-gray-900 dark:text-white">Assistant</h2>
                  <p className="text-xs text-gray-500 dark:text-gray-400">A small chat button for every signed-in person, for general chat and doubts, powered by Groq.</p>
                </div>
                <label className="inline-flex cursor-pointer items-center gap-3">
                  <span className={`text-sm font-bold ${enabled ? 'text-emerald-600' : 'text-gray-500'}`}>{enabled ? 'On' : 'Off'}</span>
                  <button type="button" role="switch" aria-checked={enabled} aria-label="Assistant on or off" onClick={() => setEnabled((v) => !v)} className={`relative h-7 w-12 rounded-full transition ${enabled ? 'bg-emerald-500' : 'bg-gray-300 dark:bg-zinc-700'}`}>
                    <span className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-all ${enabled ? 'left-[22px]' : 'left-0.5'}`} />
                  </button>
                </label>
              </div>
              <label className="block">
                <span className="text-xs font-bold text-gray-700 dark:text-gray-300">Assistant name</span>
                <input value={assistantName} onChange={(e) => setAssistantName(e.target.value)} maxLength={cfg.nameMax} placeholder="Assistant" className={`${input} mt-1 max-w-sm`} />
                <span className="mt-1 block text-[11px] text-gray-500 dark:text-gray-400">Shown in the chat window and button, and used by the assistant when someone asks its name. For example “Planet Buddy”.</span>
              </label>
              {enabled && !hasKey && <p className="text-xs text-amber-700 dark:text-amber-300">Add an API key below before saving, otherwise it can’t be switched on.</p>}
            </section>

            {/* key */}
            <section className={card}>
              <h2 className="flex items-center gap-2 text-base font-bold text-gray-900 dark:text-white"><KeyRound className="h-4 w-4 text-blue-600" /> Groq API key</h2>
              <p className="text-sm text-gray-600 dark:text-gray-300">{keyText}. The key is stored encrypted on the server and is never shown again or sent to anyone’s browser.</p>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input
                    type={showKey ? 'text' : 'password'}
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder={cfg.keySource === 'none' ? 'Paste your key (starts with gsk_)' : 'Paste a new key to replace the current one'}
                    autoComplete="off"
                    spellCheck={false}
                    aria-label="Groq API key"
                    className={`${input} pr-11 font-mono`}
                  />
                  <button type="button" onClick={() => setShowKey((v) => !v)} aria-label={showKey ? 'Hide key' : 'Show key'} className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 dark:hover:bg-zinc-800">
                    {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {cfg.keySource === 'saved' && (
                  <button type="button" onClick={removeKey} disabled={busy !== null} className="inline-flex items-center gap-1.5 rounded-xl border border-red-200 px-3 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50 dark:border-red-900/50 dark:hover:bg-red-950/30"><Trash2 className="h-4 w-4" /> Remove</button>
                )}
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Free keys: <a className="font-semibold text-blue-600 underline" href="https://console.groq.com/keys" target="_blank" rel="noopener noreferrer">console.groq.com/keys</a>. Free keys have daily limits, so the message limit below protects it.</p>
            </section>

            {/* model */}
            <section className={card}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-base font-bold text-gray-900 dark:text-white">Model</h2>
                <button type="button" onClick={loadModels} disabled={busy !== null || cfg.keySource === 'none'} title={cfg.keySource === 'none' ? 'Save a key first' : 'Ask Groq which models your key can use'} className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-white/10 dark:text-gray-200 dark:hover:bg-white/5">
                  {busy === 'models' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />} Load from Groq
                </button>
              </div>
              <label className="block">
                <span className="text-xs font-bold text-gray-700 dark:text-gray-300">Model name</span>
                <input value={model} onChange={(e) => setModel(e.target.value)} list="chat-models" spellCheck={false} className={`${input} mt-1 font-mono`} />
                <datalist id="chat-models">
                  {(liveModels ?? cfg.suggestedModels).map((m) => <option key={m.id} value={m.id} />)}
                </datalist>
              </label>
              <div className="flex flex-wrap gap-2">
                {(liveModels ? liveModels.slice(0, 12).map((m) => ({ id: m.id, note: m.context ? `${Math.round(m.context / 1000)}k context` : (m.owner ?? '') })) : cfg.suggestedModels).map((m) => (
                  <button key={m.id} type="button" onClick={() => setModel(m.id)} className={`rounded-xl border px-3 py-1.5 text-left text-xs transition ${model === m.id ? 'border-blue-500 bg-blue-50 text-blue-800 dark:bg-blue-950/40 dark:text-blue-200' : 'border-gray-200 text-gray-700 hover:border-blue-300 dark:border-white/10 dark:text-gray-300'}`}>
                    <span className="block font-mono font-semibold">{m.id}</span>
                    {m.note && <span className="block text-[10px] text-gray-500 dark:text-gray-400">{m.note}</span>}
                  </button>
                ))}
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400">Groq changes its free models from time to time. If chat stops working with “model not available”, use “Load from Groq” and pick one from the list.</p>
            </section>

            {/* behaviour */}
            <section className={card}>
              <h2 className="text-base font-bold text-gray-900 dark:text-white">Behaviour</h2>
              <label className="block">
                <span className="text-xs font-bold text-gray-700 dark:text-gray-300">Instructions for the assistant (optional)</span>
                <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={7} maxLength={cfg.limits.maxSystemPromptChars} placeholder="Leave empty to use the built-in instructions" className={`${input} mt-1`} />
                <span className="mt-1 flex flex-wrap items-center justify-between gap-2 text-[11px] text-gray-500 dark:text-gray-400">
                  <span>{prompt.length}/{cfg.limits.maxSystemPromptChars}. Empty uses the built-in instructions, which tell it not to invent stock, prices or offers.</span>
                  <span className="inline-flex gap-3">
                    <button type="button" onClick={() => setPrompt(cfg.defaultPrompt)} className="font-semibold text-blue-600 hover:underline">Fill with the built-in text</button>
                    <button type="button" onClick={() => setPrompt('')} className="font-semibold text-blue-600 hover:underline">Use the built-in</button>
                  </span>
                </span>
              </label>
              <div className="grid gap-4 sm:grid-cols-3">
                <label className="block">
                  <span className="text-xs font-bold text-gray-700 dark:text-gray-300">Creativity: {temperature.toFixed(1)}</span>
                  <input type="range" min={cfg.limits.temperature.min} max={cfg.limits.temperature.max} step={0.1} value={temperature} onChange={(e) => setTemperature(Number(e.target.value))} className="mt-2 w-full accent-blue-600" />
                  <span className="text-[11px] text-gray-500">Lower = steadier, higher = more varied</span>
                </label>
                <label className="block">
                  <span className="text-xs font-bold text-gray-700 dark:text-gray-300">Longest answer (tokens)</span>
                  <input type="number" min={cfg.limits.maxTokens.min} max={cfg.limits.maxTokens.max} value={maxTokens} onChange={(e) => setMaxTokens(Number(e.target.value))} className={`${input} mt-1`} />
                  <span className="text-[11px] text-gray-500">About ¾ of a word each</span>
                </label>
                <label className="block">
                  <span className="text-xs font-bold text-gray-700 dark:text-gray-300">Messages per person per minute</span>
                  <input type="number" min={cfg.limits.ratePerMinute.min} max={cfg.limits.ratePerMinute.max} value={rate} onChange={(e) => setRate(Number(e.target.value))} className={`${input} mt-1`} />
                  <span className="text-[11px] text-gray-500">Protects the free key</span>
                </label>
              </div>
            </section>

            {/* actions */}
            <section className={card}>
              {errors.length > 0 && (
                <ul role="alert" className="space-y-1 rounded-xl bg-red-50 px-3.5 py-2.5 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-300">
                  {errors.map((e, i) => <li key={i}>• {e}</li>)}
                </ul>
              )}
              {testResult && (
                <p role="status" className={`flex items-start gap-2 rounded-xl px-3.5 py-2.5 text-sm font-semibold ${testResult.ok ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-200' : 'bg-red-50 text-red-800 dark:bg-red-950/30 dark:text-red-200'}`}>
                  {testResult.ok ? <CheckCircle className="mt-0.5 h-4 w-4 shrink-0" /> : <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />} {testResult.text}
                </p>
              )}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs text-gray-500 dark:text-gray-400">{cfg.updatedAt ? `Last saved ${new Date(cfg.updatedAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: true })} IST${cfg.updatedByName ? ` by ${cfg.updatedByName}` : ''}.` : 'Not saved yet.'}</p>
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={test} disabled={busy !== null || !hasKey} className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50 dark:border-white/10 dark:text-gray-200 dark:hover:bg-white/5">
                    {busy === 'test' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plug className="h-4 w-4" />} Test connection
                  </button>
                  <button type="button" onClick={() => save()} disabled={busy !== null} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-60">
                    {busy === 'save' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save settings
                  </button>
                </div>
              </div>
              <p className="text-[11px] text-gray-400">“Test connection” sends one tiny message with the key and model currently typed above (even if not saved yet).</p>
            </section>
          </>
        )}
      </main>

      {toast && (
        <div role="status" className={`fixed right-4 top-20 z-[60] flex max-w-sm items-start gap-2.5 rounded-2xl px-4 py-3 text-sm font-semibold shadow-xl ${toast.ok ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'}`}>
          {toast.ok ? <CheckCircle className="mt-0.5 h-4 w-4 shrink-0" /> : <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />}
          <span>{toast.text}</span>
        </div>
      )}
    </div>
  );
}
