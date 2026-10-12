const fs = require('fs');
const path = require('path');
const xlsx = require('xlsx');

const projectRoot = path.join(__dirname, '..');
const autosaveDir = 'C:\\Users\\USER\\AppData\\Roaming\\Microsoft\\Excel\\Master%20Sheet312836150176519531';
const latestAutosave = path.join(autosaveDir, 'Master%20Sheet((Autosaved-312836721884267960)).xlsb');
const targetMasterXlsx = path.join(projectRoot, 'Master Sheet.xlsx');

const aiWorkPath = 'C:\\Users\\USER\\Documents\\AI Work\\Master Sheet.xlsx';

let sourcePath = targetMasterXlsx;
if (fs.existsSync(aiWorkPath)) {
  const aiStats = fs.statSync(aiWorkPath);
  const targetStats = fs.existsSync(targetMasterXlsx) ? fs.statSync(targetMasterXlsx) : null;
  if (!targetStats || aiStats.mtimeMs > targetStats.mtimeMs) {
    sourcePath = aiWorkPath;
    fs.copyFileSync(aiWorkPath, targetMasterXlsx);
    console.log('Synchronized latest Master Sheet.xlsx from Documents/AI Work into project workspace.');
  }
}

console.log('Reading stores from:', sourcePath);
const sourceWorkbook = xlsx.readFile(sourcePath);

const sheet = sourceWorkbook.Sheets[sourceWorkbook.SheetNames[0]];
const rawData = xlsx.utils.sheet_to_json(sheet, { defval: '' });

