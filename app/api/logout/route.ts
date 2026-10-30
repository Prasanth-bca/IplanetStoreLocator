import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { SESSION_COOKIE, verifySessionToken } from '@/lib/adminAuth';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const rawToken = request.cookies.get(SESSION_COOKIE)?.value;
    const claims = await verifySessionToken(rawToken);

    if (claims?.sid) {
      await prisma.userSession.update({
        where: { id: claims.sid },
        data: {
          status: 'LOGGED_OUT',
          endedAt: new Date(),
        },
      }).catch(() => {});
    }
  } catch (error) {
    console.error('Logout session cleanup error:', error);
  }

  const response = NextResponse.json({ success: true });
  response.cookies.set(SESSION_COOKIE, '', { path: '/', maxAge: 0 });
  return response;
}
