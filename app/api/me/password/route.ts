import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { forgetUser, hashPassword, requireUser, verifyPassword } from '@/lib/auth';
import { createSessionToken, SESSION_COOKIE, SESSION_TTL_MS } from '@/lib/adminAuth';
import { validatePassword } from '@/lib/userRules';

export const dynamic = 'force-dynamic';

/** Lets anyone change their own password. Their other sessions are signed out; this one stays signed in. */
export async function POST(request: NextRequest) {
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json().catch(() => ({}));
    const currentPassword = String(body.currentPassword ?? '');
    const newPassword = String(body.newPassword ?? '');

    const problem = validatePassword(newPassword);
    if (problem) return NextResponse.json({ error: problem }, { status: 400 });
    if (newPassword === currentPassword) {
      return NextResponse.json({ error: 'Choose a password different from the current one.' }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { id: auth.user.id } });
    if (!user || !(await verifyPassword(currentPassword, user.passwordHash))) {
      return NextResponse.json({ error: 'Your current password is incorrect.' }, { status: 400 });
    }

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: await hashPassword(newPassword), tokenVersion: { increment: 1 } },
    });
    forgetUser(user.id);

    const response = NextResponse.json({ success: true });
    response.cookies.set(SESSION_COOKIE, await createSessionToken({ uid: updated.id, role: auth.user.role, tv: updated.tokenVersion }), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: SESSION_TTL_MS / 1000,
    });
    return response;
  } catch (error) {
    console.error('POST /api/me/password error:', error);
    return NextResponse.json({ error: 'Could not change the password.' }, { status: 500 });
  }
}
