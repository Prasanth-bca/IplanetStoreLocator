import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import { Store } from '../types/store';

const prisma = new PrismaClient();

const STORES_JSON = path.join(process.cwd(), 'data', 'stores.json');
const CARE_JSON = path.join(process.cwd(), 'data', 'care_centres.json');

async function seedFrom(filePath: string, label: string): Promise<number> {
  if (!fs.existsSync(filePath)) {
    console.log(`Skipping ${label}: ${filePath} not found`);
    return 0;
  }

  const stores: Store[] = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

  for (const s of stores) {
    await prisma.store.upsert({
      where: { id: s.id },
      create: {
        id: s.id,
        posCode: s.posCode,
        storeName: s.storeName,
        storeType: s.storeType || 'Retail',
        category: s.category,
        locationType: s.locationType,
        brand: s.brand || 'iPlanet',
        address: s.address,
        area: s.area,
        locality: s.locality,
        city: s.city,
        state: s.state,
        country: s.country || 'India',
        pincode: s.pincode,
        landmark: s.landmark,
        latitude: s.latitude,
        longitude: s.longitude,
        phone: s.phone,
        contactPerson: s.contactPerson,
        storeManager: s.storeManager,
        openingTime: s.openingTime,
        closingTime: s.closingTime,
        workingDays: s.workingDays,
        googlePlaceId: s.googlePlaceId,
        googleMapsUrl: s.googleMapsUrl,
        status: s.status || 'Active',
        priority: s.priority || 0
      },
      update: {
        posCode: s.posCode,
        storeName: s.storeName,
        storeType: s.storeType || 'Retail',
        category: s.category,
        locationType: s.locationType,
        brand: s.brand || 'iPlanet',
        address: s.address,
        area: s.area,
        locality: s.locality,
        city: s.city,
        state: s.state,
        country: s.country || 'India',
        pincode: s.pincode,
        landmark: s.landmark,
        latitude: s.latitude,
        longitude: s.longitude,
        phone: s.phone,
        contactPerson: s.contactPerson,
        storeManager: s.storeManager,
        openingTime: s.openingTime,
        closingTime: s.closingTime,
        workingDays: s.workingDays,
        googlePlaceId: s.googlePlaceId,
        googleMapsUrl: s.googleMapsUrl,
        status: s.status || 'Active',
        priority: s.priority || 0
      }
    });
  }

  console.log(`Seeded ${stores.length} ${label}`);
  return stores.length;
}

async function main() {
  const retailCount = await seedFrom(STORES_JSON, 'Retail Stores');
  const careCount = await seedFrom(CARE_JSON, 'Care Centres');
  console.log(`Done. Total seeded: ${retailCount + careCount}`);
}

main()
  .catch(err => {
    console.error('Seed failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
