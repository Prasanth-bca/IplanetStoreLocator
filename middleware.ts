import { NextRequest, NextResponse } from 'next/server';
import { SESSION_COOKIE, verifySessionToken } from '@/lib/adminAuth';
import { canAccess } from '@/lib/access';

/**
 * First line of defence: the signed session says who is signed in and with what role, and the
 * access rules decide which pages and APIs that role may use. The API routes check the database
 * again (person still active, role current), so this layer can be cheap and run at the edge.
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname === '/login' || pathname === '/api/login') {
    return NextResponse.next();
  }

  const session = await verifySessionToken(request.cookies.get(SESSION_COOKIE)?.value);
  const isApi = pathname.startsWith('/api/');

  if (!session) {
    if (isApi) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('next', pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (!canAccess(session.role, pathname, request.method)) {
    if (isApi) return NextResponse.json({ error: 'You don’t have permission to do this.' }, { status: 403 });
    return NextResponse.redirect(new URL('/', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)']
};
