import { canAccess } from '../lib/access';
import { checkPrice, offerSaving, offerState, platformSearchUrl, priceStatus, productKey, matchesQuery, summariseGroup, shareText, discountPercent, bestConditional, guessCategory, STALE_HOURS } from '../lib/market/rules';
let pass = 0, fail = 0;
const t = (n: string, ok: boolean, x = '') => { ok ? pass++ : (fail++, console.log('FAIL', n, x)); };
const now = new Date('2026-11-05T10:00:00Z');
const h = (hrs: number) => new Date(now.getTime() - hrs * 3600_000);
const day = (d: number) => new Date(now.getTime() + d * 86400_000).toISOString();

// identity
t('key normalises storage', productKey('iPhone 17 Pro 256 GB') === productKey('iphone 17 pro 256gb') && productKey('iPhone 17 Pro 256GB') === 'iphone-17-pro-256gb');
t('storage differs', productKey('iPhone 17 Pro 256GB') !== productKey('iPhone 17 Pro 512GB'));
t('generation differs', productKey('iPhone 17 Pro 256GB') !== productKey('iPhone 17 Pro Max 256GB'));
t('pro != pro max key', productKey('iPhone 17 Pro') !== productKey('iPhone 17 Pro Max'));
t('match words', matchesQuery('iPhone 17 Pro 256GB', 'iphone 17 pro 256 gb') && !matchesQuery('iPhone 17 Pro 256GB', 'iphone 16'));
t('match partial', matchesQuery('MacBook Air M4 16GB 256GB', 'macbook air m4'));
t('category', guessCategory('Apple Watch Series 11') === 'Apple Watch' && guessCategory('AirPods Pro 3') === 'AirPods' && guessCategory('iPad Air 11') === 'iPad');

// validation
const good = { productLabel: 'iPhone 17 Pro 256GB', platform: 'amazon', sellingPrice: '1,29,900', mrp: 134900, availability: 'in_stock', sourceUrl: 'https://www.amazon.in/dp/X', offers: [] };
const ok = checkPrice(good);
t('valid price', ok.ok && ok.value.sellingPrice === 129900 && ok.value.platform === 'AMAZON' && ok.value.category === 'iPhone');
t('needs source', !checkPrice({ ...good, sourceUrl: '' }).ok);
t('needs https', !checkPrice({ ...good, sourceUrl: 'javascript:alert(1)' }).ok);
t('mrp below price', !checkPrice({ ...good, mrp: 100000 }).ok);
t('absurd price', !checkPrice({ ...good, sellingPrice: 5 }).ok);
t('bad platform', !checkPrice({ ...good, platform: 'eBay' }).ok);
t('other needs name', !checkPrice({ ...good, platform: 'other' }).ok && checkPrice({ ...good, platform: 'other', retailerName: 'Sangeetha' }).ok);
t('bank offer needs bank', !checkPrice({ ...good, offers: [{ kind: 'BANK', title: '10% off', discountPercent: 10 }] }).ok);
t('offer ok', checkPrice({ ...good, offers: [{ kind: 'BANK', bank: 'HDFC', title: '₹5000 off', discountAmount: 5000, validUntil: day(3) }] }).ok);
t('offer bad dates', !checkPrice({ ...good, offers: [{ kind: 'OTHER', title: 'x offer', validFrom: day(5), validUntil: day(1) }] }).ok);
t('offer pct range', !checkPrice({ ...good, offers: [{ kind: 'OTHER', title: 'x offer', discountPercent: 150 }] }).ok);

// offers
const o = (p: Partial<any> = {}) => ({ kind: 'BANK', validFrom: null, validUntil: null, discountAmount: null, discountPercent: null, minAmount: null, maxDiscount: null, ...p });
t('expired offer', offerState(o({ validUntil: day(-1) }), now) === 'EXPIRED');
t('upcoming offer', offerState(o({ validFrom: day(1) }), now) === 'UPCOMING');
t('no end = active', offerState(o(), now) === 'ACTIVE');
t('expired gives no saving', offerSaving(o({ validUntil: day(-1), discountAmount: 5000 }), 100000, now) === 0);
t('amount saving', offerSaving(o({ discountAmount: 5000 }), 100000, now) === 5000);
t('pct capped', offerSaving(o({ discountPercent: 10, maxDiscount: 3000 }), 100000, now) === 3000);
t('min not met', offerSaving(o({ discountAmount: 5000, minAmount: 150000 }), 100000, now) === 0);
t('emi no saving', offerSaving(o({ kind: 'NO_COST_EMI', discountAmount: 5000 }), 100000, now) === 0);
t('discount pct', discountPercent(134900, 129900) === 4 && discountPercent(null, 100) === null && discountPercent(100, 100) === null);

