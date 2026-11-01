'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { AlertTriangle, Loader2, RotateCcw, Send, Square, X } from 'lucide-react';
import { AssistantAvatar } from '@/components/AssistantAvatar';
import { useCurrentUser } from '@/lib/useCurrentUser';

interface Msg {
  role: 'user' | 'assistant';
  content: string;
  /** True for a reply that could not be completed; shown with a warning and not sent back to the model. */
  error?: boolean;
}

const STORAGE_KEY = 'iplanet-chat-v1';
const SUGGESTIONS = ['Explain the difference between iPhone 17 and 17 Pro for a customer', 'Write a polite WhatsApp follow-up for a customer', 'What is 18% of ₹89,900?'];

/** **bold** and `code` only; everything else is shown as plain text (so nothing the model returns can inject markup). */
function inline(text: string): React.ReactNode[] {
  return text.split(/(\*\*[^*\n]+\*\*|`[^`\n]+`)/g).map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) return <strong key={i}>{part.slice(2, -2)}</strong>;
    if (part.startsWith('`') && part.endsWith('`') && part.length > 2) return <code key={i} className="rounded bg-black/10 px-1 py-0.5 font-mono text-[12px] dark:bg-white/15">{part.slice(1, -1)}</code>;
    return part;
  });
}

function Bubble({ m }: { m: Msg }) {
  if (m.role === 'user') {
    return <div className="ml-auto max-w-[85%] whitespace-pre-wrap break-words rounded-2xl rounded-br-md bg-blue-600 px-3.5 py-2 text-sm text-white shadow-sm">{m.content}</div>;
  }
  return (
    <div className={`mr-auto max-w-[92%] whitespace-pre-wrap break-words rounded-2xl rounded-bl-md px-3.5 py-2 text-sm shadow-sm ${m.error ? 'border border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200' : 'bg-gray-100 text-gray-900 dark:bg-zinc-800 dark:text-gray-100'}`}>
      {m.error && <AlertTriangle className="mr-1.5 inline h-3.5 w-3.5 -translate-y-px" />}
      {inline(m.content)}
    </div>
  );
}

/** Small floating chat for any signed-in person. Shown only when an admin has switched the assistant on. */
export function ChatWidget() {
  const { user } = useCurrentUser();
  const pathname = usePathname();
  const [available, setAvailable] = useState(false);
  const [name, setName] = useState('Assistant');
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Is the assistant switched on? Asked once per page load, and only for signed-in people.
  useEffect(() => {
    if (!user) {
      setAvailable(false);
      return;
    }
    let live = true;
    fetch('/api/chat/status')
      .then((r) => (r.ok ? r.json() : { enabled: false }))
      .then((b) => {
        if (!live) return;
        setAvailable(!!b.enabled);
        if (typeof b.name === 'string' && b.name) setName(b.name);
      })
      .catch(() => live && setAvailable(false));
    return () => {
      live = false;
    };
  }, [user]);

  // Keep the conversation for this tab only; it is cleared when the tab closes or the person signs out.
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(STORAGE_KEY);
      if (saved) setMessages(JSON.parse(saved));
    } catch {
      /* storage blocked: start fresh */
    }
  }, []);
  useEffect(() => {
    if (busy) return;
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-40)));
    } catch {
      /* ignore */
    }
  }, [messages, busy]);
  useEffect(() => {
    if (!user) {
      try {
        sessionStorage.removeItem(STORAGE_KEY);
      } catch {
        /* ignore */
      }
    }
  }, [user]);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, open]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', esc);
    return () => window.removeEventListener('keydown', esc);
  }, [open]);

  const stop = useCallback(() => abortRef.current?.abort(), []);

  const send = useCallback(
    async (text: string) => {
      const content = text.trim();
      if (!content || busy) return;
      const history: Msg[] = [...messages.filter((m) => !m.error), { role: 'user', content }];
      setMessages([...messages, { role: 'user', content }, { role: 'assistant', content: '' }]);
      setInput('');
      setBusy(true);
      const ctl = new AbortController();
      abortRef.current = ctl;

      const fail = (text: string) =>
        setMessages((prev) => {
          const next = prev.slice();
          const last = next[next.length - 1];
          if (last?.role === 'assistant' && !last.content) next[next.length - 1] = { role: 'assistant', content: text, error: true };
          else next.push({ role: 'assistant', content: text, error: true });
          return next;
        });

      try {
        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages: history.map(({ role, content }) => ({ role, content })) }),
          signal: ctl.signal,
        });
        if (!res.ok || !res.body) {
          const b = await res.json().catch(() => ({}));
          fail(b.error || 'The assistant could not answer. Please try again.');
          return;
        }
        const reader = res.body.getReader();
        const dec = new TextDecoder();
        let buf = '';
        let got = false;
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += dec.decode(value, { stream: true });
          const lines = buf.split('\n');
          buf = lines.pop() ?? '';
          for (const line of lines) {
            const t = line.trim();
            if (!t.startsWith('data:')) continue;
            const data = t.slice(5).trim();
            if (data === '[DONE]') continue;
            try {
              const piece: string | undefined = JSON.parse(data)?.choices?.[0]?.delta?.content;
              if (piece) {
                got = true;
                setMessages((prev) => {
                  const next = prev.slice();
                  const last = next[next.length - 1];
                  if (last?.role === 'assistant') next[next.length - 1] = { ...last, content: last.content + piece };
                  return next;
                });
              }
            } catch {
              /* a partial or non-JSON line: skip it */
            }
          }
        }
        if (!got) fail('The assistant sent an empty reply. Please try again.');
      } catch (e) {
        if ((e as Error)?.name === 'AbortError') {
          // Stopped by the person: keep what has arrived; drop an empty bubble.
          setMessages((prev) => (prev.length && prev[prev.length - 1].role === 'assistant' && !prev[prev.length - 1].content ? prev.slice(0, -1) : prev));
        } else {
          fail('Connection lost. Please check your internet and try again.');
        }
      } finally {
        setBusy(false);
        abortRef.current = null;
      }
    },
    [busy, messages]
  );

  const newChat = () => {
    stop();
    setMessages([]);
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
    inputRef.current?.focus();
  };

  if (!user || !available || pathname?.startsWith('/login')) return null;

  const last = messages[messages.length - 1];
  const waiting = busy && last?.role === 'assistant' && !last.content;

  return (
    <>
      {open && (
        <section
          role="dialog"
          aria-label={`${name} chat`}
          className="chat-panel fixed bottom-20 left-3 right-3 z-[70] flex h-[min(70vh,560px)] flex-col overflow-hidden rounded-3xl border border-gray-200 bg-white/95 shadow-2xl backdrop-blur-xl dark:border-white/10 dark:bg-pal-card-dark/95 sm:left-auto sm:right-5 sm:w-[390px]"
        >
          <header className="flex items-center justify-between gap-2 border-b border-gray-100 px-4 py-3 dark:border-white/10">
            <div className="flex min-w-0 items-center gap-2.5">
              <span className="shrink-0 overflow-hidden rounded-full ring-2 ring-white/70 dark:ring-white/20"><AssistantAvatar size={38} waving={false} /></span>
              <div className="min-w-0">
                <h2 className="truncate text-sm font-extrabold text-gray-900 dark:text-white">{name}</h2>
                <p className="truncate text-[11px] text-gray-500 dark:text-gray-400">Ask anything · general chat and doubts</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button type="button" onClick={newChat} disabled={messages.length === 0 && !busy} aria-label="New chat" title="New chat" className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 disabled:opacity-30 dark:hover:bg-zinc-800"><RotateCcw className="h-4 w-4" /></button>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close chat" title="Close" className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 dark:hover:bg-zinc-800"><X className="h-4 w-4" /></button>
            </div>
          </header>

          <div ref={listRef} className="flex-1 space-y-2.5 overflow-y-auto px-4 py-3" aria-live="polite">
            {messages.length === 0 ? (
              <div className="space-y-3 pt-2">
                <AssistantAvatar size={72} className="mx-auto drop-shadow-md" />
                <p className="text-center text-sm text-gray-600 dark:text-gray-300">Hi {user.name.split(' ')[0]}! I’m {name}. Ask me a doubt, or just chat.</p>
                <div className="flex flex-col gap-1.5">
                  {SUGGESTIONS.map((s) => (
                    <button key={s} type="button" onClick={() => send(s)} className="rounded-xl border border-gray-200 bg-white/70 px-3 py-2 text-left text-xs font-medium text-gray-700 transition hover:border-blue-300 hover:bg-blue-50 dark:border-white/10 dark:bg-white/5 dark:text-gray-200 dark:hover:bg-blue-950/30">{s}</button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((m, i) => (m.role === 'assistant' && !m.content && !m.error ? null : <Bubble key={i} m={m} />))
            )}
            {waiting && (
              <div className="mr-auto inline-flex items-center gap-1 rounded-2xl rounded-bl-md bg-gray-100 px-3.5 py-3 dark:bg-zinc-800" aria-label="The assistant is typing">
                <span className="chat-dot" /><span className="chat-dot" style={{ animationDelay: '0.15s' }} /><span className="chat-dot" style={{ animationDelay: '0.3s' }} />
              </div>
            )}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
            className="border-t border-gray-100 px-3 pb-2.5 pt-2.5 dark:border-white/10"
          >
            <div className="flex items-end gap-2">
              <textarea
                ref={inputRef}
                value={input}
                rows={1}
                maxLength={4000}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                    e.preventDefault();
                    send(input);
                  }
                }}
                placeholder="Type a message…"
                aria-label="Message"
                className="max-h-28 min-h-[40px] flex-1 resize-none rounded-xl border border-gray-200 bg-white/80 px-3 py-2 text-sm text-gray-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30 dark:border-white/10 dark:bg-white/5 dark:text-white"
              />
              {busy ? (
                <button type="button" onClick={stop} aria-label="Stop" title="Stop" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gray-200 text-gray-700 dark:bg-zinc-700 dark:text-gray-100"><Square className="h-4 w-4" /></button>
              ) : (
                <button type="submit" disabled={!input.trim()} aria-label="Send" title="Send" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white transition hover:bg-blue-700 disabled:opacity-40">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}</button>
              )}
            </div>
            <p className="mt-1.5 text-center text-[10px] text-gray-400">AI can make mistakes. It can’t see live stock, prices or offers: use the app screens for those.</p>
          </form>
        </section>
      )}

      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? `Close ${name}` : `Open ${name}`}
        aria-expanded={open}
        title={name}
        className="chat-fab fixed bottom-4 right-4 z-[70] flex h-16 w-16 items-center justify-center rounded-full shadow-xl ring-4 ring-white/80 transition hover:scale-105 dark:ring-white/20 sm:bottom-5 sm:right-5"
      >
        {open ? (
          <span className="flex h-full w-full items-center justify-center rounded-full bg-blue-600 text-white"><X className="h-6 w-6" /></span>
        ) : (
          <>
            <span className="chat-fab-avatar block overflow-hidden rounded-full"><AssistantAvatar size={64} /></span>
            <span aria-hidden className="absolute -right-0.5 bottom-0.5 h-3.5 w-3.5 rounded-full border-2 border-white bg-emerald-500" />
          </>
        )}
      </button>
    </>
  );
}
