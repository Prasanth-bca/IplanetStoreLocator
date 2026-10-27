import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// SAMPLE catalogue for development. Replace with the real iPlanet SKU list
// (or load it through POST /api/admin/products) before relying on this in production.
const PRODUCTS: { sku: string; name: string; category: string; variant?: string }[] = [
  { sku: 'IP-16-128-BLK', name: 'iPhone 16', category: 'iPhone', variant: '128GB Black' },
  { sku: 'IP-16-256-BLK', name: 'iPhone 16', category: 'iPhone', variant: '256GB Black' },
  { sku: 'IP-16P-256-NAT', name: 'iPhone 16 Pro', category: 'iPhone', variant: '256GB Natural Titanium' },
  { sku: 'IP-16PM-256-NAT', name: 'iPhone 16 Pro Max', category: 'iPhone', variant: '256GB Natural Titanium' },
  { sku: 'IPAD-A-128-WIFI', name: 'iPad Air', category: 'iPad', variant: '128GB Wi-Fi' },
  { sku: 'IPAD-10-64-WIFI', name: 'iPad (10th gen)', category: 'iPad', variant: '64GB Wi-Fi' },
  { sku: 'MBA-M3-256', name: 'MacBook Air 13" M3', category: 'Mac', variant: '256GB' },
  { sku: 'MBP-M3-512', name: 'MacBook Pro 14" M3', category: 'Mac', variant: '512GB' },
  { sku: 'AW-S10-42', name: 'Apple Watch Series 10', category: 'Watch', variant: '42mm' },
  { sku: 'APP-2', name: 'AirPods Pro (2nd gen)', category: 'AirPods' },
  { sku: 'APD-4', name: 'AirPods (4th gen)', category: 'AirPods' },
  { sku: 'ACC-CHG-20W', name: '20W USB-C Power Adapter', category: 'Accessories' },
];

async function main() {
  for (const p of PRODUCTS) {
    await prisma.product.upsert({
      where: { sku: p.sku },
      create: { sku: p.sku, name: p.name, category: p.category, variant: p.variant ?? null },
      update: { name: p.name, category: p.category, variant: p.variant ?? null },
    });
  }
  console.log(`Seeded ${PRODUCTS.length} products`);
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