// comparison
const row = (id: string, platform: string, price: number, age: number, extra: any = {}) => ({ id, platform, sellingPrice: price, mrp: 134900, availability: 'IN_STOCK', fetchedAt: h(age), offers: [], ...extra });
t('fresh/old', priceStatus(row('a', 'AMAZON', 1, 1), now) === 'VERIFIED' && priceStatus(row('a', 'AMAZON', 1, STALE_HOURS + 1), now) === 'OLD' && priceStatus(null, now) === 'UNAVAILABLE');
const rows = [row('a', 'AMAZON', 129900, 2), row('f', 'FLIPKART', 128900, 5), row('c', 'CROMA', 127000, 200), row('r', 'RELIANCE', 126000, 1, { availability: 'OUT_OF_STOCK' }), row('v', 'VIJAY', 128900, 3)];
const s = summariseGroup(rows, now);
t('lowest ignores old and out of stock', s.lowestPrice === 128900 && s.lowestRowIds.sort().join() === 'f,v', JSON.stringify(s));
t('highest/spread', s.highestPrice === 129900 && s.spread === 1000);
t('counts', s.verifiedCount === 4 && s.oldCount === 1 && s.unavailableCount === 1); // APPLE missing
const withOffer = [row('a', 'AMAZON', 129900, 2, { offers: [{ id: 'o1', kind: 'BANK', validFrom: null, validUntil: null, discountAmount: 5000, discountPercent: null, minAmount: null, maxDiscount: null }] }), row('f', 'FLIPKART', 128900, 5)];
const s2 = summariseGroup(withOffer, now);
t('conditional kept separate', s2.lowestPrice === 128900 && s2.lowestWithOffer?.price === 124900 && s2.lowestWithOffer.rowId === 'a');
t('best conditional', bestConditional(withOffer[0], now)?.saving === 5000 && bestConditional(withOffer[1], now) === null);
t('empty group', summariseGroup([], now).lowestPrice === null && summariseGroup([], now).unavailableCount === 6);

// sharing
const txt = shareText('iPhone 17 Pro 256GB', [
  { platformLabel: 'Amazon India', status: 'VERIFIED', sellingPrice: 129900, availability: 'IN_STOCK', offerLines: ['HDFC: ₹5,000 off'], updatedLabel: '5 Nov, 3:00 pm', url: 'https://a', isLowest: true },
  { platformLabel: 'Croma', status: 'UNAVAILABLE', sellingPrice: null, availability: 'UNKNOWN', offerLines: [], updatedLabel: '', url: null, isLowest: false },
]);
t('share text honest', /Amazon India: ₹1,29,900 \(lowest\)/.test(txt) && /Croma: price could not be verified/.test(txt) && /confirm on the retailer/.test(txt));
t('search link', platformSearchUrl('AMAZON', 'iPhone 17 Pro 256GB')?.startsWith('https://www.amazon.in/s?k=iPhone%2017') === true && platformSearchUrl('OTHER', 'x') === null);
t('sales opens market', canAccess('SALES', '/market') && canAccess('SALES', '/api/market/search') && canAccess('SALES', '/api/market/refresh', 'POST') && !canAccess('SALES', '/api/market/refresh', 'GET'));
t('store may reach market (setting decides)', canAccess('STORE', '/market') && canAccess('STORE', '/api/market/access'));
t('admin market is admin only', !canAccess('SALES', '/admin/market') && !canAccess('SALES', '/api/admin/market/prices') && !canAccess('STORE', '/api/admin/market/settings') && canAccess('ADMIN', '/admin/market'));
console.log(`${pass} passed${fail ? `, ${fail} FAILED` : ''}`);
process.exit(fail ? 1 : 0);
