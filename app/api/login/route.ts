import { parseUserAgent } from '@/lib/userAgent';
import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { burnPasswordCheck, hashPassword, safeEqual, verifyPassword } from '@/lib/auth';
import { createSessionToken, SESSION_COOKIE, SESSION_TTL_MS } from '@/lib/adminAuth';
import { clearFailures, recordFailure, retryAfterSeconds } from '@/lib/loginThrottle';
import { isRole } from '@/lib/access';
import { normalizeUsername } from '@/lib/userRules';

export const dynamic = 'force-dynamic';

const BAD_LOGIN = 'Incorrect username or password';
const FIRST_ADMIN_USERNAME = 'admin';

/**
 * First-time setup: while no accounts exist at all, signing in as "admin" with the site's existing
 * ADMIN_PASSWORD creates the first Admin account. After that, ADMIN_PASSWORD no longer works for sign-in.
 */
async function createFirstAdminIfEligible(username: string, password: string) {
  const configured = process.env.ADMIN_PASSWORD;
  if (!configured || username !== FIRST_ADMIN_USERNAME || !safeEqual(password, configured)) return null;
  if ((await prisma.user.count()) > 0) return null;

  try {
    return await prisma.user.create({
      data: { username: FIRST_ADMIN_USERNAME, name: 'Administrator', role: 'ADMIN', passwordHash: await hashPassword(password) },
    });
  } catch (err) {
    // Two first sign-ins at once: the other one created it, so use that account.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      return prisma.user.findUnique({ where: { username: FIRST_ADMIN_USERNAME } });
    }
    throw err;
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const username = normalizeUsername(String(body.username ?? ''));
    const password = String(body.password ?? '');
    if (!username || !password) {
      return NextResponse.json({ error: 'Enter your username and password.' }, { status: 400 });
    }

    const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim() || request.headers.get('x-real-ip') || 'unknown';
    const userAgent = request.headers.get('user-agent') || '';
    const client = parseUserAgent(userAgent);

    const wait = retryAfterSeconds(ip, username);
    if (wait > 0) {
      return NextResponse.json(
        { error: `Too many attempts. Try again in ${Math.ceil(wait / 60)} minute${wait > 60 ? 's' : ''}.` },
        { status: 429, headers: { 'Retry-After': String(wait) } }
      );
    }

    let user = await prisma.user.findUnique({ where: { username } });
    if (!user) {
      user = await createFirstAdminIfEligible(username, password);
      if (!user) {
        await burnPasswordCheck(password); // same response time whether or not the username exists
        recordFailure(ip, username);
        await prisma.userSession.create({
          data: {
            username,
            ipAddress: ip,
            userAgent,
            deviceType: client.deviceType,
            browser: client.browser,
            os: client.os,
            currentPath: '/login',
            status: 'FAILED',
            failReason: 'User not found',
          },
        }).catch(() => {});
        return NextResponse.json({ error: BAD_LOGIN }, { status: 401 });
      }
    } else if (!(await verifyPassword(password, user.passwordHash))) {
      recordFailure(ip, username);
      await prisma.userSession.create({
        data: {
          userId: user.id,
          username: user.username,
          name: user.name,
          role: user.role,
          ipAddress: ip,
          userAgent,
          deviceType: client.deviceType,
          browser: client.browser,
          os: client.os,
          currentPath: '/login',
          status: 'FAILED',
          failReason: 'Incorrect password',
        },
      }).catch(() => {});
      return NextResponse.json({ error: BAD_LOGIN }, { status: 401 });
    }

    if (!user.active) {
      await prisma.userSession.create({
        data: {
          userId: user.id,
          username: user.username,
          name: user.name,
          role: user.role,
          ipAddress: ip,
          userAgent,
          deviceType: client.deviceType,
          browser: client.browser,
          os: client.os,
          currentPath: '/login',
          status: 'FAILED',
          failReason: 'Account disabled',
        },
      }).catch(() => {});
      return NextResponse.json({ error: 'This account is disabled. Please contact an admin.' }, { status: 403 });
    }
    if (!isRole(user.role)) {
      return NextResponse.json({ error: 'This account has no valid role. Please contact an admin.' }, { status: 403 });
    }

    clearFailures(ip, username);
    await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

    // Create active session in database
    const session = await prisma.userSession.create({
      data: {
        userId: user.id,
        username: user.username,
        name: user.name,
        role: user.role,
        ipAddress: ip,
        userAgent,
        deviceType: client.deviceType,
        browser: client.browser,
        os: client.os,
        currentPath: user.role === 'ADMIN' ? '/admin' : '/locator',
        status: 'ACTIVE',
      },
    });

    const token = await createSessionToken({
      uid: user.id,
      role: user.role,
      tv: user.tokenVersion,
      sid: session.id,
    });
    const response = NextResponse.json({ success: true, user: { name: user.name, role: user.role } });
    response.cookies.set(SESSION_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: SESSION_TTL_MS / 1000,
    });
    return response;
  } catch (error) {
    console.error('POST /api/login error:', error);
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 });
  }
}
