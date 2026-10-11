# Build a Production-Ready Standalone Web Application: iPlanet AI Store Locator

## 1. PROJECT OVERVIEW

Build a modern, production-ready, standalone web-based application called:

**iPlanet AI Store Locator**

The application will help customers find the nearest and most relevant **iPlanet Retail Stores** based on:

* Indian PIN code
* Area
* Locality
* Landmark
* City
* Full address
* Current location, if the user grants browser location permission
* Natural-language queries such as:

  * "iPlanet near Whitefield"
  * "stores near Ashoka Pillar"
  * "iPlanet near me"
  * "nearest iPlanet to 600016"
  * "iPlanet in Coimbatore"
  * "3 stores near HSR"
  * "store near Phoenix Mall"

The application must use:

1. Our internal **iPlanet Retail Store Master Database**
2. Google Maps / Google Places / Google Geocoding / Google Routes APIs where appropriate
3. An intelligent ranking engine
4. A clean customer-facing web UI
5. An admin interface for managing store data

The application must NOT simply search Google for random Apple retailers.

The internal iPlanet database is the source of truth for identifying which locations are actual iPlanet stores.

---

# 2. CORE BUSINESS RULE

IMPORTANT:

The application is specifically an **iPlanet Store Locator**.

When a customer searches for a store:

* First identify the customer's location.
* Then search the internal iPlanet Retail Store database.
* Find the nearest valid iPlanet Retail Stores.
* Use Google APIs to validate/geocode locations and calculate distance/travel time/routes where appropriate.
* Return the best matching iPlanet stores.

Do NOT return:

* Apple Stores
* Other Apple Authorised Resellers
* Unrelated electronics stores
* Random Google Places results

unless they are explicitly present and approved in the internal iPlanet database.

---

# 3. STORE DATABASE

Create a database table called:

`stores`

Recommended fields:

```text
id
pos_code
store_name
store_type
brand
address
area
locality
city
state
country
pincode
landmark
latitude
longitude
phone
contact_person
store_manager
opening_time
closing_time
working_days
google_place_id
google_maps_url
status
priority
created_at
updated_at
```

Example:

```text
POS Code: RMM
Store Name: iPlanet Royal Meenakshi Mall
Store Type: Retail
Brand: iPlanet
Address: Ground Floor, Royal Meenakshi Mall, No. 424/376/487, Bannerghatta Road, Hulimavu, Bengaluru - 560076
Landmark: Royal Meenakshi Mall
City: Bengaluru
State: Karnataka
Pincode: 560076
Latitude: ...
Longitude: ...
Status: Active
```

The database must support bulk upload through:

* CSV
* Excel/XLSX

Create an admin upload screen.

The administrator should be able to upload the Retail Store Master.

---

# 4. POS CODE IS CRITICAL

Every retail store must have a unique:

**POS Code**

The POS Code must always be displayed prominently.

Example:

```text
RMM – iPlanet Royal Meenakshi Mall
```

The application must allow users to search using POS code as well.

Examples:

```text
RMM
NSN
PBZ
KEM
LNK
KAM
RCT
```

If a user searches for a POS code, directly identify the corresponding iPlanet store.

---

# 5. GOOGLE API INTEGRATION

Integrate Google Maps platform APIs.

Use Google services appropriately for:

### A. Geocoding

Convert:

* PIN code
* locality
* area
* landmark
* address
* city

into latitude/longitude.

### B. Places

Use Google Places APIs to:

* validate locations
* identify landmarks
* optionally retrieve Google Place IDs
* enrich store location information where appropriate

Do NOT use Google Places as the primary store database.

### C. Routes / Distance Matrix functionality

Use Google's current supported routing API to calculate:

* driving distance
* estimated travel time
* route information

The system should support:

```text
Distance
Travel Time
Traffic-aware Travel Time
```

where available.

### D. Google Maps

Every store result should contain a clickable Google Maps button.

Example:

```text
Open in Google Maps
```

The button should open the exact store coordinates/location.

