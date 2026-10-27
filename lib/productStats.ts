import { prisma } from '@/lib/prisma';

/** Products with stock totals across every store. `onlyActive` hides disabled products. */
export async function getProductsWithTotals(onlyActive: boolean) {
  const [products, totals, stocked] = await Promise.all([
    prisma.product.findMany({
      where: onlyActive ? { active: true } : undefined,
      orderBy: [{ category: 'asc' }, { name: 'asc' }, { variant: 'asc' }],
    }),
    prisma.storeStock.groupBy({ by: ['productId'], _sum: { quantity: true } }),
    prisma.storeStock.groupBy({ by: ['productId'], where: { quantity: { gt: 0 } }, _count: { _all: true } }),
  ]);

  const unitsBy = new Map(totals.map(t => [t.productId, t._sum.quantity ?? 0]));
  const storesBy = new Map(stocked.map(t => [t.productId, t._count._all]));

  return products.map(p => ({
    ...p,
    totalUnits: unitsBy.get(p.id) ?? 0,
    storesInStock: storesBy.get(p.id) ?? 0,
  }));
}
