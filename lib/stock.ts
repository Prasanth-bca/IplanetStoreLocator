import { prisma } from '@/lib/prisma';

export type StockStatus = 'in_stock' | 'low' | 'out' | 'unknown';

export const STOCK_REASONS = ['Received', 'Sold', 'Transfer', 'Correction', 'Import'] as const;
export type StockReason = (typeof STOCK_REASONS)[number];

export function stockStatus(quantity: number | null | undefined, threshold: number | null | undefined): StockStatus {
  if (quantity === null || quantity === undefined) return 'unknown';
  if (quantity <= 0) return 'out';
  if (quantity <= (threshold ?? 2)) return 'low';
  return 'in_stock';
}

/** POS codes can contain spaces ("NSN 1"), so route params may arrive URL-encoded. */
export function decodePosCode(raw: string): string {
  try {
    return decodeURIComponent(raw).trim();
  } catch {
    return raw.trim();
  }
}

export async function findStoreByPosCode(posCode: string) {
  return prisma.store.findFirst({
    where: { posCode: { equals: posCode, mode: 'insensitive' } },
    select: { id: true, posCode: true, storeName: true, city: true, category: true },
  });
}

export interface StoreStockRow {
  productId: string;
  sku: string;
  name: string;
  category: string;
  variant: string | null;
  quantity: number | null;
  lowStockThreshold: number;
  status: StockStatus;
  updatedAt: string | null;
  updatedBy: string | null;
}

/** One row per active product for a store; products with no stock record come back as `unknown`. */
export async function getStoreStock(storeId: string): Promise<StoreStockRow[]> {
  const products = await prisma.product.findMany({
    where: { active: true },
    orderBy: [{ category: 'asc' }, { name: 'asc' }, { variant: 'asc' }],
    include: { stock: { where: { storeId } } },
  });

  return products.map(p => {
    const s = p.stock[0];
    return {
      productId: p.id,
      sku: p.sku,
      name: p.name,
      category: p.category,
      variant: p.variant,
      quantity: s ? s.quantity : null,
      lowStockThreshold: s ? s.lowStockThreshold : 2,
      status: stockStatus(s?.quantity, s?.lowStockThreshold),
      updatedAt: s ? s.updatedAt.toISOString() : null,
      updatedBy: s?.updatedBy ?? null,
    };
  });
}

export interface StockChange {
  productId: string;
  /** Absolute quantity to set. Takes precedence over `delta`. */
  quantity?: number;
  /** Relative change applied to the current quantity. */
  delta?: number;
  lowStockThreshold?: number;
}

/**
 * Applies changes atomically and records a StockMovement for every quantity that actually changed.
 *
 * Round trips are kept to a minimum (one read, one upsert per product, one batched insert) because
 * each query pays the network latency to the database, and the transaction has a time limit.
 */
export async function applyStockChanges(
  storeId: string,
  changes: StockChange[],
  reason: string,
  note: string | null,
  user: string
) {
  return prisma.$transaction(
    async tx => {
      const existingRows = await tx.storeStock.findMany({
        where: { storeId, productId: { in: changes.map(c => c.productId) } },
      });
      const existingBy = new Map(existingRows.map(r => [r.productId, r]));

      const movements: { storeId: string; productId: string; delta: number; newQty: number; reason: string; note: string | null; user: string }[] = [];

      for (const c of changes) {
        const existing = existingBy.get(c.productId);
        const current = existing?.quantity ?? 0;
        const next =
          c.quantity !== undefined ? c.quantity : c.delta !== undefined ? current + c.delta : current;
        if (!Number.isInteger(next) || next < 0) {
          throw new Error(`Invalid quantity for product ${c.productId}: ${next}`);
        }
        const threshold = c.lowStockThreshold ?? existing?.lowStockThreshold ?? 2;

        await tx.storeStock.upsert({
          where: { storeId_productId: { storeId, productId: c.productId } },
          create: { storeId, productId: c.productId, quantity: next, lowStockThreshold: threshold, updatedBy: user },
          update: { quantity: next, lowStockThreshold: threshold, updatedBy: user },
        });

        if (next !== current || !existing) {
          movements.push({ storeId, productId: c.productId, delta: next - current, newQty: next, reason, note, user });
        }
      }

      if (movements.length > 0) {
        await tx.stockMovement.createMany({ data: movements });
      }
      return changes.length;
    },
    { maxWait: 10000, timeout: 30000 }
  );
}