---

# 6. API SECURITY

Never expose sensitive Google API credentials in frontend source code.

Use environment variables.

Example:

```env
GOOGLE_MAPS_API_KEY=
GOOGLE_PLACES_API_KEY=
GOOGLE_ROUTES_API_KEY=
DATABASE_URL=
```

If Google allows a single appropriately restricted API key, configure it securely with API restrictions.

Frontend APIs must have appropriate HTTP referrer restrictions.

Backend APIs must use server-side credentials where appropriate.

Never commit API keys to GitHub.

Create:

```text
.env.example
```

with placeholder values.

---

# 7. SEARCH EXPERIENCE

The main page should have a large search box.

Placeholder:

```text
Search by PIN code, area, landmark, city or store code...
```

Examples underneath:

```text
Try: 600016
Try: Whitefield
Try: Ashoka Pillar
Try: RMM
Try: Coimbatore
```

Include a:

**Use My Location**

button.

If location permission is granted, use browser geolocation.

If permission is denied, gracefully fall back to manual search.

---

# 8. NATURAL LANGUAGE SEARCH

The application should understand natural language.

Examples:

```text
nearest iPlanet
```

```text
iPlanet near Whitefield
```

```text
3 stores near HSR
```

```text
store near Phoenix Mall
```

```text
nearest iPlanet to 600016
```

```text
iPlanet stores in Bengaluru
```

```text
show me stores near Ashoka Pillar
```

The search parser should identify:

* location
* PIN code
* city
* landmark
* store code
* requested number of stores
* requested store type
* distance preference

---

# 9. RETAIL VS CARE

This is extremely important.

The application must maintain separate databases/categories for:

### Retail

```text
iPlanet Retail Store
```

### Care

```text
iPlanet Care / Service Centre
```

The default search MUST return:

**iPlanet Retail Stores only.**

Do not mix Care locations into normal retail searches.

If the customer explicitly searches:

```text
iPlanet Care
```

```text
service centre
```

```text
repair centre
```

then search the separate Care database.

Create separate database tables:

```text
retail_stores
care_centres
```

Never merge them.

---

# 10. SEARCH RANKING LOGIC

Create an intelligent ranking system.

Ranking priority should generally be:

### Priority 1 — Exact location match

If the customer provides a store code:

```text
RMM
```

return the exact store.

### Priority 2 — Exact PIN match

If a store is located in the searched PIN:

rank it highly.

### Priority 3 — Locality match

Example:

```text
Whitefield
```

Stores within Whitefield should rank higher.

### Priority 4 — Landmark proximity

Example:

```text
Ashoka Pillar
```

Find the landmark coordinates and rank stores by actual geographic distance.

### Priority 5 — City match

If the customer searches:

```text
Coimbatore
```

return relevant iPlanet stores in/around Coimbatore.

### Priority 6 — Geographic distance

Calculate actual distance between customer location and each candidate store.

### Priority 7 — Travel time

When available, use Google routing information.

---

# 11. NUMBER OF RESULTS

Default:

**3 stores**

For normal location searches, show at least 3 suggestions whenever 3 or more active stores are available.

Example:

```text
Preferred Store
Nearest Store 2
Nearest Store 3
```

If fewer than 3 stores exist, show the available stores and clearly explain that fewer matches were available.

Allow the user to request:

```text
1 store
3 stores
5 stores
10 stores
All stores
```

---

# 12. PREFERRED STORE

The first result should be labelled:

**Preferred / Nearest**

The application should intelligently select the best store based on:

* proximity
* locality match
* route accessibility
* travel time
* store status

Example:

```text
⭐ Preferred Store
```

Then:

```text
Nearest Store 2
Nearest Store 3
```

Do not claim "Preferred" simply because a store is geographically closest if another store is a much better locality match.

---

# 13. EXACT CUSTOMER RESPONSE FORMAT

Every store result must follow this structure.

Example:

