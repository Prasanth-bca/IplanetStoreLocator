import { ParsedQuery } from '@/types/store';

export function parseNaturalQuery(query: string): ParsedQuery {
  const clean = query.trim();
  const lower = clean.toLowerCase();

  // 1. Detect Care vs Retail intent
  const careTerms = ['care', 'service', 'service centre', 'service center', 'repair', 'repair centre', 'battery', 'screen replacement'];
  const isCareIntent = careTerms.some(term => lower.includes(term));

  // 2. Detect requested number of stores (e.g. "3 stores near HSR", "5 nearest", "1 store")
  let requestedCount = 3;
  const countMatch = lower.match(/\b(\d+)\s*(?:stores?|locations?|options?|results?)?\b/);
  if (countMatch && parseInt(countMatch[1]) > 0) {
    // Only accept reasonable numbers 1-20
    const parsed = parseInt(countMatch[1]);
    if (parsed >= 1 && parsed <= 20) {
      requestedCount = parsed;
    }
  }

  // 3. Detect 6-digit Indian PIN code
  const pinMatch = clean.match(/\b([1-9][0-9]{5})\b/);
  const pincodeMatch = pinMatch ? pinMatch[1] : undefined;

  // 4. Extract possible POS Code (POS codes in iPlanet are alphanumeric 3-6 chars like RMM, PBZ1, IND 1, CBE1, MGP1)
  // Check if raw query looks like a POS code or includes "pos code: XXX"
  let posCodeMatch: string | undefined = undefined;
  const directPos = clean.replace(/^(pos code|pos|code)\s*[:=-]?\s*/i, '').trim();
  if (/^[a-zA-Z]{2,4}\s*\d?$/i.test(directPos) && directPos.length <= 6) {
    posCodeMatch = directPos.toUpperCase();
  }

  // 5. Clean query to isolate the location keyword
  let locationKeyword = clean;
  // Remove filler words
  locationKeyword = locationKeyword
    .replace(/\b(iplanet|stores?|retail|care|service centre|service center|nearest|near to|near|closest|in|at|to|show me|find|give me|\d+\s*(?:stores?|locations?)?)\b/gi, ' ')
    .replace(/[?,!.]/g, '')
    .trim();

  // If location keyword became empty, fallback to the cleaned input
  if (!locationKeyword) {
    locationKeyword = clean;
  }

  return {
    raw: clean,
    isCareIntent,
    posCodeMatch,
    pincodeMatch,
    requestedCount,
    locationKeyword
  };
}
