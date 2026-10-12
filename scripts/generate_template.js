const xlsx = require('xlsx');
const path = require('path');
const fs = require('fs');

const publicDir = path.join(__dirname, '..', 'public');
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

// Comprehensive reference sample rows across distinct states and cities found in Master Sheet
const templateRows = [
  {
    'Store Name': 'iPlanet Indiranagar',
    'POS Code': 'IND 1',
    'Store Type': 'Retail',
    'State / City': 'Karnataka / Bengaluru',
    'Area / Locality': '100 Feet Road',
    'PIN Code': '560038',
    'Landmark': 'Near BlueStone Jewellery',
    'Full Address': 'No. 770, 100 Feet Road, HAL 2nd Stage, Indiranagar, Bengaluru – 560038',
    'Google Maps / location': 'https://www.google.com/maps/search/?api=1&query=12.9719,77.6412',
    'Latitude & Longitude': '12.9719° N / 77.6412° E'
  },
  {
    'Store Name': 'iPlanet Pody Bazaar',
    'POS Code': 'PBZ1',
    'Store Type': 'Retail',
    'State / City': 'Tamilnadu / Chennai',
    'Area / Locality': 'T. Nagar',
    'PIN Code': '600017',
    'Landmark': 'Near Hindustan Petroleum',
    'Full Address': 'Shop No. 53, Sir Thyagaraya Road, Pondy Bazaar, T. Nagar, Chennai – 600017',
    'Google Maps / location': 'https://www.google.com/maps/search/?api=1&query=13.0406,80.2346',
    'Latitude & Longitude': '13.0406° N / 80.2346° E'
  },
  {
    'Store Name': 'iPlanet RS Puram',
    'POS Code': 'CBE1',
    'Store Type': 'Retail',
    'State / City': 'Tamilnadu / Coimbatore',
    'Area / Locality': 'R.S.Puram',
    'PIN Code': '641002',
    'Landmark': 'Near DB Road',
    'Full Address': 'No. 64, Diwan Bahadur Road, R.S. Puram, Coimbatore – 641002',
    'Google Maps / location': 'https://www.google.com/maps/search/?api=1&query=11.0068,76.9557',
    'Latitude & Longitude': '11.0068° N / 76.9557° E'
  },
  {
    'Store Name': 'iPlanet Powai',
    'POS Code': 'POW 1',
    'Store Type': 'Retail',
    'State / City': 'Maharastra / Mumbai',
    'Area / Locality': 'Hiranandani Gardens',
    'PIN Code': '400076',
    'Landmark': 'Opposite D-Mart',
    'Full Address': 'G12, Ground Floor, Ventura Building, Central Avenue, Hiranandani Gardens, Powai, Mumbai – 400076',
    'Google Maps / location': 'https://www.google.com/maps/search/?api=1&query=19.12,72.91',
    'Latitude & Longitude': '19.12° N / 72.91° E'
  },
  {
    'Store Name': 'iPlanet Kokapet One Mall',
    'POS Code': 'KOK 1',
    'Store Type': 'Retail',
    'State / City': 'AP / TG',
    'Area / Locality': 'Gandipet Main Road',
    'PIN Code': '500075',
    'Landmark': 'Kokapet One Mall',
    'Full Address': 'No. 11-5/3 & 11-5/103, Kokapet One Mall, Gandipet Main Road, Kokapet, Narsingi, Hyderabad – 500075',
    'Google Maps / location': 'https://www.google.com/maps/search/?api=1&query=17.39,78.35',
    'Latitude & Longitude': '17.39° N / 78.35° E'
  },
  {
    'Store Name': 'iPlanet Care Mogappair',
    'POS Code': 'CARE-MGP',
    'Store Type': 'Care',
    'State / City': 'Tamilnadu / Chennai',
    'Area / Locality': 'Mogappair West',
    'PIN Code': '600037',
    'Landmark': 'Above Retail Store, Opp. KFC',
    'Full Address': 'No. 3/PC/5A, 1st Floor, Kambar Street, Mogappair West, Ambattur Industrial Estate, Chennai – 600037',
    'Google Maps / location': 'https://www.google.com/maps/search/?api=1&query=13.0453,80.1686',
    'Latitude & Longitude': '13.0453° N / 80.1686° E'
  }
];