```text
POS Code: RMM

⭐ Preferred / Nearest Store
iPlanet Royal Meenakshi Mall

Address:
Ground Floor, Royal Meenakshi Mall,
No. 424/376/487, Bannerghatta Road,
Hulimavu, Bengaluru – 560076

Landmark:
Royal Meenakshi Mall

Approx. Distance:
12.5 km

Travel Time:
32 mins

Traffic:
Moderate traffic

Type:
iPlanet Retail Store

Contact:
XXXXXXXXXX

Store Timings:
10:00 AM – 10:00 PM

Latitude:
12.xxxxxx

Longitude:
77.xxxxxx

[Open in Google Maps]

How to Reach:
Take Bannerghatta Road towards Hulimavu and continue towards Royal Meenakshi Mall. The iPlanet store is located inside the mall.
```

The UI should present these fields cleanly as cards rather than as an unattractive block of text.

---

# 14. REQUIRED STORE CARD

Each result card must display:

### POS Code

Prominent.

### Store Name

Example:

```text
iPlanet Royal Meenakshi Mall
```

### Ranking

```text
1
Preferred / Nearest
```

### Address

Full address.

### Landmark

Clearly separated.

### Distance

Example:

```text
Approx. 8.4 km
```

### Travel Time

Example:

```text
24 mins
```

### Traffic

Example:

```text
Light traffic
```

or:

```text
Moderate traffic
```

or:

```text
Heavy traffic
```

Only display traffic information when reliable/current routing data is available.

### Type

```text
iPlanet Retail Store
```

### Contact

If available.

### Store Timings

If available.

### Latitude / Longitude

If available.

### Google Maps button

```text
📍 Open in Google Maps
```

### Directions

```text
🚗 Get Directions
```

### How to Reach

Short route explanation.

---

# 15. DISTANCE ACCURACY

Never falsely claim exact distance.

If the location is derived from a PIN code rather than an exact customer location, display:

```text
Approx. distance
```

Example:

```text
Approx. 18–20 km
```

If exact coordinates are available, use Google routing/distance data.

If Google routing is unavailable:

```text
Approx. distance based on coordinates
```

Never fabricate:

* distance
* travel time
* traffic
* store details

If data is unavailable, say:

```text
Not available
```

instead of inventing information.

---

# 16. PIN CODE SEARCH

The application must intelligently handle Indian PIN codes.

Example:

```text
600016
```

Process:

1. Validate Indian PIN format.
2. Geocode the PIN.
3. Identify the primary locality.
4. Search nearby iPlanet stores.
5. Calculate distances.
6. Rank stores.
7. Return the top 3.

If the PIN covers multiple areas, mention:

```text
This PIN code covers multiple nearby localities. Results are ranked based on the approximate PIN location.
```

---

# 17. LANDMARK SEARCH

For a landmark search:

Example:

```text
Ashoka Pillar
```

The system should:

1. Search Google location/Places.
2. Obtain coordinates.
3. Search internal iPlanet stores.
4. Calculate geographic distance.
5. Calculate route/travel time where possible.
6. Return the nearest 3 stores.

---

# 18. CURRENT LOCATION

Add:

```text
📍 Use My Location
```

When clicked:

1. Ask for browser location permission.
2. Obtain latitude/longitude.
3. Search nearest iPlanet stores.
4. Calculate routes.
5. Display results.

Do not permanently store the customer's precise location unless explicitly required.

---

# 19. MAP VIEW

Create a Google Map on the results page.

The map should show:

* Customer/search location
* iPlanet stores
* Numbered markers

Example:

```text
1 = Preferred
2 = Nearest
3 = Nearest
```

Clicking a marker should open a store information popup.

Example:

```text
RMM
iPlanet Royal Meenakshi Mall
12.5 km
32 mins

View Store
Get Directions
```

---

# 20. LIST + MAP LAYOUT

Desktop:

