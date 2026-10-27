import { NextRequest } from 'next/server';
import { requireRole } from '@/lib/auth';
import { leadHistoryResponse } from '@/lib/leadHistory';

export const dynamic = 'force-dynamic';

/** Everyone's leads (Admin). Optional ?posCode= narrows to one store. */
export async function GET(request: NextRequest) {
  const auth = await requireRole(request, 'ADMIN');
  if (!auth.ok) return auth.response;
  return leadHistoryResponse(request);
}
