/**
 * Clipboard helpers for browser code.
 *
 * `copyToClipboard` must be called synchronously from inside a user's click or submit handler:
 * it starts the copy straight away, so the browser still treats it as a user action even if the
 * caller opens another tab right afterwards.
 */

export type CopyResult = { ok: true } | { ok: false; reason: 'insecure' | 'denied' | 'failed' };

/** Legacy synchronous copy via a temporary textarea. Works on plain HTTP and older browsers. */
function legacyCopy(text: string): boolean {
  const area = document.createElement('textarea');
  area.value = text;
  area.setAttribute('readonly', '');
  area.style.cssText = 'position:fixed;top:0;left:0;opacity:0;pointer-events:none';
  document.body.appendChild(area);
  const previouslyFocused = document.activeElement as HTMLElement | null;
  try {
    area.select();
    area.setSelectionRange(0, text.length);
    return document.execCommand('copy');
  } catch {
    return false;
  } finally {
    document.body.removeChild(area);
    previouslyFocused?.focus?.();
  }
}

export function copyToClipboard(text: string): Promise<CopyResult> {
  const canUseApi = typeof navigator !== 'undefined' && !!navigator.clipboard?.writeText && window.isSecureContext;

  if (canUseApi) {
    // Called synchronously, before the caller opens another tab and the page loses focus.
    return navigator.clipboard.writeText(text).then(
      (): CopyResult => ({ ok: true }),
      (err: unknown): CopyResult => ({
        ok: false,
        reason: err instanceof DOMException && err.name === 'NotAllowedError' ? 'denied' : 'failed',
      })
    );
  }

  // Not a secure context (plain HTTP) or no Clipboard API: try the legacy method.
  const copied = legacyCopy(text);
  const insecure = typeof window !== 'undefined' && !window.isSecureContext;
  return Promise.resolve<CopyResult>(copied ? { ok: true } : { ok: false, reason: insecure ? 'insecure' : 'failed' });
}

/** Reason shown to the user when a copy fails. */
export function copyFailureMessage(reason: 'insecure' | 'denied' | 'failed'): string {
  switch (reason) {
    case 'insecure':
      return 'This page isn’t using a secure (HTTPS) connection, so the browser blocks automatic copying.';
    case 'denied':
      return 'The browser didn’t allow access to the clipboard.';
    default:
      return 'The browser couldn’t copy the message.';
  }
}