```text
---------------------------------------------------------
| Search Bar                                             |
---------------------------------------------------------
| Store Results                 | Google Map             |
|                               |                        |
| 1. Preferred Store            |       📍              |
|    RMM                        |                        |
|    iPlanet Royal...           |   📍        📍         |
|                               |                        |
| 2. Store                      |                        |
|                               |                        |
| 3. Store                      |                        |
---------------------------------------------------------
```

Mobile:

```text
Search

[Use My Location]

Preferred Store
Store Card

Nearest Store
Store Card

Nearest Store
Store Card

[View Map]
```

Make the application fully responsive.

---

# 21. ADMIN DASHBOARD

Create a secure admin section.

Admin features:

### Store Management

* Add store
* Edit store
* Delete/deactivate store
* Search store
* Filter by city/state
* Filter by status
* Search by POS code

### Bulk Import

Upload:

```text
CSV
XLSX
```

### Data validation

Before import:

* Check duplicate POS codes
* Check missing POS codes
* Check invalid PIN codes
* Check missing latitude/longitude
* Check duplicate store records
* Show validation errors

Example:

```text
Import Summary

Total rows: 125
Valid: 119
Errors: 6
Duplicates: 2
```

Allow downloading an error report.

---

# 22. STORE STATUS

Every store must have:

```text
Active
Inactive
Temporarily Closed
Coming Soon
```

Only active stores should normally appear in customer searches.

---

# 23. DATABASE DESIGN

Use a proper relational database.

Recommended:

```text
PostgreSQL
```

Tables:

```text
retail_stores
care_centres
admins
search_logs
api_usage_logs
```

Optional:

```text
store_hours
store_contacts
store_metadata
```

---

# 24. SEARCH LOGGING

Create optional analytics.

Record:

```text
timestamp
search_query
detected_location
search_type
number_of_results
selected_store
response_time
```

Do not store unnecessary personal information.

Admin dashboard should show:

```text
Most searched locations
Most searched PIN codes
Most searched cities
Most selected stores
Search volume
```

---

# 25. UI DESIGN

The application should look like a modern premium retail application.

Design principles:

* Clean
* Minimal
* Professional
* Fast
* Mobile friendly
* White/light interface
* Strong typography
* Clear hierarchy
* Rounded cards
* Subtle shadows
* Accessible buttons
* No unnecessary animations

Use iPlanet branding if appropriate.

Do not copy Apple's website design.

The application should clearly identify itself as:

**iPlanet AI Store Locator**

---

# 26. HOME PAGE

Hero section:

```text
Find Your Nearest iPlanet Store

Search by PIN code, area, landmark or city
```

Search box:

```text
🔍 Search PIN code, locality, landmark or store code
```

Buttons:

```text
Search
📍 Use My Location
```

Below:

```text
Find an iPlanet store near you

Search using:
PIN Code
Area
Landmark
City
Store Code
```

---

# 27. AI RESPONSE

The application can optionally include an AI conversational interface.

Example:

Customer:

```text
I am in Whitefield. Show me 3 nearest iPlanet stores.
```

AI should understand:

```text
location = Whitefield
result_count = 3
store_type = retail
```

Then call the store-search backend.

IMPORTANT:

The AI must NOT independently invent store information.

The AI should always obtain store information from the database/search API.

Architecture:

```text
User
 ↓
AI Query Parser
 ↓
Location Resolver
 ↓
iPlanet Store Search API
 ↓
Google Maps / Routes APIs
 ↓
Ranking Engine
 ↓
Response Formatter
 ↓
Customer
```

---

# 28. BACKEND API

Create REST APIs.

Example:

```http
GET /api/stores/search
```

Parameters:

```text
query
latitude
longitude
pincode
city
limit
storeType
```

Example:

```http
GET /api/stores/search?query=Whitefield&limit=3
```

Response:

```json
{
  "query": "Whitefield",
  "results": [
    {
      "posCode": "XXX",
      "storeName": "iPlanet ...",
      "distanceKm": 5.4,
      "travelTimeMinutes": 18,
      "traffic": "Moderate",
      "latitude": 12.XXXX,
      "longitude": 77.XXXX
    }
  ]
}
```

