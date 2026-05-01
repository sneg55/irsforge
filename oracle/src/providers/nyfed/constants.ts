export const NYFED_API_BASE = 'https://markets.newyorkfed.org/api/rates/secured'
export const NYFED_SOFR_LATEST = `${NYFED_API_BASE}/sofr/last/1.json`
export const NYFED_ALL_RATES = `${NYFED_API_BASE}/all/search.json`

// Rate-family identifiers (SOFR_INDEX_RATE_ID, SOFR_TENOR_RATE_IDS,
// SOFR_TENOR_DAYS, …) moved to oracle/src/shared/generated/rate-families.ts,
// codegen'd from shared-config rateFamilies YAML. Import from there.
