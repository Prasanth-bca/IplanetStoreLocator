import { NextRequest, NextResponse } from 'next/server';
import { requireUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/** The signed-in person, for showing their name and for showing or hiding role-specific links. */
export async function GET(request: NextRequest) {
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;
  const { id, username, name, role } = auth.user;
  return NextResponse.json({ id, username, name, role });
}