Additional APIs:

```http
GET /api/stores/:id
GET /api/stores/:posCode
POST /api/admin/stores
PUT /api/admin/stores/:id
DELETE /api/admin/stores/:id
POST /api/admin/import
GET /api/admin/analytics
```

---

# 29. ERROR HANDLING

Handle:

### No results

Display:

```text
Sorry, we couldn't find an iPlanet Retail Store for this location.

Please try another nearby area, PIN code or landmark.
```

### Invalid PIN

```text
Please enter a valid Indian PIN code.
```

### Google API unavailable

The application should still show internal store information.

For example:

```text
Distance and live travel information are temporarily unavailable.
```

Do not fail the entire search.

### Location permission denied

```text
Location access was not enabled. You can search manually using your PIN code, area or landmark.
```

---

# 30. PERFORMANCE

The application should be optimized for speed.

Requirements:

* Cache geocoding results
* Cache store coordinates
* Avoid unnecessary Google API calls
* Only call routing API for shortlisted stores
* Do not call Google Routes for every store in the database
* First perform geographic filtering
* Then route only the top candidates

Example architecture:

```text
10,000 stores
      ↓
Geographic filtering
      ↓
Nearest 20
      ↓
Ranking
      ↓
Top 5
      ↓
Google Routes API
      ↓
Top 3 final results
```

This reduces Google API costs.

---

# 31. GOOGLE API COST CONTROL

Design the system to minimize API usage.

Do NOT call:

```text
Google Places
Google Geocoding
Google Routes
```

unnecessarily.

Store permanent internal coordinates for iPlanet stores after validation.

For example:

```text
POS Code
Latitude
Longitude
Google Place ID
```

should be stored in the database.

For a search:

1. Resolve customer location.
2. Search local database.
3. Calculate straight-line distance internally.
4. Select top candidates.
5. Call Routes API only for shortlisted candidates.
6. Return final ranking.

---

# 32. SECURITY

Implement:

* Authentication for admin
* Password hashing
* Session/token security
* CSRF protection where applicable
* Rate limiting
* Input validation
* SQL injection protection
* XSS protection
* API key protection
* Secure HTTP headers

Never expose admin APIs publicly without authentication.

---

# 33. TECHNOLOGY STACK

Use a modern production-ready stack.

Recommended:

### Frontend

```text
Next.js
React
TypeScript
Tailwind CSS
```

### Backend

Either:

```text
Next.js API routes
```

or:

```text
Node.js
Express
TypeScript
```

### Database

```text
PostgreSQL
```

### ORM

```text
Prisma
```

### Maps

```text
Google Maps Platform
```

### Deployment

Make the application deployment-ready for:

```text
Vercel / AWS / Google Cloud
```

Do not hard-code deployment-specific assumptions.

---

# 34. PROJECT STRUCTURE

Create a clean structure similar to:

```text
iplanet-store-locator/
│
├── app/
│   ├── page.tsx
│   ├── search/
│   ├── store/
│   ├── admin/
│   └── api/
│
├── components/
│   ├── SearchBar
│   ├── StoreCard
│   ├── StoreList
│   ├── StoreMap
│   ├── LocationButton
│   ├── TrafficBadge
│   └── AdminTable
│
├── lib/
│   ├── google/
│   ├── geocoding/
│   ├── routing/
│   ├── ranking/
│   └── search/
│
├── prisma/
│   └── schema.prisma
│
├── public/
│
├── scripts/
│   └── import-stores
│
├── .env.example
├── README.md
└── package.json
```

---

# 35. GOOGLE MAPS LINK

Every store must have a working Google Maps link.

Prefer coordinates when available.

Example concept:

```text
https://www.google.com/maps/search/?api=1&query=LATITUDE,LONGITUDE
```

Generate this dynamically from the store coordinates.

Do not rely only on store names because multiple businesses can have similar names.

---

# 36. HOW TO REACH

Generate a short human-friendly route explanation.

Example:

