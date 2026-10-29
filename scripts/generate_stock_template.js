const xlsx = require('xlsx');
const path = require('path');
const fs = require('fs');

const rootDir = path.join(__dirname, '..');
const publicDir = path.join(rootDir, 'public');

// Real sample items modeled on current stock.xlsx and real Apple catalog
const sampleRows = [
  {
    'Store': 'CBE1',
    'Product': 'IPHONE',
    'Segment': 'iPhone',
    'Class': 'iPhone 16',
    'SubClass': 'iPhone 16 128GB',
    'Color': 'Black',
    'SerialNumber': 'SC5J101CBE1',
    'Stock': 1
  },
  {
    'Store': 'CBE1',
    'Product': 'IPHONE',
    'Segment': 'iPhone',
    'Class': 'iPhone 16',
    'SubClass': 'iPhone 16 128GB',
    'Color': 'White',
    'SerialNumber': 'SC5J102CBE1',
    'Stock': 1
  },
  {
    'Store': 'CBE1',
    'Product': 'IPHONE',
    'Segment': 'iPhone',
    'Class': 'iPhone 16 Pro',
    'SubClass': 'iPhone 16 Pro 256GB',
    'Color': 'Natural Titanium',
    'SerialNumber': 'SC5J103CBE1',
    'Stock': 1
  },
  {
    'Store': 'CBE1',
    'Product': 'AIRPODS',
    'Segment': 'AirPods',
    'Class': 'AirPods 4G',
    'SubClass': 'AirPods 4G ANC',
    'Color': 'White',
    'SerialNumber': 'SC5J201CBE1',
    'Stock': 1
  },
  {
    'Store': 'CBE1',
    'Product': 'MAC',
    'Segment': 'Mac',
    'Class': 'MacBook Air 13 M3',
    'SubClass': 'MacBook Air 13 M3 256GB',
    'Color': 'Midnight',
    'SerialNumber': 'SC5J301CBE1',
    'Stock': 1
  },
  {
    'Store': 'CBE1',
    'Product': 'WATCH',
    'Segment': 'Watch',
    'Class': 'Apple Watch Series 10',
    'SubClass': 'Watch Series 10 42mm GPS',
    'Color': 'Jet Black',
    'SerialNumber': 'SC5J401CBE1',
    'Stock': 1
  },
  {
    'Store': 'CBE1',
    'Product': 'FPP',
    'Segment': 'Adapter',
    'Class': 'Adapter-20W',
    'SubClass': '20W USB-C Power Adapter',
    'Color': 'White',
    'SerialNumber': 'SC5J501CBE1',
    'Stock': 1
  },
  {
    'Store': 'IND 1',
    'Product': 'IPHONE',
    'Segment': 'iPhone',
    'Class': 'iPhone 16',
    'SubClass': 'iPhone 16 256GB',
    'Color': 'Teal',
    'SerialNumber': 'SC5J601IND1',
    'Stock': 1
  },
  {
    'Store': 'IND 1',
    'Product': 'IPHONE',
    'Segment': 'iPhone',
    'Class': 'iPhone 16 Pro Max',
    'SubClass': 'iPhone 16 Pro Max 256GB',
    'Color': 'Desert Titanium',
    'SerialNumber': 'SC5J602IND1',
    'Stock': 1
  },
  {
    'Store': 'IND 1',
    'Product': 'IPAD',
    'Segment': 'iPad',
    'Class': 'iPad Air 11 M2',
    'SubClass': 'iPad Air 11 M2 128GB Wi-Fi',
    'Color': 'Space Grey',
    'SerialNumber': 'SC5J701IND1',
    'Stock': 1
  },
  {
    'Store': 'IND 1',
    'Product': 'AIRPODS',
    'Segment': 'AirPods',
    'Class': 'AirPods Pro 2',
    'SubClass': 'AirPods Pro (2nd Gen) USB-C',
    'Color': 'White',
    'SerialNumber': 'SC5J801IND1',
    'Stock': 1
  },
  {
    'Store': 'PBZ1',
    'Product': 'IPHONE',
    'Segment': 'iPhone',
    'Class': 'iPhone 15',
    'SubClass': 'iPhone 15 128GB',
    'Color': 'Blue',
    'SerialNumber': 'SC5J901PBZ1',
    'Stock': 1
  },
  {
    'Store': 'PBZ1',
    'Product': 'MAC',
    'Segment': 'Mac',
    'Class': 'MacBook Pro 14 M3',
    'SubClass': 'MacBook Pro 14 M3 512GB',
    'Color': 'Space Black',
    'SerialNumber': 'SC5J902PBZ1',
    'Stock': 1
  },
  {
    'Store': 'PBZ1',
    'Product': 'TPP',
    'Segment': 'Case',
    'Class': 'Case iPhone',
    'SubClass': 'Spigen Ultra Hybrid iPhone 16',
    'Color': 'Clear',
    'SerialNumber': 'SC5J903PBZ1',
    'Stock': 1
  },
  {
    'Store': 'PBZ1',
    'Product': 'TPP',
    'Segment': 'Power Bank',
    'Class': 'Power Bank',
    'SubClass': 'Anker 10000mAh MagSafe Power Bank',
    'Color': 'Black',
    'SerialNumber': 'SC5J904PBZ1',
    'Stock': 1
  }
];

