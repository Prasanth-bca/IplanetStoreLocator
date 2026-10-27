import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { normalizeMobile, validateEnquiry } from '@/lib/enquiry';
import { requireUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const CLIENT_ID = /^[A-Za-z0-9-]{8,64}$/;

/**
 * Records a lead passed to a store. The store name comes from the database, not the browser.
 * `clientId` makes the call idempotent: sending the same one again returns the stored lead
 * instead of creating a second.
 */
export async function POST(request: NextRequest) {
  const auth = await requireUser(request);
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json();

    const clientId = String(body.clientId ?? '');
    if (!CLIENT_ID.test(clientId)) {
      return NextResponse.json({ error: 'A valid clientId is required' }, { status: 400 });
    }

    const store = await prisma.store.findFirst({
      where: { posCode: { equals: String(body.posCode ?? '').trim(), mode: 'insensitive' } },
      select: { storeName: true, posCode: true },
    });
    if (!store) {
      return NextResponse.json({ error: 'Store not found' }, { status: 404 });
    }

    const input = {
      customerName: String(body.customerName ?? ''),
      customerMobile: String(body.customerMobile ?? ''),
      storeName: store.storeName,
      posCode: store.posCode,
      product: String(body.product ?? ''),
      remarks: String(body.remarks ?? ''),
    };
    const { valid, errors } = validateEnquiry(input);
    if (!valid) {
      return NextResponse.json({ error: Object.values(errors)[0] ?? 'Invalid enquiry', errors }, { status: 400 });
    }

    const oneLine = (v: string) => v.replace(/\s+/g, ' ').trim();
    const remarks = input.remarks.trim().slice(0, 500);

    try {
      const lead = await prisma.lead.create({
        data: {
          clientId,
          customerName: oneLine(input.customerName),
          customerMobile: normalizeMobile(input.customerMobile) as string,
          storeName: store.storeName,
          posCode: store.posCode,
          product: oneLine(input.product),
          remarks: remarks || null,
          channel: body.channel === 'desktop' ? 'desktop' : 'web',
          // Always the signed-in person; never taken from the request.
          userId: auth.user.id,
          userName: auth.user.name,
        },
      });
      return NextResponse.json({ success: true, duplicate: false, id: lead.id });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        const existing = await prisma.lead.findUnique({ where: { clientId }, select: { id: true } });
        return NextResponse.json({ success: true, duplicate: true, id: existing?.id });
      }
      throw err;
    }
  } catch (error) {
    console.error('POST /api/leads error:', error);
    return NextResponse.json({ error: 'Failed to record the lead' }, { status: 500 });
  }
}
