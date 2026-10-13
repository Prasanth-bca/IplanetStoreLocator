# 🗺️ Ola Maps Integration - iPlanet Store Locator

## ✅ Integration Complete

Ola Maps has been successfully integrated into the iPlanet AI Store Locator as the **primary mapping & routing provider**, with automatic fallback to Google Maps and built-in free services.

---

## 📦 What Was Added

### 1. **New Module: `lib/olaMaps.ts`**
   - **Distance Matrix API** - Get real distance and travel time between locations
   - **Geocoding API** - Convert location names/addresses to coordinates
   - Comprehensive error handling and timeouts
   - Full TypeScript support

### 2. **Updated: `lib/routing.ts`**
   - Ola Maps Distance Matrix as **Priority 1** (Primary)
   - Google Maps as **Priority 2** (Fallback)
   - Internal Haversine as **Priority 3** (Always available)

### 3. **Updated: `lib/locationResolver.ts`**
   - Ola Maps Geocoding as **Priority 2** (after PIN code resolution)
   - Maintains all existing fallback strategies

### 4. **Configuration Files**
   - `.env` - Development configuration with Ola Maps API key placeholder
   - `.env.example` - Updated with Ola Maps documentation
   - `README.md` - Added Ola Maps setup instructions

---

## 🚀 Smart API Priority System

The application automatically selects the best available API:

```
User Search Query
    ↓
┌─────────────────────────────────────┐
│  LOCATION RESOLUTION (Geocoding)    │
├─────────────────────────────────────┤
│ 1. PIN Code (India Postal API) ✅   │ FREE
│ 2. Ola Maps Geocoding              │ FREE (100k/month)
│ 3. Google Maps Geocoding           │ PAID
│ 4. OpenStreetMap Nominatim         │ FREE
└─────────────────────────────────────┘
    ↓
┌─────────────────────────────────────┐
│ DISTANCE & ROUTING CALCULATION      │
├─────────────────────────────────────┤
│ 1. Ola Maps Distance Matrix         │ FREE (100k/month)
│ 2. Google Distance Matrix           │ PAID
│ 3. Internal Haversine + Estimation  │ FREE
└─────────────────────────────────────┘
    ↓
Store Rankings Displayed
```

---

## 💰 Cost Comparison

| Provider | Free Tier | Cost After | Setup |
|----------|-----------|-----------|-------|
| **Ola Maps** | 100k calls/month | ₹ varies | 5 min |
| Google Maps | ❌ None | $$ expensive | Complex |
| Built-in | ✅ Unlimited | ✅ Free | None |

**For typical store locator usage:**
- 100k monthly calls ≈ 3,300 searches/day
- Small-medium deployments stay within free tier indefinitely

---

## 🔧 Setup Instructions

### Step 1: Get Ola Maps API Key (2 minutes)

