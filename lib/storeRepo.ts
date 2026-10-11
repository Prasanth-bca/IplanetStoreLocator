import fs from 'fs';
import path from 'path';
import { Store, StoreCategory } from '@/types/store';

const STORES_FILE = path.join(process.cwd(), 'data', 'stores.json');
const CARE_FILE = path.join(process.cwd(), 'data', 'care_centres.json');

// Memory cache
let cachedRetailStores: Store[] | null = null;
let cachedCareCentres: Store[] | null = null;

export function clearStoreCache(): void {
  cachedRetailStores = null;
  cachedCareCentres = null;
}

export function getRetailStores(): Store[] {
  if (cachedRetailStores) return cachedRetailStores;
  try {
    if (fs.existsSync(STORES_FILE)) {
      const raw = fs.readFileSync(STORES_FILE, 'utf-8');
      cachedRetailStores = JSON.parse(raw);
      return cachedRetailStores || [];
    }
  } catch (err) {
    console.error('Error reading stores.json:', err);
  }
  return [];
}

export function saveRetailStores(stores: Store[]): void {
  cachedRetailStores = stores;
  try {
    const dir = path.dirname(STORES_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(STORES_FILE, JSON.stringify(stores, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saving stores.json:', err);
  }
}

export function getCareCentres(): Store[] {
  if (cachedCareCentres) return cachedCareCentres;
  try {
    if (fs.existsSync(CARE_FILE)) {
      const raw = fs.readFileSync(CARE_FILE, 'utf-8');
      cachedCareCentres = JSON.parse(raw);
      return cachedCareCentres || [];
    }
  } catch (err) {
    console.error('Error reading care_centres.json:', err);
  }
  return [];
}

export function saveCareCentres(centres: Store[]): void {
  cachedCareCentres = centres;
  try {
    const dir = path.dirname(CARE_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(CARE_FILE, JSON.stringify(centres, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saving care_centres.json:', err);
  }
}

export function getAllStores(category: StoreCategory = 'Retail'): Store[] {
  return category === 'Care' ? getCareCentres() : getRetailStores();
}