// Instructions sheet describing each column format
const instructions = [
  { 'Column Name': 'Store Name', 'Required': 'YES', 'Format / Example': 'iPlanet Indiranagar', 'Notes': 'Brand name followed by store branch name' },
  { 'Column Name': 'POS Code', 'Required': 'YES', 'Format / Example': 'IND 1, PBZ1, CBE1', 'Notes': 'Unique alphanumeric POS identifier code' },
  { 'Column Name': 'Store Type', 'Required': 'YES', 'Format / Example': 'Retail / Care', 'Notes': 'Set "Retail" for stores or "Care" for service centres' },
  { 'Column Name': 'State / City', 'Required': 'YES', 'Format / Example': 'Karnataka / Bengaluru, Tamilnadu / Chennai, AP / TG', 'Notes': 'Used to classify state and primary operational city' },
  { 'Column Name': 'Area / Locality', 'Required': 'Optional', 'Format / Example': '100 Feet Road, T. Nagar, Hiranandani', 'Notes': 'Neighborhood or commercial zone' },
  { 'Column Name': 'PIN Code', 'Required': 'YES', 'Format / Example': '560038, 600017', 'Notes': 'Must be a valid 6-digit Indian Postal Code' },
  { 'Column Name': 'Landmark', 'Required': 'Optional', 'Format / Example': 'Near BlueStone Jewellery', 'Notes': 'Visible landmark for customer navigation' },
  { 'Column Name': 'Full Address', 'Required': 'YES', 'Format / Example': 'Shop No. 53, Sir Thyagaraya Road, T. Nagar, Chennai – 600017', 'Notes': 'Complete postal address rendered on card' },
  { 'Column Name': 'Google Maps / location', 'Required': 'Optional', 'Format / Example': 'https://www.google.com/maps/search/?api=1&query=...', 'Notes': 'Direct Google Maps web link' },
  { 'Column Name': 'Latitude & Longitude', 'Required': 'Recommended', 'Format / Example': '12.9719° N / 77.6412° E or 12.9719, 77.6412', 'Notes': 'GPS coordinates used for nearest store ranking' }
];

const wb = xlsx.utils.book_new();

// Sheet 1: Store Master Template
const wsTemplate = xlsx.utils.json_to_sheet(templateRows);
wsTemplate['!cols'] = [
  { wch: 30 }, // Store Name
  { wch: 15 }, // POS Code
  { wch: 15 }, // Store Type
  { wch: 26 }, // State / City
  { wch: 25 }, // Area / Locality
  { wch: 14 }, // PIN Code
  { wch: 35 }, // Landmark
  { wch: 70 }, // Full Address
  { wch: 45 }, // Google Maps / location
  { wch: 28 }  // Latitude & Longitude
];
xlsx.utils.book_append_sheet(wb, wsTemplate, 'Store Master Template');

// Sheet 2: Guide & Formatting Notes
const wsGuide = xlsx.utils.json_to_sheet(instructions);
wsGuide['!cols'] = [
  { wch: 25 },
  { wch: 15 },
  { wch: 45 },
  { wch: 55 }
];
xlsx.utils.book_append_sheet(wb, wsGuide, 'Column Guide');

const outXlsx = path.join(publicDir, 'iPlanet_Store_Import_Template.xlsx');
xlsx.writeFile(wb, outXlsx);
console.log('Saved enhanced Excel template at:', outXlsx);

const rootXlsx = path.join(__dirname, '..', 'iPlanet_Store_Import_Template.xlsx');
xlsx.writeFile(wb, rootXlsx);
console.log('Saved copy at root:', rootXlsx);

// Generate CSV template
const csvHeader = [
  'Store Name',
  'POS Code',
  'Store Type',
  'State / City',
  'Area / Locality',
  'PIN Code',
  'Landmark',
  'Full Address',
  'Google Maps / location',
  'Latitude & Longitude'
].join(',');

const csvRows = templateRows.map(r => [
  `"${r['Store Name']}"`,
  `"${r['POS Code']}"`,
  `"${r['Store Type']}"`,
  `"${r['State / City']}"`,
  `"${r['Area / Locality']}"`,
  `"${r['PIN Code']}"`,
  `"${r['Landmark']}"`,
  `"${r['Full Address']}"`,
  `"${r['Google Maps / location']}"`,
  `"${r['Latitude & Longitude']}"`
].join(','));

const csvContent = csvHeader + '\n' + csvRows.join('\n') + '\n';
fs.writeFileSync(path.join(publicDir, 'iPlanet_Store_Import_Template.csv'), csvContent, 'utf8');
fs.writeFileSync(path.join(__dirname, '..', 'iPlanet_Store_Import_Template.csv'), csvContent, 'utf8');
console.log('Saved CSV template at:', path.join(publicDir, 'iPlanet_Store_Import_Template.csv'));
