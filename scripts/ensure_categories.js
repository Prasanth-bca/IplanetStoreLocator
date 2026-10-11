const fs = require('fs');
const stores = JSON.parse(fs.readFileSync('./data/stores.json', 'utf8'));
let updated = false;

stores.forEach(s => {
  if (!s.category) {
    s.category = 'Retail';
    updated = true;
  }
});

if (updated) {
  fs.writeFileSync('./data/stores.json', JSON.stringify(stores, null, 2), 'utf8');
  console.log('Updated stores.json with category: "Retail"');
} else {
  console.log('All stores already have category set.');
}
