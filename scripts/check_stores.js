const fs = require('fs');
const stores = JSON.parse(fs.readFileSync('./data/stores.json', 'utf8'));
console.log('Total stores in stores.json:', stores.length);
const byCity = {};
stores.forEach(s => {
  byCity[s.city] = (byCity[s.city] || 0) + 1;
});
console.log('By City:', byCity);

// Check Bangalore stores
const blr = stores.filter(s => /bengaluru|bangalore/i.test(s.city) || /bengaluru|bangalore/i.test(s.address));
console.log('\nBangalore stores (' + blr.length + '):');
blr.forEach(s => console.log(`[${s.posCode}] ${s.storeName} | ${s.city} | ${s.area} | lat: ${s.latitude}, lng: ${s.longitude}`));
