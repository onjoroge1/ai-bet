/**
 * Stripe Payment Gateway Implementation
 */

import { stripe, formatAmountForStripe, getStripeCurrency } from '@/lib/stripe-server';
import { PaymentGateway, PaymentSessionResult, PaymentSessionParams } from './payment-gateway';
import { logger } from '@/lib/logger';

export class StripeGateway implements PaymentGateway {
  async createPaymentSession(params: PaymentSessionParams): Promise<PaymentSessionResult> {
    try {
      const session = await stripe.checkout.sessions.create({
        mode: 'payment',
        line_items: [
          {
            price_data: {
              currency: getStripeCurrency(params.currency),
              product_data: {
                name: params.description,
              },
              unit_amount: formatAmountForStripe(params.amount, params.currency),
            },
            quantity: 1,
          },
        ],
        metadata: params.metadata,
        success_url: params.successUrl,
        cancel_url: params.cancelUrl,
        expires_at: params.expiresAt || Math.floor(Date.now() / 1000) + 30 * 60, // 30 minutes default
      });

      logger.info('Stripe payment session created', {
        sessionId: session.id,
        amount: params.amount,
        currency: params.currency,
      });

      return {
        paymentUrl: session.url || params.successUrl,
        sessionId: session.id,
      };
    } catch (error) {
      logger.error('Error creating Stripe payment session', {
        error: error instanceof Error ? error.message : undefined,
        params: {
          amount: params.amount,
          currency: params.currency,
        },
      });
      throw error;
    }
  }

  async verifyPayment(sessionId: string): Promise<{
    status: 'completed' | 'pending' | 'failed' | 'canceled';
    transactionId?: string;
    amount?: number;
    currency?: string;
  }> {
    try {
      const session = await stripe.checkout.sessions.retrieve(sessionId);

      let status: 'completed' | 'pending' | 'failed' | 'canceled' = 'pending';
      
      if (session.payment_status === 'paid') {
        status = 'completed';
      } else if (session.status === 'expired' || session.status === 'open') {
        status = 'pending';
      } else if (session.status === 'complete') {
        // Status is complete should mean payment_status is paid, but handle edge case
        status = 'completed';
      } else if (session.payment_status === 'unpaid' || session.payment_status === 'no_payment_required') {
        status = 'failed';
      }

      return {
        status,
        transactionId: session.payment_intent as string | undefined,
        amount: session.amount_total ? session.amount_total / 100 : undefined,
        currency: session.currency?.toUpperCase(),
      };
    } catch (error) {
      logger.error('Error verifying Stripe payment', {
        error: error instanceof Error ? error.message : undefined,
        sessionId,
      });
      throw error;
    }
  }
}

