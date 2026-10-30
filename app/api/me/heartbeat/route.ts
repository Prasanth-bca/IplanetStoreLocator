import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json().catch(() => ({}));
    const currentPath = typeof body.pathname === 'string' ? body.pathname.slice(0, 100) : '/';

    if (auth.user.sessionId) {
      const session = await prisma.userSession.findUnique({
        where: { id: auth.user.sessionId },
        select: { status: true },
      });

      if (!session || session.status === 'REVOKED') {
        return NextResponse.json({ ok: false, revoked: true }, { status: 403 });
      }

      await prisma.userSession.update({
        where: { id: auth.user.sessionId },
        data: {
          lastActiveAt: new Date(),
          currentPath,
          status: 'ACTIVE',
        },
      });
    }

    return NextResponse.json({ ok: true, now: Date.now() });
  } catch (error) {
    console.error('Heartbeat error:', error);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

