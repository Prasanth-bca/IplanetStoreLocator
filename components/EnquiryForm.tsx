'use client';

import React, { useEffect, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle, Copy, ExternalLink, Send, X } from 'lucide-react';
import {
  buildEnquiryMessage,
  EnquiryErrors,
  EnquiryField,
  pasteShortcutLabel,
  validateEnquiry,
  WHATSAPP_DESKTOP_URL,
  WHATSAPP_TARGET_KEY,
  WHATSAPP_WEB_URL,
  WhatsAppTarget,
} from '@/lib/enquiry';
import { copyFailureMessage, copyToClipboard, CopyResult } from '@/lib/clipboard';

interface EnquiryFormProps {
  storeName: string;
  posCode: string;
  /** Product to prefill. Changing `requestKey` re-applies it, even if the text is the same. */
  product: string;
  requestKey: number;
  onClose: () => void;
}

type Outcome =
  | { kind: 'copied' }
  | { kind: 'failed'; reason: Extract<CopyResult, { ok: false }>['reason'] }
  | null;

const field =
  'w-full px-3 py-2 text-sm rounded-xl border bg-white dark:bg-zinc-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/40';
const fieldOk = 'border-gray-200 dark:border-zinc-700';
const fieldBad = 'border-red-400 dark:border-red-500';

/**
 * "Pass to Store" enquiry: validates the customer details, copies a formatted message to the
 * clipboard and opens WhatsApp Web so the CEC can pick a group and paste. Nothing is sent
 * automatically.
 */
