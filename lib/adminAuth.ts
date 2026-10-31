import { isRole, Role } from '@/lib/access';

const SESSION_COOKIE = 'admin_session';
// Shorter than before (was 7 days): a deactivated or demoted person is locked out within this
// window even on pages, which the middleware can only check against the signed token.
const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours

export interface SessionPayload {
  uid: string;
  role: Role;
  /** Matches User.tokenVersion; a mismatch means the session was revoked. */
  tv: number;
  /** Matches UserSession.id for live tracking and audit logging. */
  sid?: string;
  exp: number;
}

function base64url(bytes: ArrayBuffer | Uint8Array): string {
  const buf = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let str = '';
  for (let i = 0; i < buf.length; i++) str += String.fromCharCode(buf[i]);
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64urlToBytes(b64url: string): Uint8Array {
  const b64 = b64url.replace(/-/g, '+').replace(/_/g, '/').padEnd(
    b64url.length + ((4 - (b64url.length % 4)) % 4),
    '='
  );
  const str = atob(b64);
  const bytes = new Uint8Array(str.length);
  for (let i = 0; i < str.length; i++) bytes[i] = str.charCodeAt(i);
  return bytes;
}

async function getKey(): Promise<CryptoKey> {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret) {
    throw new Error('ADMIN_SESSION_SECRET is not configured');
  }
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  );
}

export async function createSessionToken(claims: Omit<SessionPayload, 'exp'>): Promise<string> {
  const payload = JSON.stringify({ ...claims, exp: Date.now() + SESSION_TTL_MS });
  const payloadB64 = base64url(new TextEncoder().encode(payload));
  const key = await getKey();
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payloadB64));
  return `${payloadB64}.${base64url(signature)}`;
}

/** The signed claims if the token is genuine and unexpired, otherwise null. */
export async function verifySessionToken(token: string | undefined | null): Promise<SessionPayload | null> {
  if (!token) return null;
  const [payloadB64, sigB64] = token.split('.');
  if (!payloadB64 || !sigB64) return null;

  try {
    const key = await getKey();
    const valid = await crypto.subtle.verify(
      'HMAC',
      key,
      base64urlToBytes(sigB64) as BufferSource,
      new TextEncoder().encode(payloadB64)
    );
    if (!valid) return null;

    const p = JSON.parse(new TextDecoder().decode(base64urlToBytes(payloadB64)));
    // Tokens issued before roles existed have no uid/role and are rejected, which signs everyone out once.
    if (typeof p.uid !== 'string' || !isRole(p.role) || typeof p.tv !== 'number' || typeof p.exp !== 'number') return null;
    if (p.exp <= Date.now()) return null;
    return { uid: p.uid, role: p.role, tv: p.tv, exp: p.exp, ...(typeof p.sid === 'string' ? { sid: p.sid } : {}) };
  } catch {
    return null;
  }
}

export { SESSION_COOKIE, SESSION_TTL_MS };
