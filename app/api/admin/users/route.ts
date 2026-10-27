import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { hashPassword, requireRole } from '@/lib/auth';
import { normalizeUsername, parseRole, validateName, validatePassword, validateUsername } from '@/lib/userRules';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const auth = await requireRole(request, 'ADMIN');
  if (!auth.ok) return auth.response;

  const [users, leadCounts] = await Promise.all([
    prisma.user.findMany({
      orderBy: [{ active: 'desc' }, { role: 'asc' }, { name: 'asc' }],
      select: { id: true, username: true, name: true, role: true, active: true, lastLoginAt: true, createdAt: true },
    }),
    prisma.lead.groupBy({ by: ['userId'], _count: { _all: true }, where: { userId: { not: null } } }),
  ]);
  const countBy = new Map(leadCounts.map(c => [c.userId, c._count._all]));

  return NextResponse.json({
    users: users.map(u => ({ ...u, leadCount: countBy.get(u.id) ?? 0 })),
  });
}

/** Body: { username, name, role, password } */
export async function POST(request: NextRequest) {
  const auth = await requireRole(request, 'ADMIN');
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json().catch(() => ({}));
    const username = normalizeUsername(String(body.username ?? ''));
    const name = String(body.name ?? '').replace(/\s+/g, ' ').trim();
    const role = parseRole(body.role);
    const password = String(body.password ?? '');

    const problem = validateUsername(username) ?? validateName(name) ?? validatePassword(password) ?? (role ? null : 'Choose a role.');
    if (problem || !role) return NextResponse.json({ error: problem ?? 'Choose a role.' }, { status: 400 });

    try {
      const user = await prisma.user.create({
        data: { username, name, role, passwordHash: await hashPassword(password) },
        select: { id: true, username: true, name: true, role: true, active: true },
      });
      return NextResponse.json({ success: true, user });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        return NextResponse.json({ error: `The username "${username}" is already taken.` }, { status: 409 });
      }
      throw err;
    }
  } catch (error) {
    console.error('POST /api/admin/users error:', error);
    return NextResponse.json({ error: 'Failed to create the user' }, { status: 500 });
  }
}
