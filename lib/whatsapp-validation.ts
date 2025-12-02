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

