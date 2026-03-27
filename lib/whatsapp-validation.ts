/**
 * WhatsApp Input Validation
 * Validates user inputs for WhatsApp commands
 */

import { logger } from '@/lib/logger';

/**
 * Validate matchId format
 * @param matchId - Match ID to validate
 * @returns Validation result
 */
export function validateMatchId(matchId: string): {
  valid: boolean;
  error?: string;
  normalized?: string;
} {
  if (!matchId || typeof matchId !== 'string') {
    return {
      valid: false,
      error: 'Match ID is required',
    };
  }

  // Remove whitespace
  const trimmed = matchId.trim();

  if (trimmed.length === 0) {
    return {
      valid: false,
      error: 'Match ID cannot be empty',
    };
  }

  // MatchId should be numeric, 4-10 digits
  if (!/^\d{4,10}$/.test(trimmed)) {
    return {
      valid: false,
      error: 'Match ID must be 4-10 digits',
    };
  }

  return {
    valid: true,
    normalized: trimmed,
  };
}

/**
 * Validate phone number format
 * @param phone - Phone number to validate
 * @returns Validation result
 */
export function validatePhoneNumber(phone: string): {
  valid: boolean;
  error?: string;
  normalized?: string;
} {
  if (!phone || typeof phone !== 'string') {
    return {
      valid: false,
      error: 'Phone number is required',
    };
  }

  // Remove all non-digit characters
  const digits = phone.replace(/\D/g, '');

  // Should be 10-15 digits (E.164 format without +)
  if (digits.length < 10 || digits.length > 15) {
    return {
      valid: false,
      error: 'Phone number must be 10-15 digits',
    };
  }

  return {
    valid: true,
    normalized: digits,
  };
}

/**
 * Check if input looks like a multisport hex event ID (not a numeric soccer match ID).
 * Multisport event IDs are hex hashes like "c61d2594de00eb4d12ba96127dc437e5".
 */
export function isMultisportEventId(input: string): boolean {
  if (!input || typeof input !== 'string') return false
  const trimmed = input.trim()
  // Hex string, 16-64 chars, must contain at least one letter (to distinguish from pure numbers)
  return /^[a-f0-9]{16,64}$/i.test(trimmed) && /[a-f]/i.test(trimmed)
}

/**
 * Validate a multisport event ID format.
 */
export function validateMultisportEventId(eventId: string): {
  valid: boolean
  error?: string
  normalized?: string
} {
  if (!eventId || typeof eventId !== 'string') {
    return { valid: false, error: 'Event ID is required' }
  }
  const trimmed = eventId.trim().toLowerCase()
  if (!isMultisportEventId(trimmed)) {
    return { valid: false, error: 'Event ID must be a 16-64 character hex string' }
  }
  return { valid: true, normalized: trimmed }
}

/**
 * Sanitize user input text
 * @param text - Text to sanitize
 * @returns Sanitized text
 */
export function sanitizeText(text: string): string {
  if (!text || typeof text !== 'string') {
    return '';
  }

  // Remove control characters except newlines and tabs
  return text
    .replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, '')
    .trim()
    .slice(0, 1000); // Limit length
}

