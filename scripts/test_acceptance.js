const http = require('http');

async function test(query) {
  return new Promise((resolve) => {
    http.get('http://localhost:3000/api/stores/search?query=' + encodeURIComponent(query), (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          console.log('\n======================================================');
          console.log(`QUERY: "${query}"`);
          console.log(`Detected Location: ${json.detectedLocation?.name || 'Direct / Fallback'}`);
          console.log(`Category: ${json.category} | Found: ${json.totalFound}`);
          if (json.notice) console.log(`Notice: ${json.notice}`);
          if (json.results && json.results.length > 0) {
            json.results.forEach(r => {
              console.log(`[Rank ${r.rank}] ${r.store.posCode} - ${r.store.storeName} | ${r.store.city} | Dist: ${r.distanceKm} km | Travel: ${r.travelTimeMinutes} mins | Match: ${r.matchReason}`);
            });
          } else {
            console.log('Result: No stores found (Expected for empty / non-iPlanet territory).');
          }
          resolve(true);
        } catch (e) {
          console.error('Parse error:', e);
          resolve(false);
        }
      });
    }).on('error', err => {
      console.error('Request error:', err);
      resolve(false);
    });
  });
}

async function runAll() {
  console.log('STARTING ACCEPTANCE TESTS:');
  await test('600016');
  await test('Whitefield');
  await test('Ashoka Pillar');
  await test('RMM');
  await test('Coimbatore');
  await test('iPlanet near Phoenix Mall');
  await test('3 iPlanet stores near HSR');
  await test('iPlanet Care near Powai');
  await test('iPlanet Care Bangalore');
  await test('service center Mogappair');
  await test('CARE-CBE');
}

runAll();
