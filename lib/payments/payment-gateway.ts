/**
 * Payment Gateway Interface
 * 
 * Abstraction layer for different payment gateways (Stripe, PesaPal, etc.)
 */

export interface PaymentSessionResult {
  paymentUrl: string;
  sessionId: string; // Stripe session ID or PesaPal order tracking ID
  merchantReference?: string; // PesaPal merchant reference
}

export interface PaymentSessionParams {
  amount: number;
  currency: string;
  description: string;
  metadata: Record<string, string>;
  successUrl: string;
  cancelUrl: string;
  expiresAt?: number; // Unix timestamp
}

export interface PaymentGateway {
  /**
   * Create a payment session
   */
  createPaymentSession(params: PaymentSessionParams): Promise<PaymentSessionResult>;

  /**
   * Verify payment status
   */
  verifyPayment(sessionId: string): Promise<{
    status: 'completed' | 'pending' | 'failed' | 'canceled';
    transactionId?: string;
    amount?: number;
    currency?: string;
  }>;
}

export enum PaymentGatewayType {
  STRIPE = 'stripe',
  PESAPAL = 'pesapal',
}