1. Visit [maps.olakrutrim.com](https://maps.olakrutrim.com)
2. Sign up for free account
3. Create a new project
4. Generate API key

### Step 2: Configure Environment

```bash
# Edit .env file
OLA_MAPS_API_KEY=your_api_key_here
```

### Step 3: Restart App

```bash
npm run dev
```

That's it! 🎉 The app will automatically use Ola Maps for all distance and routing queries.

---

## 📊 How It Works

### Distance Matrix Flow
```typescript
// Example: Finding stores near PIN 600016

calculateRoute(userLat, userLng, storeLat, storeLng)
  ↓
if (OLA_MAPS_API_KEY) {
  → Call Ola Maps Distance Matrix API
  → Get real distance & travel time
  ✓ Returns: 18.4 km, 49 minutes
}
else {
  → Fall back to Google Maps (if key exists)
  → Fall back to Haversine + estimation
}
```

### Geocoding Flow
```typescript
// Example: Searching "Whitefield"

resolveLocation("Whitefield")
  ↓
if (isPinCode("600016")) {
  → Use India Postal API
}
else if (OLA_MAPS_API_KEY) {
  → Call Ola Maps Autocomplete
  → Get coordinates
}
else if (GOOGLE_MAPS_API_KEY) {
  → Fall back to Google
}
else {
  → Use OpenStreetMap Nominatim
}
```

---

## 🧪 Testing the Integration

### Test 1: Verify Ola Maps is Active
```bash
# Check .env has your key
grep OLA_MAPS_API_KEY .env

# Restart server
npm run dev
```

### Test 2: Search with PIN Code
1. Open http://localhost:3000
2. Click on "600016" (Chennai PIN)
3. Check distance/time values
4. Open browser DevTools → Console
5. Look for "Ola Maps Distance Matrix" logs

### Test 3: Search with Landmark
1. Type "Whitefield" in search box
2. View results
3. Check server logs for Ola Maps geocoding calls

### Test 4: Verify Fallback Works
1. Temporarily rename `.env` to `.env.bak`
2. Restart app
3. Perform search
4. App should still work with Haversine + Nominatim
5. Results will show estimated times instead of real traffic

---

## 📁 File Structure

```
lib/
├── olaMaps.ts              ← NEW: Ola Maps API wrapper
├── routing.ts              ← UPDATED: Added Ola Maps priority
├── locationResolver.ts     ← UPDATED: Added Ola Maps geocoding
├── storeSearchEngine.ts    ← Unchanged
├── searchParser.ts         ← Unchanged
└── ...

.env                        ← NEW: Your configuration
.env.example                ← UPDATED: Ola Maps docs
README.md                   ← UPDATED: Setup guide
```

---

## 🔄 API Response Examples

### Ola Maps Distance Matrix Response
```json
{
  "code": "Ok",
  "data": {
    "rows": [
      {
        "elements": [
          {
            "status": "Ok",
            "distance": 18400,      // in meters
            "duration": 2940,       // in seconds
            "duration_in_traffic": 2940
          }
        ]
      }
    ]
  }
}

// Converted to app format:
{
  distance_km: 18.4,
  duration_minutes: 49,
  isRealData: true
}
```

### Ola Maps Geocoding Response
```json
{
  "predictions": [
    {
      "place_id": "abc123",
      "main_text": "Whitefield",
      "description": "Whitefield, Bengaluru, Karnataka, India",
      "geometry": {
        "location": {
          "lat": 13.035,
          "lng": 77.649
        }
      }
    }
  ]
}
```

---

## ⚠️ Rate Limits & Quotas

### Ola Maps Free Tier
- **Monthly quota**: 100,000 API calls
- **Daily limit**: ~3,300 calls
- **Reset**: Monthly (automated)

### Usage Estimation
- **Per search**: 2-3 API calls (1 geocode + 1-2 distance calls)
- **Monthly capacity**: ~30,000-50,000 searches
- **Typical usage**: Well within free tier

---

## 🐛 Troubleshooting

### Issue: Getting 404 Not Found errors

**Solution:**
```bash
# Ensure Ola Maps key is correct
echo $OLA_MAPS_API_KEY

# Restart server
npm run dev
```

### Issue: Slow response times

**Cause:** Ola Maps API timeout or network issue

**Solution:**
- Check internet connection
- Verify API key is valid
- Server will automatically fallback to Google Maps or Haversine

### Issue: Results still using old API

**Solution:**
```bash
# Clear Next.js cache
rm -rf .next/

# Restart
npm run dev
```

---

## 📈 Monitoring API Usage

Ola Maps provides a dashboard at [maps.olakrutrim.com](https://maps.olakrutrim.com):

1. Log in to your account
2. Navigate to "API Usage"
3. View:
   - Daily API calls
   - Monthly quota remaining
   - Error rates
   - Response times

---

## 🔐 Security Notes

- ✅ API key stored in `.env` (not committed to git)
- ✅ Requests from server-side only (no key exposed to frontend)
- ✅ Timeout: 5 seconds (prevents hangs)
- ✅ Error handling: Graceful fallback on failures

---

## 📚 Additional Resources

- **Ola Maps Docs**: https://maps.olakrutrim.com
- **Distance Matrix API**: Docs at Ola Maps console
- **Geocoding API**: Docs at Ola Maps console
- **Pricing**: https://maps.olakrutrim.com/pricing

---

## ✨ Key Benefits

1. **100% FREE** for typical usage
2. **India-optimized** (location and routing accuracy)
3. **Zero setup required** - works out of box with Haversine
4. **Automatic fallback** - never breaks, always responds
5. **Transparent** - logging shows which API is used
6. **Production-ready** - timeout handling and error recovery

---

## 🎯 What's Next?

1. ✅ Get Ola Maps API key
2. ✅ Add to `.env`
3. ✅ Test with real searches
4. ✅ Monitor usage dashboard
5. ✅ Deploy to production

**The app is ready to go!** 🚀