const columnGuide = [
  {
    'Column Name': 'Store',
    'Required': 'Yes',
    'Format': 'Text (POS Code)',
    'Description': 'Official iPlanet Store POS Code (e.g. CBE1, PBZ1, IND 1, VAL1, MGP1, etc.). Matches stores registered in the Store Locator.'
  },
  {
    'Column Name': 'Product',
    'Required': 'Yes',
    'Format': 'Text (LOB)',
    'Description': 'Line of Business category: IPHONE, MAC, IPAD, WATCH, AIRPODS, FPP (Apple First-Party Accessories), TPP (Third-Party Accessories).'
  },
  {
    'Column Name': 'Segment',
    'Required': 'Optional',
    'Format': 'Text',
    'Description': 'Sub-category or form factor (e.g., iPhone, AirPods, Adapter, Case, Charger, Earphone, Band, Power Bank).'
  },
  {
    'Column Name': 'Class',
    'Required': 'Yes',
    'Format': 'Text',
    'Description': 'Product family / model group (e.g., iPhone 16, AirPods 4G, MacBook Air 13 M3, Apple Watch Series 10).'
  },
  {
    'Column Name': 'SubClass',
    'Required': 'Yes',
    'Format': 'Text',
    'Description': 'Exact SKU or specific model variant (e.g., iPhone 16 128GB, AirPods 4G ANC, 20W USB-C Power Adapter). This is the primary product identifier.'
  },
  {
    'Column Name': 'Color',
    'Required': 'Optional',
    'Format': 'Text',
    'Description': 'Color variant of the device or accessory (e.g., Black, White, Natural Titanium, Desert Titanium, Space Grey, Clear).'
  },
  {
    'Column Name': 'SerialNumber',
    'Required': 'Optional (ERP)',
    'Format': 'Alphanumeric',
    'Description': 'Unit serial number from ERP. If present, multiple rows for the same store and SubClass are automatically summed into the store total stock count.'
  },
  {
    'Column Name': 'Stock',
    'Required': 'Yes',
    'Format': 'Integer (>= 1)',
    'Description': 'Stock quantity for this record. For serialized ERP rows, this is typically 1 per unit. Non-serialized rows can supply integer quantities.'
  }
];

// Create Workbook
const wb = xlsx.utils.book_new();

// Sheet 1: Stock Import
const wsData = xlsx.utils.json_to_sheet(sampleRows);
wsData['!cols'] = [
  { wch: 10 }, // Store
  { wch: 12 }, // Product
  { wch: 16 }, // Segment
  { wch: 26 }, // Class
  { wch: 36 }, // SubClass
  { wch: 18 }, // Color
  { wch: 20 }, // SerialNumber
  { wch: 8 }   // Stock
];
xlsx.utils.book_append_sheet(wb, wsData, 'Stock Import');

// Sheet 2: Column Guide & Instructions
const wsGuide = xlsx.utils.json_to_sheet(columnGuide);
wsGuide['!cols'] = [
  { wch: 16 },
  { wch: 14 },
  { wch: 22 },
  { wch: 65 }
];
xlsx.utils.book_append_sheet(wb, wsGuide, 'Column Guide');

// Save Excel file to root and public
const excelPaths = [
  path.join(rootDir, 'iPlanet_Real_Stock_ERP_Template.xlsx'),
  path.join(publicDir, 'iPlanet_Real_Stock_ERP_Template.xlsx')
];

excelPaths.forEach(p => {
  xlsx.writeFile(wb, p);
  console.log('Saved Excel template to:', p);
});

// Save CSV file to root and public (using first sheet)
const csvContent = xlsx.utils.sheet_to_csv(wsData);
const csvPaths = [
  path.join(rootDir, 'iPlanet_Real_Stock_ERP_Template.csv'),
  path.join(publicDir, 'iPlanet_Real_Stock_ERP_Template.csv')
];

csvPaths.forEach(p => {
  fs.writeFileSync(p, csvContent, 'utf8');
  console.log('Saved CSV template to:', p);
});

console.log('Real Stock ERP template generated successfully!');

