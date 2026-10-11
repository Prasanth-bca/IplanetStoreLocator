const http = require('http');

async function testReal(query) {
  return new Promise((resolve) => {
    http.get('http://localhost:3000/api/stores/search?query=' + encodeURIComponent(query), (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          const j = JSON.parse(data);
          console.log('\n=============================================');
          console.log(`REAL LOCATION TEST: "${query}"`);
          console.log(`Resolved Real Location: ${j.detectedLocation?.name || 'None'}`);
          console.log(`Detected Coordinates: [${j.detectedLocation?.latitude}, ${j.detectedLocation?.longitude}]`);
          console.log(`Matching Stores Found: ${j.totalFound}`);
          if (j.results && j.results.length > 0) {
            j.results.forEach(r => {
              console.log(`  Rank #${r.rank}: [${r.store.posCode}] ${r.store.storeName} (${r.store.city}) | Distance: ${r.distanceKm} km | Drive Time: ${r.travelTimeMinutes} mins`);
            });
          }
        } catch (e) {
          console.error('Error:', e);
        }
        resolve();
      });
    }).on('error', e => {
      console.error(e);
      resolve();
    });
  });
}

async function run() {
  await testReal('Marina Beach Chennai');
  await testReal('Electronic City Bangalore');
  await testReal('Saravanampatti Coimbatore');
  await testReal('Guindy Chennai');
}

run();