```text
How to Reach:
From Whitefield, take Whitefield Main Road towards ITPL. Continue towards the mall and follow the Google Maps route to the iPlanet store.
```

Do not generate extremely long navigation instructions.

Provide:

```text
How to Reach
```

plus:

```text
Get Directions
```

for detailed Google navigation.

---

# 37. CUSTOMER-FRIENDLY LANGUAGE

The application should use simple and humble customer-service language.

Avoid technical language.

Instead of:

```text
Geocoding failed.
```

say:

```text
We couldn't identify the exact location. Please try another nearby area or PIN code.
```

Instead of:

```text
No records found.
```

say:

```text
Sorry, we couldn't find an iPlanet store for this location.
```

---

# 38. SEARCH EXAMPLES TO TEST

The application must correctly handle test searches such as:

```text
600016
```

```text
Whitefield
```

```text
Ashoka Pillar
```

```text
RMM
```

```text
Coimbatore
```

```text
Nagarbhavi
```

```text
Malleshwaram
```

```text
400017
```

```text
Malad West
```

```text
iPlanet near Phoenix Mall
```

```text
3 iPlanet stores near HSR
```

```text
nearest iPlanet to 600005
```

---

# 39. DATA QUALITY RULES

The system must validate:

* POS code uniqueness
* Store name
* Address
* PIN code
* City
* State
* Latitude
* Longitude
* Store status

Never create a fake store.

Never infer a POS code.

Never guess a store address.

If information is missing, show:

```text
Not available
```

or allow an administrator to complete it.

---

# 40. FUTURE DEVICE AVAILABILITY FEATURE

Design the architecture so that a future feature can be added:

**Check Product Availability**

Example:

Customer:

```text
I want iPhone 17 Pro in Black. Which iPlanet has stock?
```

Future architecture:

```text
Customer
 ↓
Product Search
 ↓
Inventory API
 ↓
Store Inventory
 ↓
Distance/Travel Time
 ↓
Nearest Store With Stock
```

Do not implement fake inventory data now.

Create the architecture so this can be added later.

---

# 41. FUTURE FEATURES

Keep the system extensible for:

* Product availability
* Store appointment
* Service appointment
* iPlanet Care locator
* Store phone calling
* WhatsApp integration
* Customer feedback
* Store ratings
* Store holiday schedules
* Temporary closure
* Special events
* Product pickup
* Click & collect
* CRM integration

---

# 42. ADMIN DATA IMPORT FORMAT

Support a spreadsheet with columns such as:

```text
POS_CODE
STORE_NAME
STORE_TYPE
ADDRESS
AREA
LOCALITY
CITY
STATE
PINCODE
LANDMARK
LATITUDE
LONGITUDE
PHONE
STORE_MANAGER
OPENING_TIME
CLOSING_TIME
WORKING_DAYS
GOOGLE_PLACE_ID
STATUS
```

Create a sample:

```text
sample-retail-stores.xlsx
```

and document the import format.

---

# 43. SEED DATA

Create a small sample database for development.

Clearly mark it:

```text
DEMO DATA
```

Do not pretend demo records are live production stores.

The production application must allow the actual iPlanet Retail Store Master to be imported.

---

# 44. ADMIN SEARCH

Admin should be able to search:

```text
POS code
Store name
City
State
PIN code
Area
Status
```

Example:

```text
Search: RMM
```

returns:

```text
RMM – iPlanet Royal Meenakshi Mall
```

---

# 45. MOBILE UX

The application must work properly on:

* Desktop
* Laptop
* Tablet
* Android
* iPhone

Mobile search should be extremely simple.

Top:

```text
Find an iPlanet Store
```

Search field.

Then:

```text
Use My Location
```

Then store cards.

Map can be opened using:

```text
View Map
```

---

# 46. ACCESSIBILITY

Implement:

* Keyboard navigation
* Accessible labels
* Proper contrast
* Screen-reader friendly controls
* Focus states
* Large touch targets
* Semantic HTML

---

# 47. SEO

