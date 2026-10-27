/**
 * Server-side authentication (Node runtime only: it uses Prisma and scrypt).
 * The middleware checks the signed session cookie; these helpers additionally confirm against the
 * database that the person still exists, is active and hasn't had their sessions revoked.
 */

import { randomBytes, scrypt as scryptCb, timingSafeEqual } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Role } from '@/lib/access';
import { SESSION_COOKIE, verifySessionToken } from '@/lib/adminAuth';

/* ───────────── Passwords ───────────── */

const SCRYPT = { N: 16384, r: 8, p: 1, keyLen: 64 };

function scrypt(password: string, salt: Buffer, keyLen: number): Promise<Buffer> {
  return new Promise((resolve, reject) =>
    scryptCb(password, salt, keyLen, { N: SCRYPT.N, r: SCRYPT.r, p: SCRYPT.p }, (err, key) => (err ? reject(err) : resolve(key)))
  );
}

/** Format: scrypt$N$r$p$<salt base64>$<hash base64> */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await scrypt(password, salt, SCRYPT.keyLen);
  return ['scrypt', SCRYPT.N, SCRYPT.r, SCRYPT.p, salt.toString('base64'), hash.toString('base64')].join('$');
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, , , , saltB64, hashB64] = stored.split('$');
  if (scheme !== 'scrypt' || !saltB64 || !hashB64) return false;
  const expected = Buffer.from(hashB64, 'base64');
  const actual = await scrypt(password, Buffer.from(saltB64, 'base64'), expected.length);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

let dummyHash: Promise<string> | null = null;
/** Spend the same time as a real check when the username doesn't exist, so timing doesn't reveal it. */
export async function burnPasswordCheck(password: string): Promise<void> {
  dummyHash ??= hashPassword('not-a-real-password');
  await verifyPassword(password, await dummyHash);
}

export function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/* ───────────── Sessions ───────────── */

export interface SessionUser {
  id: string;
  username: string;
  name: string;
  role: Role;
}

const USER_CACHE_TTL_MS = 30 * 1000;
const userCache = new Map<string, { at: number; user: (SessionUser & { active: boolean; tokenVersion: number }) | null }>();

/** Call after changing a user so this server instance stops trusting its cached copy. */
export function forgetUser(id: string) {
  userCache.delete(id);
}

async function loadUser(id: string) {
  const hit = userCache.get(id);
  if (hit && Date.now() - hit.at < USER_CACHE_TTL_MS) return hit.user;

  const row = await prisma.user.findUnique({
    where: { id },
    select: { id: true, username: true, name: true, role: true, active: true, tokenVersion: true },
  });
  const user = row ? { ...row, role: row.role as Role } : null;
  userCache.set(id, { at: Date.now(), user });
  return user;
}

/** The signed-in person, or null if there is no valid session, or they were disabled or signed out remotely. */
export async function getSessionUser(request: NextRequest): Promise<SessionUser | null> {
  const claims = await verifySessionToken(request.cookies.get(SESSION_COOKIE)?.value);
  if (!claims) return null;
  const user = await loadUser(claims.uid);
  if (!user || !user.active || user.tokenVersion !== claims.tv) return null;
  // The role always comes from the database, never from the token.
  return { id: user.id, username: user.username, name: user.name, role: user.role };
}

type Guard = { ok: true; user: SessionUser } | { ok: false; response: NextResponse };

export async function requireUser(request: NextRequest): Promise<Guard> {
  const user = await getSessionUser(request);
  if (!user) return { ok: false, response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  return { ok: true, user };
}

export async function requireRole(request: NextRequest, role: Role): Promise<Guard> {
  const guard = await requireUser(request);
  if (!guard.ok) return guard;
  if (role === 'ADMIN' && guard.user.role !== 'ADMIN') {
    return { ok: false, response: NextResponse.json({ error: 'You don’t have permission to do this.' }, { status: 403 }) };
  }
  return guard;
}
