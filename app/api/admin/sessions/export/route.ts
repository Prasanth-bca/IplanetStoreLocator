import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireRole } from '@/lib/auth';

export const dynamic = 'force-dynamic';

function fmtDate(d: Date | null): string {
  if (!d) return '';
  return new Date(d).toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

function calcDuration(start: Date, end: Date | null): string {
  const endTime = end ? new Date(end).getTime() : Date.now();
  const diffSec = Math.max(0, Math.floor((endTime - new Date(start).getTime()) / 1000));
  const hrs = Math.floor(diffSec / 3600);
  const mins = Math.floor((diffSec % 3600) / 60);
  const secs = diffSec % 60;
  if (hrs > 0) return `${hrs}h ${mins}m ${secs}s`;
  if (mins > 0) return `${mins}m ${secs}s`;
  return `${secs}s`;
}

function escapeCsv(str: string | null | undefined): string {
  if (!str) return '""';
  const clean = String(str).replace(/"/g, '""');
  return `"${clean}"`;
}

export async function GET(request: NextRequest) {
  const auth = await requireRole(request, 'ADMIN');
  if (!auth.ok) return auth.response;

  try {
    const sessions = await prisma.userSession.findMany({
      take: 1000,
      orderBy: { loginAt: 'desc' },
    });

    const headers = [
      'Session ID',
      'Username',
      'Name',
      'Role',
      'Status',
      'Login Time (IST)',
      'Last Active (IST)',
      'Ended At (IST)',
      'Duration',
      'Current Page',
      'IP Address',
      'Device Type',
      'Browser',
      'OS',
      'Fail Reason',
    ];

    const rows = sessions.map(s => [
      escapeCsv(s.id),
      escapeCsv(s.username),
      escapeCsv(s.name || ''),
      escapeCsv(s.role || ''),
      escapeCsv(s.status),
      escapeCsv(fmtDate(s.loginAt)),
      escapeCsv(fmtDate(s.lastActiveAt)),
      escapeCsv(fmtDate(s.endedAt)),
      escapeCsv(calcDuration(s.loginAt, s.endedAt)),
      escapeCsv(s.currentPath || '/'),
      escapeCsv(s.ipAddress || ''),
      escapeCsv(s.deviceType || ''),
      escapeCsv(s.browser || ''),
      escapeCsv(s.os || ''),
      escapeCsv(s.failReason || ''),
    ]);

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\r\n');

    const filename = `iPlanet_Login_Sessions_${new Date().toISOString().slice(0, 10)}.csv`;

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error('GET /api/admin/sessions/export error:', error);
    return NextResponse.json({ error: 'Failed to export sessions' }, { status: 500 });
  }
}

