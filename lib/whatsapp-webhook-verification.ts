/**
 * WhatsApp Webhook Signature Verification
 * Verifies X-Hub-Signature-256 header from Meta
 */

import crypto from 'crypto';
import { logger } from '@/lib/logger';

const APP_SECRET = process.env.WHATSAPP_APP_SECRET;

/**
 * Verify webhook signature from Meta
 * @param payload - Raw request body
 * @param signature - X-Hub-Signature-256 header value
 * @returns True if signature is valid
 */
export function verifyWhatsAppWebhookSignature(
  payload: string | Buffer,
  signature: string | null
): boolean {
  if (!APP_SECRET) {
    logger.warn('WhatsApp APP_SECRET not configured, skipping signature verification');
    // In development, allow requests without signature if secret not set
    return process.env.NODE_ENV === 'development';
  }

  if (!signature) {
    logger.warn('WhatsApp webhook signature missing');
    return false;
  }

  try {
    // Meta sends signature as: sha256=<hash>
    const expectedSignature = signature.replace('sha256=', '');

    // Create HMAC SHA256 hash
    const hmac = crypto.createHmac('sha256', APP_SECRET);
    const payloadBuffer = typeof payload === 'string' ? Buffer.from(payload) : payload;
    hmac.update(payloadBuffer);
    const calculatedSignature = hmac.digest('hex');

    // Compare signatures (constant-time comparison to prevent timing attacks)
    const isValid = crypto.timingSafeEqual(
      Buffer.from(expectedSignature, 'hex'),
      Buffer.from(calculatedSignature, 'hex')
    );

    if (!isValid) {
      logger.warn('WhatsApp webhook signature verification failed', {
        expected: expectedSignature.substring(0, 10) + '...',
        calculated: calculatedSignature.substring(0, 10) + '...',
      });
    }

    return isValid;
  } catch (error) {
    logger.error('Error verifying WhatsApp webhook signature', {
      error: error instanceof Error ? error : undefined,
    });
    return false;
  }
}

