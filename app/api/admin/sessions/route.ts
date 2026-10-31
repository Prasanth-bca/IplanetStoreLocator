import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { forgetUser, requireRole } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const auth = await requireRole(request, 'ADMIN');
  if (!auth.ok) return auth.response;

  try {
    const now = Date.now();
    const onlineThreshold = new Date(now - 2 * 60 * 1000); // 2 minutes
    const idleThreshold = new Date(now - 10 * 60 * 1000);   // 10 minutes

    // 1. Live sessions (active in last 10 minutes and not ended)
    const liveSessions = await prisma.userSession.findMany({
      where: {
        lastActiveAt: { gte: idleThreshold },
        endedAt: null,
        status: 'ACTIVE',
      },
      orderBy: { lastActiveAt: 'desc' },
      select: {
        id: true,
        userId: true,
        username: true,
        name: true,
        role: true,
        ipAddress: true,
        deviceType: true,
        browser: true,
        os: true,
        currentPath: true,
        status: true,
        loginAt: true,
        lastActiveAt: true,
      },
    });

    // Compute live status tag
    const formattedLive = liveSessions.map(s => {
      const isOnline = new Date(s.lastActiveAt).getTime() >= onlineThreshold.getTime();
      return {
        ...s,
        liveStatus: isOnline ? ('ONLINE' as const) : ('IDLE' as const),
      };
    });

    // 2. Recent Audit History (last 100 sessions)
    const recentHistory = await prisma.userSession.findMany({
      take: 100,
      orderBy: { loginAt: 'desc' },
    });

    // 3. KPI Statistics
    const onlineAdmins = formattedLive.filter(s => s.role === 'ADMIN' && s.liveStatus === 'ONLINE').length;
    const onlineSales = formattedLive.filter(s => s.role === 'SALES' && s.liveStatus === 'ONLINE').length;
    const totalOnline = formattedLive.filter(s => s.liveStatus === 'ONLINE').length;
    const totalIdle = formattedLive.filter(s => s.liveStatus === 'IDLE').length;
    const desktopCount = formattedLive.filter(s => s.deviceType === 'Desktop').length;
    const mobileCount = formattedLive.filter(s => s.deviceType === 'Mobile' || s.deviceType === 'Tablet').length;

    return NextResponse.json({
      liveSessions: formattedLive,
      recentHistory,
      stats: {
        totalOnline,
        totalIdle,
        onlineAdmins,
        onlineSales,
        desktopCount,
        mobileCount,
      },
    });
  } catch (error) {
    console.error('GET /api/admin/sessions error:', error);
    return NextResponse.json({ error: 'Failed to load sessions' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireRole(request, 'ADMIN');
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json().catch(() => ({}));
    const { action, sessionId } = body;

    if (action === 'revoke' && sessionId) {
      const session = await prisma.userSession.findUnique({
        where: { id: sessionId },
        select: { userId: true, username: true },
      });

      if (!session) {
        return NextResponse.json({ error: 'Session not found' }, { status: 404 });
      }

      // Mark session as REVOKED
      await prisma.userSession.update({
        where: { id: sessionId },
        data: {
          status: 'REVOKED',
          endedAt: new Date(),
        },
      });

      // Increment user tokenVersion to invalidate cookies on all devices immediately
      if (session.userId) {
        await prisma.user.update({
          where: { id: session.userId },
          data: { tokenVersion: { increment: 1 } },
        });
        forgetUser(session.userId); // this server stops trusting its cached copy at once; others within 30 s
      }

      return NextResponse.json({ success: true, message: `Terminated session for ${session.username}` });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('POST /api/admin/sessions error:', error);
    return NextResponse.json({ error: 'Failed to perform session action' }, { status: 500 });
  }
}

