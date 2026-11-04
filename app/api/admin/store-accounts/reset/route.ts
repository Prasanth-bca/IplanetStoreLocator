import { NextRequest, NextResponse } from 'next/server';
import { randomInt } from 'node:crypto';
import { prisma } from '@/lib/prisma';
import { forgetUser, hashPassword, requireRole } from '@/lib/auth';
import { MISSING_MSG, tableMissing } from '@/lib/storeLeads/server';
import { validatePassword } from '@/lib/userRules';

export const dynamic = 'force-dynamic';

function generatePassword(): string {
  const alphabet = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789';
  return Array.from({ length: 12 }, () => alphabet[randomInt(alphabet.length)]).join('');
}

/**
 * Admin: set a new password for a store's login (body: { posCode, password? }). With no password a random one is made.
 * The password is returned ONCE here (it is stored only as a hash, so an existing one can never be shown). Everyone
 * currently signed in with this store login is signed out, so the new password takes effect everywhere at once.
 */
export async function POST(request: NextRequest) {
  const auth = await requireRole(request, 'ADMIN');
  if (!auth.ok) return auth.response;
  try {
    const body = await request.json().catch(() => ({}));
    const posCode = typeof body?.posCode === 'string' ? body.posCode.trim() : '';
    if (!posCode) return NextResponse.json({ error: 'Choose a store.' }, { status: 400 });
    const account = await prisma.storeAccount.findFirst({ where: { posCode: { equals: posCode, mode: 'insensitive' } }, include: { user: { select: { id: true, username: true } } } });
    if (!account) return NextResponse.json({ error: 'That store has no login yet.' }, { status: 404 });
    let password = generatePassword();
    if (typeof body.password === 'string' && body.password.length > 0) {
      const problem = validatePassword(body.password);
      if (problem) return NextResponse.json({ error: problem }, { status: 400 });
      password = body.password;
    }
    await prisma.user.update({ where: { id: account.user.id }, data: { passwordHash: await hashPassword(password), tokenVersion: { increment: 1 } } });
    forgetUser(account.user.id);
    return NextResponse.json({ success: true, posCode: account.posCode, storeName: account.storeName, username: account.user.username, password });
  } catch (error) {
    if (tableMissing(error)) return NextResponse.json({ error: MISSING_MSG }, { status: 503 });
    console.error('POST /api/admin/store-accounts/reset error:', (error as Error)?.message);
    return NextResponse.json({ error: 'The password could not be reset.' }, { status: 500 });
  }
}
