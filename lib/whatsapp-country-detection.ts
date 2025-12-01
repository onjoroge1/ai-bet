/**
 * WhatsApp Country Detection
 * Detects user's country from WhatsApp phone number (waId)
 */

import { COUNTRIES } from "@/lib/countries";
import { logger } from "@/lib/logger";

/**
 * Phone code to country code mapping
 * Based on common country codes from lib/countries.ts
 */
const PHONE_CODE_TO_COUNTRY: Record<string, string> = {
  "1": "US", // US/Canada (default to US)
  "44": "GB", // UK
  "234": "NG", // Nigeria
  "254": "KE", // Kenya
  "27": "ZA", // South Africa
  "233": "GH", // Ghana
  "256": "UG", // Uganda
  "255": "TZ", // Tanzania
  "91": "IN", // India
  "63": "PH", // Philippines
  "61": "AU", // Australia
  "49": "DE", // Germany
  "33": "FR", // France
  "39": "IT", // Italy
  "34": "ES", // Spain
  "55": "BR", // Brazil
  "52": "MX", // Mexico
  // Add more as needed
};

/**
 * Detect country code from WhatsApp phone number (waId)
 * @param waId - WhatsApp number in E.164 format without + (e.g., "16783929144")
 * @returns Country code (e.g., "US", "KE") or null if cannot detect
 */
export function detectCountryFromPhoneNumber(waId: string): string | null {
  try {
    // Remove any non-digit characters
    const digits = waId.replace(/\D/g, "");

    if (!digits || digits.length < 10) {
      return null;
    }

    // Try to match country codes (1-3 digits)
    // Start with longest codes first (3 digits, then 2, then 1)
    for (let length = 3; length >= 1; length--) {
      const code = digits.substring(0, length);
      const countryCode = PHONE_CODE_TO_COUNTRY[code];
      
      if (countryCode) {
        logger.debug("Detected country from phone number", {
          waId,
          phoneCode: code,
          countryCode,
        });
        return countryCode;
      }
    }

    // Default: if starts with 1 and is 11 digits, likely US/Canada
    if (digits.startsWith("1") && digits.length === 11) {
      return "US";
    }

    return null;
  } catch (error) {
    logger.warn("Error detecting country from phone number", {
      waId,
      error: error instanceof Error ? error : undefined,
    });
    return null;
  }
}

/**
 * Get country code with fallback
 * @param waId - WhatsApp number
 * @param fallback - Default country code if detection fails
 * @returns Country code
 */
export function getCountryCodeFromPhone(waId: string, fallback: string = "US"): string {
  return detectCountryFromPhoneNumber(waId) || fallback;
}