function parseCoord(str) {
  if (!str) return null;
  if (str.includes('9.944')) {
    return { lat: 9.947, lng: 78.140 };
  }
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
  const storeName = String(row['Store Name'] || '').trim();
  const posCode = String(row['POS Code'] || '').trim();
  const storeType = String(row['Store Type'] || '').trim() || 'Retail';
  const stateCity = String(row['State / City'] || '').trim();
  const area = String(row['Area / Locality'] || '').trim();
  const pincode = String(row['PIN Code'] || '').trim().replace(/[^\d]/g, '');
  const landmark = String(row['Landmark'] || '').trim();
  const fullAddress = String(row['Full Address'] || '').trim();
  const mapsUrl = String(row['Google Maps / location'] || '').trim();
  const rawLatLng = String(row['Latitude & Longitude'] || row['Latitude & Longitude, if available'] || '').trim();

  // Skip invalid/empty rows
  if (!posCode || !storeName) return;

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

  // Normalize state & city names
  const stateLower = state.toLowerCase();
  const cityLower = city.toLowerCase();

  if (stateLower.includes('tamilnadu') || stateLower === 'tamil nadu') {
    state = 'Tamil Nadu';
  } else if (stateLower.includes('karanataka') || stateLower.includes('karnataka')) {
    state = 'Karnataka';
  } else if (stateLower.includes('kerala') || stateLower.includes('keralam')) {
    state = 'Kerala';
  } else if (stateLower.includes('maharastra') || stateLower.includes('maharashtra')) {
    state = 'Maharashtra';
  } else if (stateLower.includes('gujarat')) {
    state = 'Gujarat';
  } else if (stateLower.includes('ap') || stateLower.includes('tg') || stateLower.includes('andhra')) {
    state = 'Andhra Pradesh';
  } else if (stateLower.includes('puducherry') || stateLower.includes('pondicherry')) {
    state = 'Puducherry';
  }

  if (cityLower.includes('banglore') || cityLower.includes('bengaluru')) {
    city = 'Bengaluru';
  } else if (cityLower.includes('manglore') || cityLower.includes('mangaluru')) {
    city = 'Mangalore';
  } else if (cityLower.includes('chennai')) {
    city = 'Chennai';
  } else if (cityLower.includes('coimbatore')) {
    city = 'Coimbatore';
  } else if (cityLower.includes('madurai')) {
    city = 'Madurai';
  } else if (cityLower.includes('salem')) {
    city = 'Salem';
  } else if (cityLower.includes('tanjore') || cityLower.includes('thanjavur')) {
    city = 'Thanjavur';
  } else if (cityLower.includes('vellore')) {
    city = 'Vellore';
  } else if (cityLower.includes('trichy') || cityLower.includes('tiruchirappalli')) {
    city = 'Tiruchirappalli';
  } else if (cityLower.includes('mumbai')) {
    city = 'Mumbai';
  } else if (cityLower.includes('thane')) {
    city = 'Thane';
  } else if (cityLower.includes('satara')) {
    city = 'Satara';
  } else if (cityLower.includes('sangli')) {
    city = 'Sangli';
  } else if (cityLower.includes('south')) {
    if (storeName.includes('Nagercoil')) city = 'Nagercoil';
    else if (storeName.includes('Tirunelvelli') || storeName.includes('Tirunelveli')) city = 'Tirunelveli';
    else if (storeName.includes('Thoothukudi')) city = 'Thoothukudi';
  } else if (cityLower === 'tamilnadu') {
    if (storeName.includes('Tiruppur')) city = 'Tiruppur';
    else if (storeName.includes('Dharamapuri') || storeName.includes('Dharmapuri')) city = 'Dharmapuri';
  } else if (cityLower === 'keralam' || cityLower === 'kerala') {
    if (storeName.includes('Kannur')) city = 'Kannur';
    else if (storeName.includes('Vytila') || storeName.includes('Kochi')) city = 'Kochi';
    else if (storeName.includes('Kottaiyam') || storeName.includes('Kottayam')) city = 'Kottayam';
    else if (storeName.includes('Palakkad')) city = 'Palakkad';
    else if (storeName.includes('Trivandrum')) city = 'Thiruvananthapuram';
  } else if (cityLower === 'puducherry') {
    city = 'Puducherry';
  }

  if (stateCity.toLowerCase().includes('ap') || stateCity.toLowerCase().includes('tg')) {
    if (storeName.includes('Guntur')) { state = 'Andhra Pradesh'; city = 'Guntur'; }
    else if (storeName.includes('Tirupati')) { state = 'Andhra Pradesh'; city = 'Tirupati'; }
    else if (storeName.includes('Ongole')) { state = 'Andhra Pradesh'; city = 'Ongole'; }
    else if (storeName.includes('Vizag') || storeName.includes('Visakhapatnam')) { state = 'Andhra Pradesh'; city = 'Visakhapatnam'; }
    else if (storeName.includes('Kakinada')) { state = 'Andhra Pradesh'; city = 'Kakinada'; }
    else if (storeName.includes('Anantapur')) { state = 'Andhra Pradesh'; city = 'Anantapur'; }
    else if (storeName.includes('Eluru')) { state = 'Andhra Pradesh'; city = 'Eluru'; }
    else if (storeName.includes('Nalgonda')) { state = 'Telangana'; city = 'Nalgonda'; }
    else if (storeName.includes('Miryalaguda')) { state = 'Telangana'; city = 'Miryalaguda'; }
    else if (storeName.includes('Mancherial')) { state = 'Telangana'; city = 'Mancherial'; }
    else if (storeName.includes('Nizamabad')) { state = 'Telangana'; city = 'Nizamabad'; }
    else if (storeName.includes('Chanda Nagar') || storeName.includes('Kokapet') || storeName.includes('Hyderabad')) { state = 'Telangana'; city = 'Hyderabad'; }
    else { state = 'Andhra Pradesh'; city = area || 'Andhra Pradesh'; }
  } else if (stateCity.toLowerCase().includes('gujarat')) {
    state = 'Gujarat';
    city = 'Vadodara';
  } else if (storeName.includes('Dombivli')) {
    state = 'Maharashtra';
    city = 'Dombivli';
  }

  const coords = parseCoord(rawLatLng);
  const latitude = coords ? coords.lat : null;
  const longitude = coords ? coords.lng : null;

  stores.push({
    id: `store_${stores.length + 1}`,
    posCode: posCode,
    storeName: storeName,
    storeType: storeType,
    category: 'Retail',
    locationType: 'iPlanet Retail Store',
    brand: 'iPlanet',
    address: fullAddress,
    area: area || null,
    locality: area || null,
    city: city || 'Chennai',
    state: state || 'Tamil Nadu',
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

const outDir = path.join(projectRoot, 'data');
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

fs.writeFileSync(path.join(outDir, 'stores.json'), JSON.stringify(stores, null, 2), 'utf-8');
console.log(`Saved clean stores data to ${path.join(outDir, 'stores.json')}`);
