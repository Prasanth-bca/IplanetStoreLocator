import { NextRequest } from 'next/server';
import { requireUser } from '@/lib/auth';
import { leadHistoryResponse } from '@/lib/leadHistory';

export const dynamic = 'force-dynamic';

/** The signed-in person's own leads only. Who they are comes from the session, never from the query. */
export async function GET(request: NextRequest) {
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;
  return leadHistoryResponse(request, auth.user.id);
}