Create SEO-friendly metadata:

```text
Title:
iPlanet AI Store Locator – Find Your Nearest iPlanet Store

Description:
Find the nearest iPlanet Retail Store by PIN code, area, landmark or city.
```

Create clean URLs where appropriate.

---

# 48. ANALYTICS

Add optional analytics architecture.

Track:

```text
Searches
Successful searches
No-result searches
Most searched PIN codes
Most searched cities
Most selected stores
Google Maps clicks
Get Directions clicks
```

Do not collect unnecessary personal information.

---

# 49. IMPORTANT SOURCE-OF-TRUTH RULE

The hierarchy must be:

```text
iPlanet Store Database
        ↓
Primary source for store identity
        ↓
Google Maps / Google APIs
        ↓
Location validation
Distance
Travel time
Traffic
Navigation
```

Google should NOT decide which businesses are iPlanet stores.

Our internal database decides that.

---

# 50. AI SAFETY / HALLUCINATION CONTROL

If AI is used, enforce:

```text
The AI is not allowed to invent store names,
POS codes, addresses, phone numbers,
timings, distances or travel times.
```

All factual store information must come from:

```text
Database
+
Google API response
```

If data cannot be verified:

```text
Not available
```

---

# 51. FINAL RESPONSE FORMAT

For a search such as:

```text
Whitefield
```

the customer-facing result should look approximately like:

```text
Found 3 iPlanet Retail Stores near Whitefield.

⭐ 1. Preferred / Nearest

POS Code: XXX
iPlanet [Store Name]

Address:
[Full Address]

Landmark:
[Landmark]

Approx. Distance:
[X.X km]

Travel Time:
[XX mins]

Traffic:
[Light / Moderate / Heavy]

Type:
iPlanet Retail Store

Contact:
[Phone]

Store Timings:
[Timings]

Latitude:
[Latitude]

Longitude:
[Longitude]

[📍 Open in Google Maps]

[🚗 Get Directions]

How to Reach:
[Short route guidance]
```

Then:

```text
2. Nearest Store
```

and:

```text
3. Nearest Store
```

---

# 52. IMPORTANT: DO NOT MIX RETAIL AND CARE

Normal request:

```text
nearest iPlanet
```

means:

```text
iPlanet Retail Store
```

Request:

```text
nearest iPlanet Care
```

means:

```text
iPlanet Care / Service Centre
```

Keep the datasets and search logic separate.

---

# 53. DELIVERABLES

Build the complete application, not just a prototype screen.

Deliver:

1. Full source code
2. Database schema
3. Prisma schema/migrations
4. Frontend
5. Backend APIs
6. Google Maps integration
7. Search/ranking engine
8. Admin dashboard
9. CSV/XLSX import
10. Demo data
11. `.env.example`
12. README
13. Local development instructions
14. Production deployment instructions
15. API documentation
16. Error handling
17. Responsive UI
18. Security configuration

---

# 54. CLAUDE DEVELOPMENT INSTRUCTIONS

Do not stop after creating a UI mockup.

Build the actual working application.

When an API key is required:

* create the integration
* use environment variables
* document exactly where the key must be added
* do not put secrets in source code

When a database is required:

* create the schema
* create migrations
* create seed/demo data
* create import functionality

When Google APIs are required:

* create a clean service abstraction such as:

```text
GoogleGeocodingService
GooglePlacesService
GoogleRoutesService
GoogleMapsService
```

Do not scatter Google API calls throughout React components.

Use backend services.

---

# 55. ARCHITECTURE

Use this high-level architecture:

