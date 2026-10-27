import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { forgetUser, hashPassword, requireRole } from '@/lib/auth';
import { Role } from '@/lib/access';
import { parseRole, validateName, validatePassword, wouldRemoveLastAdmin } from '@/lib/userRules';

export const dynamic = 'force-dynamic';

/**
 * Body: any of { name, role, active, password }.
 * Changing role, status or password also signs that person out of all their sessions.
 * Users are never deleted, only disabled, so lead history keeps its attribution.
 */
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireRole(request, 'ADMIN');
  if (!auth.ok) return auth.response;

  try {
    const target = await prisma.user.findUnique({ where: { id: params.id } });
    if (!target) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const body = await request.json().catch(() => ({}));
    const data: { name?: string; role?: Role; active?: boolean; passwordHash?: string; tokenVersion?: { increment: number } } = {};
    let revokeSessions = false;

    if (body.name !== undefined) {
      const name = String(body.name).replace(/\s+/g, ' ').trim();
      const problem = validateName(name);
      if (problem) return NextResponse.json({ error: problem }, { status: 400 });
      data.name = name;
    }

    let newRole: Role | undefined;
    if (body.role !== undefined) {
      const role = parseRole(body.role);
      if (!role) return NextResponse.json({ error: 'Choose a valid role.' }, { status: 400 });
      if (role !== target.role) {
        newRole = role;
        data.role = role;
        revokeSessions = true;
      }
    }

    let newActive: boolean | undefined;
    if (body.active !== undefined) {
      if (typeof body.active !== 'boolean') return NextResponse.json({ error: 'active must be true or false' }, { status: 400 });
      if (body.active !== target.active) {
        newActive = body.active;
        data.active = body.active;
        revokeSessions = true;
      }
    }

    if (body.password !== undefined) {
      const problem = validatePassword(String(body.password));
      if (problem) return NextResponse.json({ error: problem }, { status: 400 });
      data.passwordHash = await hashPassword(String(body.password));
      revokeSessions = true;
    }

    if (Object.keys(data).length === 0) return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });

    // Safety rails against locking everyone out.
    if (target.id === auth.user.id && (newRole === 'SALES' || newActive === false)) {
      return NextResponse.json({ error: 'You can’t remove your own admin access or disable your own account.' }, { status: 400 });
    }
    const targetRole = target.role as Role;
    const otherActiveAdmins = await prisma.user.count({ where: { role: 'ADMIN', active: true, NOT: { id: target.id } } });
    if (wouldRemoveLastAdmin({ role: targetRole, active: target.active }, { role: newRole, active: newActive }, otherActiveAdmins)) {
      return NextResponse.json({ error: 'There must always be at least one active admin.' }, { status: 400 });
    }

    if (revokeSessions) data.tokenVersion = { increment: 1 };
    const user = await prisma.user.update({
      where: { id: target.id },
      data,
      select: { id: true, username: true, name: true, role: true, active: true },
    });
    forgetUser(target.id);
    return NextResponse.json({ success: true, user, signedOut: revokeSessions });
  } catch (error) {
    console.error('PATCH /api/admin/users/[id] error:', error);
    return NextResponse.json({ error: 'Failed to update the user' }, { status: 500 });
  }
}
