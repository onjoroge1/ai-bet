/**
 * PesaPal Payment Gateway Implementation
 */

import { 
  submitPesaPalOrder, 
  getPesaPalTransactionStatus 
} from '@/lib/pesapal-service';
import { PaymentGateway, PaymentSessionResult, PaymentSessionParams } from './payment-gateway';
import { logger } from '@/lib/logger';

const BASE_URL = process.env.NEXTAUTH_URL || 'http://localhost:3000';

export class PesaPalGateway implements PaymentGateway {
  async createPaymentSession(params: PaymentSessionParams): Promise<PaymentSessionResult> {
    try {
      // Generate unique merchant reference
      const merchantReference = `WA_${Date.now()}_${params.metadata.waId || 'unknown'}`;

      // Extract billing info from metadata if available
      const billingAddress = params.metadata.email ? {
        email_address: params.metadata.email,
        phone_number: params.metadata.phoneNumber,
        country_code: params.metadata.countryCode || 'KE',
        first_name: params.metadata.firstName,
        last_name: params.metadata.lastName,
      } : undefined;

      // Submit order to PesaPal
      const orderResult = await submitPesaPalOrder({
        id: merchantReference,
        currency: params.currency,
        amount: params.amount,
        description: params.description,
        callback_url: params.successUrl,
        redirect_mode: 'parent_window', // For WhatsApp webview
        notification_id: '', // Can be configured if using IPN
        billing_address: billingAddress,
      });

      logger.info('PesaPal payment session created', {
        orderTrackingId: orderResult.orderTrackingId,
        merchantReference: orderResult.merchantReference,
        amount: params.amount,
        currency: params.currency,
      });

      return {
        paymentUrl: orderResult.redirectUrl,
        sessionId: orderResult.orderTrackingId,
        merchantReference: orderResult.merchantReference,
      };
    } catch (error) {
      logger.error('Error creating PesaPal payment session', {
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
      const transactionStatus = await getPesaPalTransactionStatus(sessionId);

      // Map PesaPal status to our status
      let status: 'completed' | 'pending' | 'failed' | 'canceled' = 'pending';
      
      // PesaPal status codes: COMPLETED, PENDING, FAILED, INVALID
      if (transactionStatus.status === 'COMPLETED') {
        status = 'completed';
      } else if (transactionStatus.status === 'PENDING') {
        status = 'pending';
      } else if (transactionStatus.status === 'FAILED' || transactionStatus.status === 'INVALID') {
        status = 'failed';
      }

      return {
        status,
        transactionId: transactionStatus.confirmation_code || transactionStatus.order_tracking_id,
        amount: transactionStatus.amount,
        currency: transactionStatus.currency,
      };
    } catch (error) {
      logger.error('Error verifying PesaPal payment', {
        error: error instanceof Error ? error.message : undefined,
        sessionId,
      });
      throw error;
    }
  }
}