```text
                    CUSTOMER
                       │
                       ▼
              ┌─────────────────┐
              │   Web Frontend  │
              │ Next.js/React   │
              └────────┬────────┘
                       │
                       ▼
              ┌─────────────────┐
              │ Search API      │
              │ Query Parser    │
              └────────┬────────┘
                       │
             ┌─────────┴─────────┐
             ▼                   ▼
     ┌──────────────┐    ┌───────────────┐
     │ iPlanet DB   │    │ Google APIs   │
     │ Store Master │    │ Maps/Places   │
     └──────┬───────┘    │ Routes/Geo    │
            │            └───────┬───────┘
            └──────────┬─────────┘
                       ▼
              ┌─────────────────┐
              │ Ranking Engine  │
              └────────┬────────┘
                       ▼
              ┌─────────────────┐
              │ Store Formatter │
              └────────┬────────┘
                       ▼
                CUSTOMER RESULTS
```

---

# 56. DEVELOPMENT PHASES

Build in these phases.

### Phase 1

Create:

* Next.js application
* TypeScript
* Tailwind
* Database
* Store schema
* Demo data

### Phase 2

Create:

* Search engine
* PIN search
* Area search
* City search
* Landmark search
* POS search

### Phase 3

Integrate:

* Google Geocoding
* Google Places
* Google Maps
* Google Routes

### Phase 4

Create:

* Distance
* Travel time
* Traffic
* Ranking

### Phase 5

Create:

* Map interface
* Store cards
* Google Maps links
* Directions

### Phase 6

Create:

* Admin dashboard
* CSV/XLSX import
* Store management

### Phase 7

Add:

* AI natural-language search
* Query parser
* Analytics
* Error handling

### Phase 8

Production hardening:

* Security
* Performance
* API cost optimization
* Responsive testing
* Accessibility
* Deployment documentation

---

# 57. ACCEPTANCE CRITERIA

The project is complete only when these scenarios work.

### Scenario 1

Input:

```text
600016
```

Expected:

* Resolve PIN
* Find iPlanet stores
* Show minimum 3 where available
* Rank by proximity
* Show distance
* Show travel time
* Show traffic where available
* Show POS code
* Show address
* Show landmark
* Show Google Maps
* Show latitude/longitude

### Scenario 2

Input:

```text
Whitefield
```

Expected:

* Resolve Whitefield
* Find iPlanet stores
* Rank nearest
* Return 3 stores

### Scenario 3

Input:

```text
RMM
```

Expected:

* Directly identify POS RMM
* Show exact store

### Scenario 4

Input:

```text
iPlanet near Ashoka Pillar
```

Expected:

* Resolve landmark
* Search internal iPlanet database
* Rank geographically
* Return 3 stores

### Scenario 5

Input:

```text
iPlanet Care near Powai
```

Expected:

* Switch to Care database
* Do NOT return ordinary retail stores unless clearly labelled separately.

### Scenario 6

Input:

```text
random unknown location
```

Expected:

* Friendly no-result response
* Suggest nearby search options

---

# 58. FINAL INSTRUCTION TO CLAUDE

Treat this as a real production software project for an enterprise retail locator.

Do not simplify the requirements into a basic map demo.

The most important principles are:

1. **Internal iPlanet Retail Store Master is the source of truth.**
2. **POS Code must always be shown.**
3. **Default search is iPlanet Retail Store only.**
4. **iPlanet Care must use a separate database.**
5. **Google APIs are used for location intelligence, routing and navigation—not to replace the iPlanet store database.**
6. **Return at least 3 store suggestions whenever 3 valid stores are available.**
7. **Show Preferred/Nearest ranking.**
8. **Show Address.**
9. **Show Landmark.**
10. **Show Approx. Distance.**
11. **Show Travel Time.**
12. **Show Traffic when reliable data is available.**
13. **Show Type.**
14. **Show Contact when available.**
15. **Show Store Timings when available.**
16. **Show Latitude and Longitude when available.**
17. **Provide Google Maps and Directions buttons.**
18. **Provide simple How to Reach guidance.**
19. **Never hallucinate store information.**
20. **Never expose API keys.**
21. **Optimize Google API usage to control cost.**
22. **Build the application so future inventory/product availability can be integrated.**

Start by creating the project architecture and database schema, then implement the application phase by phase.

Before considering the project complete, test all acceptance scenarios above and ensure the application is actually functional rather than only visually complete.
