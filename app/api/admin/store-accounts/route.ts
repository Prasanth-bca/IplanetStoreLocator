import { NextRequest, NextResponse } from 'next/server';
import { randomInt } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { hashPassword, requireRole } from '@/lib/auth';
import { MISSING_MSG, tableMissing } from '@/lib/storeLeads/server';
import { USERNAME_PATTERN } from '@/lib/userRules';
import { usernameForStore } from '@/lib/storeLeads/rules';

export const dynamic = 'force-dynamic';
const MAX_BATCH = 20; // password hashing is deliberately slow, so large jobs are sent in small batches

/** A readable random password, avoiding look-alike characters (0/O, 1/l/I). */
function generatePassword(): string {
  const alphabet = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 12 }, () => alphabet[randomInt(alphabet.length)]).join('');
}

/** Admin: every active retail store and whether it already has a store login. */
export async function GET(request: NextRequest) {
  const auth = await requireRole(request, 'ADMIN');
  if (!auth.ok) return auth.response;
  try {
    const stores = await prisma.store.findMany({ where: { category: 'Retail' }, orderBy: [{ city: 'asc' }, { storeName: 'asc' }], select: { posCode: true, storeName: true, city: true, status: true } });
    const accounts = await prisma.storeAccount.findMany({ include: { user: { select: { username: true, active: true, lastLoginAt: true } } } });
    const byPos = new Map(accounts.map((a) => [a.posCode.toLowerCase(), a]));
    return NextResponse.json({
      stores: stores.map((s) => {
        const a = byPos.get(s.posCode.toLowerCase());
        return { ...s, suggestedUsername: usernameForStore(s.posCode), account: a ? { userId: a.userId, username: a.user.username, active: a.user.active, lastLoginAt: a.user.lastLoginAt?.toISOString() ?? null } : null };
      }),
    });
  } catch (error) {
    if (tableMissing(error)) return NextResponse.json({ error: MISSING_MSG, tableMissing: true }, { status: 503 });
    console.error('GET /api/admin/store-accounts error:', (error as Error)?.message);
    return NextResponse.json({ error: 'The store accounts could not be loaded.' }, { status: 500 });
  }
}

/**
 * Admin: create a login for each listed store (body: { posCodes: string[] }, at most 20 at a time). Each gets the username
 * store.<poscode> and a random password. The passwords are returned ONCE in this response and are not stored in readable form.
 * Stores that already have a login are skipped and reported.
 */
export async function POST(request: NextRequest) {
  const auth = await requireRole(request, 'ADMIN');
  if (!auth.ok) return auth.response;
  try {
    const body = await request.json().catch(() => ({}));
    const codes: string[] = Array.isArray(body?.posCodes) ? Array.from(new Set(body.posCodes.filter((x: unknown): x is string => typeof x === 'string').map((x: string) => x.trim()).filter(Boolean))) : [];
    if (codes.length === 0) return NextResponse.json({ error: 'Choose at least one store.' }, { status: 400 });
    if (codes.length > MAX_BATCH) return NextResponse.json({ error: `Create at most ${MAX_BATCH} store logins at a time.` }, { status: 400 });

    const stores = await prisma.store.findMany({ where: { category: 'Retail', posCode: { in: codes } }, select: { posCode: true, storeName: true } });
    const known = new Map(stores.map((s) => [s.posCode, s]));
    const created: { posCode: string; storeName: string; username: string; password: string }[] = [];
    const skipped: { posCode: string; reason: string }[] = [];

    for (const code of codes) {
      const store = known.get(code);
      if (!store) { skipped.push({ posCode: code, reason: 'Not a retail store.' }); continue; }
      if (await prisma.storeAccount.findUnique({ where: { posCode: store.posCode }, select: { id: true } })) { skipped.push({ posCode: code, reason: 'Already has a login.' }); continue; }
      const username = usernameForStore(store.posCode);
      if (!USERNAME_PATTERN.test(username)) { skipped.push({ posCode: code, reason: `The POS code cannot make a valid username (${username}).` }); continue; }
      const password = generatePassword();
      try {
        await prisma.$transaction(async (tx) => {
          const user = await tx.user.create({ data: { username, name: store.storeName, role: 'STORE', passwordHash: await hashPassword(password) }, select: { id: true } });
          await tx.storeAccount.create({ data: { userId: user.id, posCode: store.posCode, storeName: store.storeName } });
        }, { timeout: 20000 });
        created.push({ posCode: store.posCode, storeName: store.storeName, username, password });
      } catch (e) {
        if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') skipped.push({ posCode: code, reason: `The username ${username} is already taken.` });
        else throw e;
      }
    }
    return NextResponse.json({ created, skipped }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    if (tableMissing(error)) return NextResponse.json({ error: MISSING_MSG, tableMissing: true }, { status: 503 });
    console.error('POST /api/admin/store-accounts error:', (error as Error)?.message);
    return NextResponse.json({ error: 'The store logins could not be created.' }, { status: 500 });
  }
}
