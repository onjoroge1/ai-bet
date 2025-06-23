export type PriceBucket =
  | 'basic'    // basic tips
  | 'premium'; // premium tips

export type LocalPrices = Record<string, Record<PriceBucket, number>>;

/**
 * Local price table keyed by ISO‑2 country codes. All values are plain numbers
 * (no currency symbols, no thousands separators) already expressed in the
 * *local* currency that the UI will display.
 */
export const LOCAL_PRICES: LocalPrices = {
  // Kenya – Kenyan Shilling (KES)
  KE: { basic: 1300, premium: 3250 },

  // Nigeria – Nigerian Naira (NGN)
  NG: { basic: 15000, premium: 37500 },

  // South Africa – South African Rand (ZAR)
  ZA: { basic: 180, premium: 450 },

  // Uganda – Ugandan Shilling (UGX)
  UG: { basic: 3800, premium: 9500 },

  // Tanzania – Tanzanian Shilling (TZS)
  TZ: { basic: 2600, premium: 6500 },

  // United States – U.S. Dollar (USD) – acts as default/fallback
  US: { basic: 10, premium: 25 },
};

/**
 * Returns the full price table for a given country or US fallback.
 */
export function getLocalPriceTable(countryCode: string): Record<PriceBucket, number> {
  const code = countryCode.toUpperCase();
  return LOCAL_PRICES[code] ?? LOCAL_PRICES.US;
}

/**
 * Returns the numeric price for one bucket (already in the local currency).
 */
export function getLocalPrice(countryCode: string, bucket: PriceBucket): number {
  return getLocalPriceTable(countryCode)[bucket];
}

/**
 * Loads local prices from CSV file and caches them in memory
 * @returns Map of country codes to their local prices
 */
export function loadLocalPrices(): LocalPrices {
  return LOCAL_PRICES;
}

/**
 * Converts country names to their ISO codes
 */
function countryNameToCode(name: string): string {
  const codeMap: Record<string, string> = {
    'Kenya': 'KE',
    'Nigeria': 'NG',
    'Uganda': 'UG',
    'South Africa': 'ZA',
    'Tanzania': 'TZ',
    'Ghana': 'GH',
    'United States': 'US'
  };
  
  return codeMap[name] ?? 'US';
} 