export const EnquiryForm: React.FC<EnquiryFormProps> = ({ storeName, posCode, product: initialProduct, requestKey, onClose }) => {
  const [customerName, setCustomerName] = useState('');
  const [customerMobile, setCustomerMobile] = useState('');
  const [product, setProduct] = useState(initialProduct);
  const [remarks, setRemarks] = useState('');
  const [errors, setErrors] = useState<EnquiryErrors>({});
  const [outcome, setOutcome] = useState<Outcome>(null);
  const [message, setMessage] = useState('');
  const [popupBlocked, setPopupBlocked] = useState(false);
  const [shortcut, setShortcut] = useState('Ctrl + V');
  const [target, setTarget] = useState<WhatsAppTarget>('web');
  const [leadStatus, setLeadStatus] = useState<'idle' | 'saving' | 'saved' | 'duplicate' | 'error'>('idle');

  const formRef = useRef<HTMLFormElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const mobileRef = useRef<HTMLInputElement>(null);
  const productRef = useRef<HTMLInputElement>(null);
  const manualRef = useRef<HTMLTextAreaElement>(null);
  // Identifies this lead for history. It changes whenever the enquiry content changes, so
  // clicking Send twice on the same details counts once, while a different enquiry counts anew.
  const leadIdRef = useRef('');
  useEffect(() => {
    leadIdRef.current =
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
    setLeadStatus('idle');
  }, [customerName, customerMobile, product, remarks]);

  // Device-specific paste hint; computed after mount so server and client markup match.
  useEffect(() => {
    setShortcut(pasteShortcutLabel(navigator.userAgent, navigator.platform, navigator.maxTouchPoints));
    // Remember which WhatsApp the CEC uses; storage can be unavailable, so this is best-effort.
    try {
      const saved = window.localStorage.getItem(WHATSAPP_TARGET_KEY);
      if (saved === 'web' || saved === 'desktop') setTarget(saved);
    } catch {
      /* storage unavailable */
    }
  }, []);

  const chooseTarget = (t: WhatsAppTarget) => {
    setTarget(t);
    try {
      window.localStorage.setItem(WHATSAPP_TARGET_KEY, t);
    } catch {
      /* storage unavailable */
    }
  };

  // A new product was picked from the list: apply it and bring the form into view.
  useEffect(() => {
    setProduct(initialProduct);
    setErrors(e => ({ ...e, product: undefined }));
    setOutcome(null);
    formRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    nameRef.current?.focus({ preventScroll: true });
  }, [initialProduct, requestKey]);

  // Once copying has failed, select the message so Ctrl + C works immediately.
  useEffect(() => {
    if (outcome?.kind === 'failed') manualRef.current?.select();
  }, [outcome]);

  const input = { customerName, customerMobile, storeName, posCode, product, remarks };

  const clearError = (f: EnquiryField) => setErrors(e => (e[f] ? { ...e, [f]: undefined } : e));

  /**
   * IMPORTANT: this handler must stay synchronous up to the clipboard call and window.open.
   * Both have to run inside the user's click so browsers allow them (pop-up blockers, clipboard
   * permission). The copy is started first, while this page still has focus, because opening a
   * new tab moves focus away.
   */
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const { valid, errors: found } = validateEnquiry(input);
    setErrors(found);
    if (!valid) {
      if (found.customerName) nameRef.current?.focus();
      else if (found.customerMobile) mobileRef.current?.focus();
      else if (found.product) productRef.current?.focus();
      return;
    }

    const text = buildEnquiryMessage(input);
    setMessage(text);
    setOutcome(null);

    const copying = copyToClipboard(text);
    if (target === 'desktop') {
      // A protocol link clicked inside this handler, so it still counts as the user's click.
      // Nothing can confirm the app opened; the copy result and the note below cover that case.
      const link = document.createElement('a');
      link.href = WHATSAPP_DESKTOP_URL;
      link.rel = 'noopener';
      link.click();
      setPopupBlocked(false);
    } else {
      const win = window.open(WHATSAPP_WEB_URL, '_blank');
      if (win) {
        try {
          win.opener = null; // the new tab doesn't need a handle back to this page
        } catch {
          /* ignore */
        }
      }
      setPopupBlocked(!win);
    }

    // Only report success once the browser confirms the copy.
    copying.then(result => setOutcome(result.ok ? { kind: 'copied' } : { kind: 'failed', reason: result.reason }));

    // After the copy and the WhatsApp tab are underway, add the lead to history.
    saveLead();
  };

  const saveLead = () => {
    setLeadStatus('saving');
    fetch('/api/leads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      keepalive: true,
      body: JSON.stringify({
        clientId: leadIdRef.current,
        customerName,
        customerMobile,
        posCode,
        product,
        remarks,
        channel: target,
      }),
    })
      .then(async res => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || 'Failed');
        setLeadStatus(data.duplicate ? 'duplicate' : 'saved');
      })
      .catch(() => setLeadStatus('error'));
  };

  const copyAgain = () => {
    copyToClipboard(message).then(result => setOutcome(result.ok ? { kind: 'copied' } : { kind: 'failed', reason: result.reason }));
  };

  const errorText = (f: EnquiryField) =>
    errors[f] ? (
      <p id={`enq-${f}-err`} className="mt-1 text-xs text-red-600 dark:text-red-400" role="alert">
        {errors[f]}
      </p>
    ) : null;

  const describe = (f: EnquiryField) => (errors[f] ? { 'aria-invalid': true, 'aria-describedby': `enq-${f}-err` } : {});

  return (
    <form
      ref={formRef}
      onSubmit={handleSubmit}
      noValidate
      className="mx-4 mt-3 mb-1 rounded-2xl border border-blue-200 dark:border-blue-900/60 bg-white dark:bg-[#1A1740] overflow-hidden"
      aria-label="Pass enquiry to store"
    >
      <div className="flex items-center justify-between gap-3 px-4 py-2.5 bg-blue-50/70 dark:bg-blue-950/30 border-b border-blue-100 dark:border-blue-900/50">
        <h5 className="text-sm font-extrabold text-gray-950 dark:text-white">Pass to Store</h5>
        <button type="button" onClick={onClose} aria-label="Close enquiry form" className="p-1 -mr-1 rounded-lg hover:bg-white/70 dark:hover:bg-zinc-800 text-gray-500">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="p-4 grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="text-xs font-semibold text-gray-600 dark:text-gray-300">Customer name *</span>
          <input
            ref={nameRef}
            value={customerName}
            onChange={e => {
              setCustomerName(e.target.value);
              clearError('customerName');
            }}
            autoComplete="name"
            maxLength={80}
            className={`${field} mt-1 ${errors.customerName ? fieldBad : fieldOk}`}
            {...describe('customerName')}
          />
          {errorText('customerName')}
        </label>

        <label className="block">
          <span className="text-xs font-semibold text-gray-600 dark:text-gray-300">Customer mobile *</span>
          <input
            ref={mobileRef}
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            value={customerMobile}
            onChange={e => {
              setCustomerMobile(e.target.value);
              clearError('customerMobile');
            }}
            placeholder="98765 43210"
            maxLength={20}
            className={`${field} mt-1 ${errors.customerMobile ? fieldBad : fieldOk}`}
            {...describe('customerMobile')}
          />
          {errorText('customerMobile')}
        </label>

        <label className="block">
          <span className="text-xs font-semibold text-gray-600 dark:text-gray-300">Preferred store</span>
          <input value={storeName} readOnly tabIndex={-1} className={`${field} mt-1 ${fieldOk} bg-gray-50 dark:bg-zinc-800/60 text-gray-600 dark:text-gray-300`} />
          {errorText('storeName')}
        </label>

        <label className="block">
          <span className="text-xs font-semibold text-gray-600 dark:text-gray-300">POS code</span>
          <input value={posCode} readOnly tabIndex={-1} className={`${field} mt-1 ${fieldOk} bg-gray-50 dark:bg-zinc-800/60 text-gray-600 dark:text-gray-300 font-mono`} />
        </label>

        <label className="block sm:col-span-2">
          <span className="text-xs font-semibold text-gray-600 dark:text-gray-300">Product / model *</span>
          <input
            ref={productRef}
            value={product}
            onChange={e => {
              setProduct(e.target.value);
              clearError('product');
            }}
            placeholder="e.g. iPhone 16 – 128GB Black"
            maxLength={120}
            className={`${field} mt-1 ${errors.product ? fieldBad : fieldOk}`}
            {...describe('product')}
          />
          {errorText('product')}
        </label>

        <label className="block sm:col-span-2">
          <span className="text-xs font-semibold text-gray-600 dark:text-gray-300">
            Remarks <span className="font-normal text-gray-400">(optional)</span>
          </span>
          <textarea
            value={remarks}
            onChange={e => setRemarks(e.target.value)}
            rows={2}
            maxLength={500}
            placeholder="Preferred colour, visit time, exchange, etc."
            className={`${field} mt-1 ${fieldOk} resize-y`}
          />
        </label>
      </div>

      <div className="px-4 pb-4 space-y-3">
        <div className="flex flex-wrap items-center gap-2" role="radiogroup" aria-label="Open WhatsApp in">
          <span className="text-xs font-semibold text-gray-600 dark:text-gray-300 mr-1">Open in</span>
          {(
            [
              { key: 'web', label: 'WhatsApp Web' },
              { key: 'desktop', label: 'WhatsApp app (Windows / Mac)' },
            ] as const
          ).map(opt => (
            <button
              key={opt.key}
              type="button"
              role="radio"
              aria-checked={target === opt.key}
              onClick={() => chooseTarget(opt.key)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition ${
                target === opt.key
                  ? 'bg-emerald-600 border-emerald-600 text-white'
                  : 'bg-white dark:bg-zinc-900 border-gray-200 dark:border-zinc-700 text-gray-600 dark:text-gray-300 hover:border-emerald-400'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <button
          type="submit"
          className="inline-flex items-center justify-center gap-2 w-full sm:w-auto px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold transition"
        >
          <Send className="w-4 h-4" />
          Send to WhatsApp
        </button>

        {outcome?.kind === 'copied' && (
          <div role="status" className="flex items-start gap-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900/60 px-3 py-2.5 text-sm text-emerald-800 dark:text-emerald-200">
            <CheckCircle className="w-4 h-4 mt-0.5 shrink-0" />
            <div className="space-y-1">
              <p>Message copied! Open WhatsApp, select the required group, press {shortcut}, and send.</p>
              {target === 'desktop' && (
                <p className="text-xs text-emerald-700/90 dark:text-emerald-300/90">
                  Nothing opened? Install WhatsApp for Windows, or choose WhatsApp Web above.
                </p>
              )}
            </div>
          </div>
        )}

        {outcome?.kind === 'failed' && (
          <div role="alert" className="rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/60 px-3 py-2.5 text-sm text-amber-900 dark:text-amber-200 space-y-2">
            <p className="flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>
                <strong>The message was not copied.</strong> {copyFailureMessage(outcome.reason)} Select the text below, copy it
                (Ctrl + C), then paste it into WhatsApp.
              </span>
            </p>
            <textarea
              ref={manualRef}
              readOnly
              value={message}
              rows={9}
              onFocus={e => e.currentTarget.select()}
              aria-label="Enquiry message to copy manually"
              className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-amber-200 dark:border-amber-900/60 bg-white dark:bg-zinc-900 text-gray-900 dark:text-gray-100"
            />
            <button type="button" onClick={copyAgain} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold">
              <Copy className="w-3.5 h-3.5" /> Try copying again
            </button>
          </div>
        )}

        {leadStatus === 'saved' && (
          <p role="status" className="text-xs text-gray-500 dark:text-gray-400">
            Lead recorded in history.
          </p>
        )}
        {leadStatus === 'duplicate' && (
          <p role="status" className="text-xs text-gray-500 dark:text-gray-400">
            This lead is already in history, so it isn’t counted twice.
          </p>
        )}
        {leadStatus === 'error' && (
          <p role="alert" className="text-sm text-amber-800 dark:text-amber-200">
            The message was prepared, but this lead couldn’t be saved to history.{' '}
            <button type="button" onClick={saveLead} className="font-semibold underline">
              Try saving again
            </button>
          </p>
        )}

        {popupBlocked && (
          <p role="alert" className="text-sm text-amber-800 dark:text-amber-200">
            Your browser blocked the new tab.{' '}
            <a href={WHATSAPP_WEB_URL} target="_blank" rel="noopener noreferrer" className="font-semibold underline">
              Open WhatsApp Web
            </a>{' '}
            yourself, or allow pop-ups for this site.
          </p>
        )}

        {outcome && !popupBlocked && (
          <a href={WHATSAPP_WEB_URL} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 dark:text-blue-400">
            <ExternalLink className="w-3.5 h-3.5" /> WhatsApp tab didn’t open? Open WhatsApp Web
          </a>
        )}
      </div>
    </form>
  );
};
