/** Encrypts the Groq API key at rest (server only). AES-256-GCM, key derived from the app's session secret. */

import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

function key(): Buffer {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret) throw new Error('ADMIN_SESSION_SECRET is not set');
  return createHash('sha256').update(`iplanet-chatbot-key|${secret}`).digest();
}

const b64 = (b: Buffer) => b.toString('base64url');

export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', key(), iv);
  const enc = Buffer.concat([c.update(plain, 'utf8'), c.final()]);
  return `${b64(iv)}.${b64(c.getAuthTag())}.${b64(enc)}`;
}

/** Returns null if the value is damaged or was encrypted with a different secret. */
export function decryptSecret(stored: string): string | null {
  try {
    const [iv, tag, enc] = stored.split('.');
    const d = createDecipheriv('aes-256-gcm', key(), Buffer.from(iv, 'base64url'));
    d.setAuthTag(Buffer.from(tag, 'base64url'));
    return Buffer.concat([d.update(Buffer.from(enc, 'base64url')), d.final()]).toString('utf8');
  } catch {
    return null;
  }
}
