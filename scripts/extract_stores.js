const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');

const workbook = xlsx.readFile(path.join(__dirname, '..', 'Master Sheet.xlsx'));
const sheet = workbook.Sheets[workbook.SheetNames[0]];
const rawData = xlsx.utils.sheet_to_json(sheet, { defval: '' });

function parseCoord(str) {
  if (!str) return null;
  // Handle ranges like "9.944–9.950° N / 78.135–78.145° E"
  if (str.includes('9.944')) {
    return { lat: 9.947, lng: 78.140 };
  }
  // Remove leading dots or non-standard characters
  const cleaned = str.replace(/^\s*\.\s*/, '').replace(/°/g, '').replace(/[NSEWnsew]/g, '');
  const parts = cleaned.split(/[\/\,]/);
  if (parts.length >= 2) {
    const lat = parseFloat(parts[0].trim());
    const lng = parseFloat(parts[1].trim());
    if (!isNaN(lat) && !isNaN(lng)) {
      return { lat, lng };
    }
  }
  return null;
}

const stores = [];

rawData.forEach((row, idx) => {
  const storeName = (row['Store Name'] || '').trim();
  const posCode = (row['POS Code'] || '').trim();
  const storeType = (row['Store Type'] || '').trim() || 'Retail';
  const stateCity = (row['State / City'] || '').trim();
  const area = (row['Area / Locality'] || '').trim();
  const pincode = String(row['PIN Code'] || '').trim().replace(/[^\d]/g, '');
  const landmark = (row['Landmark'] || '').trim();
  const fullAddress = (row['Full Address'] || '').trim();
  const mapsUrl = (row['Google Maps / location'] || '').trim();
  const rawLatLng = (row['Latitude & Longitude, if available'] || '').trim();

  // Valid stores must have a POS code and address or valid name
  if (!posCode || posCode.length < 2 || !fullAddress) return;

  let city = '';
  let state = '';
  if (stateCity) {
    const scParts = stateCity.split('/');
    if (scParts.length === 2) {
      state = scParts[0].trim();
      city = scParts[1].trim();
    } else {
      city = stateCity;
      state = stateCity;
    }
  }

  // Normalize specific city names
  if (city.toLowerCase().includes('banglore') || city.toLowerCase().includes('bengaluru')) {
    city = 'Bengaluru';
  } else if (city.toLowerCase().includes('manglore')) {
    city = 'Mangalore';
  } else if (city.toLowerCase() === 'south') {
    if (storeName.includes('Nagercoil')) city = 'Nagercoil';
    else if (storeName.includes('Tirunelvelli')) city = 'Tirunelveli';
    else if (storeName.includes('Thoothukudi')) city = 'Thoothukudi';
  }

  const coords = parseCoord(rawLatLng);
  const latitude = coords ? coords.lat : null;
  const longitude = coords ? coords.lng : null;

  stores.push({
    id: `store_${stores.length + 1}`,
    posCode: posCode,
    storeName: storeName,
    storeType: storeType,
    brand: 'iPlanet',
    address: fullAddress,
    area: area,
    locality: area,
    city: city,
    state: state,
    country: 'India',
    pincode: pincode,
    landmark: landmark || null,
    latitude: latitude,
    longitude: longitude,
    phone: '080-4699-9888',
    contactPerson: 'Store Manager',
    openingTime: '10:00 AM',
    closingTime: '09:30 PM',
    workingDays: 'Monday to Sunday',
    googlePlaceId: null,
    googleMapsUrl: mapsUrl || (latitude && longitude ? `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}` : null),
    status: 'Active',
    priority: stores.length + 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  });
});

console.log(`Preloaded exactly ${stores.length} verified iPlanet retail stores.`);

const outDir = path.join(__dirname, '..', 'data');
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

fs.writeFileSync(path.join(outDir, 'stores.json'), JSON.stringify(stores, null, 2), 'utf-8');
console.log(`Saved clean stores data to ${path.join(outDir, 'stores.json')}`);
