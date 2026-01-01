/**
 * Payment Gateway Factory
 * 
 * Creates appropriate payment gateway based on country code
 */

import { PaymentGateway, PaymentGatewayType } from './payment-gateway';
import { StripeGateway } from './stripe-gateway';
import { PesaPalGateway } from './pesapal-gateway';

/**
 * Create payment gateway based on country code
 * - Kenya (KE): PesaPal
 * - All others: Stripe
 */
export function createPaymentGateway(countryCode: string): PaymentGateway {
  const normalizedCode = countryCode.toUpperCase().trim();

  // Kenyan users use PesaPal
  if (normalizedCode === 'KE') {
    return new PesaPalGateway();
  }

  // All other users use Stripe (default)
  return new StripeGateway();
}

/**
 * Get payment gateway type for country
 */
export function getPaymentGatewayType(countryCode: string): PaymentGatewayType {
  const normalizedCode = countryCode.toUpperCase().trim();
  return normalizedCode === 'KE' ? PaymentGatewayType.PESAPAL : PaymentGatewayType.STRIPE;
}

