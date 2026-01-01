/**
 * PesaPal Payment Service
 * 
 * Handles PesaPal API communication for payment processing
 * Documentation: https://developer.pesapal.com/
 */

import crypto from 'crypto';
import { logger } from './logger';

const PESAPAL_API_URL = process.env.PESAPAL_ENVIRONMENT === 'live' 
  ? 'https://pay.pesapal.com/v3' 
  : 'https://cybqa.pesapal.com/pesapalv3';

const CONSUMER_KEY = process.env.PESAPAL_CONSUMER_KEY || 'wcBXN5ORIxwZDmdTF3wC2i2+kEA5ZV9m';
const CONSUMER_SECRET = process.env.PESAPAL_CONSUMER_SECRET || 'Le1FzDPw2DPjPghz0eDsn1k+MrM=';

interface PesaPalAccessTokenResponse {
  token: string;
  expiry_date: string;
}

interface PesaPalOrderRequest {
  id: string; // Merchant reference (unique order ID)
  currency: string; // ISO currency code (e.g., 'KES')
  amount: number; // Amount to charge
  description: string; // Order description
  callback_url: string; // Callback URL after payment
  redirect_mode?: string; // 'parent_window' for webview, 'self' for redirect
  notification_id: string; // IPN notification ID (if using IPN)
  billing_address?: {
    email_address?: string;
    phone_number?: string;
    country_code?: string;
    first_name?: string;
    middle_name?: string;
    last_name?: string;
    line_1?: string;
    line_2?: string;
    city?: string;
    state?: string;
    postal_code?: string;
    zip_code?: string;
  };
}

interface PesaPalOrderResponse {
  order_tracking_id: string;
  merchant_reference: string;
  redirect_url: string;
  status: string;
}

interface PesaPalTransactionStatus {
  payment_method: string;
  amount: number;
  created_date: string;
  confirmation_code: string;
  payment_status_description: string;
  description: string;
  message: string;
  payment_account: string;
  call_back_url: string;
  status_code: number;
  merchant_reference: string;
  payment_status_code: string;
  currency: string;
  order_tracking_id: string;
  status: string;
}

/**
 * Generate OAuth 1.0 signature for PesaPal API
 */
function generateOAuthSignature(
  method: string,
  url: string,
  params: Record<string, string>,
  consumerSecret: string
): string {
  // Sort parameters
  const sortedParams = Object.keys(params)
    .sort()
    .map(key => `${encodeURIComponent(key)}=${encodeURIComponent(params[key])}`)
    .join('&');

  // Create signature base string
  const signatureBaseString = `${method}&${encodeURIComponent(url)}&${encodeURIComponent(sortedParams)}`;

  // Create signing key
  const signingKey = `${encodeURIComponent(consumerSecret)}&`;

  // Generate HMAC-SHA1 signature
  const signature = crypto
    .createHmac('sha1', signingKey)
    .update(signatureBaseString)
    .digest('base64');

  return signature;
}

/**
 * Get PesaPal access token using OAuth 1.0
 */
export async function getPesaPalAccessToken(): Promise<string> {
  try {
    const url = `${PESAPAL_API_URL}/api/Auth/RequestToken`;
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const nonce = crypto.randomBytes(16).toString('hex');

    // OAuth 1.0 parameters
    const oauthParams: Record<string, string> = {
      oauth_consumer_key: CONSUMER_KEY,
      oauth_signature_method: 'HMAC-SHA1',
      oauth_timestamp: timestamp,
      oauth_nonce: nonce,
      oauth_version: '1.0',
    };

    // Generate signature
    const signature = generateOAuthSignature('POST', url, oauthParams, CONSUMER_SECRET);
    oauthParams['oauth_signature'] = signature;

    // Build Authorization header
    const authHeader = 'OAuth ' + Object.keys(oauthParams)
      .map(key => `${encodeURIComponent(key)}="${encodeURIComponent(oauthParams[key])}"`)
      .join(', ');

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error('PesaPal access token request failed', {
        status: response.status,
        statusText: response.statusText,
        error: errorText,
      });
      throw new Error(`PesaPal access token failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json() as PesaPalAccessTokenResponse;
    
    logger.info('PesaPal access token obtained', {
      expiresAt: data.expiry_date,
    });

    return data.token;
  } catch (error) {
    logger.error('Error getting PesaPal access token', {
      error: error instanceof Error ? error.message : undefined,
    });
    throw error;
  }
}

/**
 * Submit order to PesaPal
 * Returns order tracking ID and redirect URL
 */
export async function submitPesaPalOrder(orderData: PesaPalOrderRequest): Promise<{
  orderTrackingId: string;
  redirectUrl: string;
  merchantReference: string;
}> {
  try {
    // Get access token
    const accessToken = await getPesaPalAccessToken();

    const url = `${PESAPAL_API_URL}/api/Transactions/SubmitOrderRequest`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(orderData),
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error('PesaPal order submission failed', {
        status: response.status,
        statusText: response.statusText,
        error: errorText,
        orderData: {
          id: orderData.id,
          amount: orderData.amount,
          currency: orderData.currency,
        },
      });
      throw new Error(`PesaPal order submission failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json() as PesaPalOrderResponse;

    logger.info('PesaPal order submitted successfully', {
      orderTrackingId: data.order_tracking_id,
      merchantReference: data.merchant_reference,
      status: data.status,
    });

    return {
      orderTrackingId: data.order_tracking_id,
      redirectUrl: data.redirect_url,
      merchantReference: data.merchant_reference,
    };
  } catch (error) {
    logger.error('Error submitting PesaPal order', {
      error: error instanceof Error ? error.message : undefined,
      orderData: {
        id: orderData.id,
        amount: orderData.amount,
        currency: orderData.currency,
      },
    });
    throw error;
  }
}

/**
 * Get transaction status from PesaPal
 */
export async function getPesaPalTransactionStatus(orderTrackingId: string): Promise<PesaPalTransactionStatus> {
  try {
    // Get access token
    const accessToken = await getPesaPalAccessToken();

    const url = `${PESAPAL_API_URL}/api/Transactions/GetTransactionStatus?orderTrackingId=${orderTrackingId}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error('PesaPal transaction status check failed', {
        status: response.status,
        statusText: response.statusText,
        error: errorText,
        orderTrackingId,
      });
      throw new Error(`PesaPal transaction status check failed: ${response.status} ${response.statusText}`);
    }

    const data = await response.json() as PesaPalTransactionStatus;

    logger.info('PesaPal transaction status retrieved', {
      orderTrackingId,
      status: data.status,
      paymentStatus: data.payment_status_code,
    });

    return data;
  } catch (error) {
    logger.error('Error getting PesaPal transaction status', {
      error: error instanceof Error ? error.message : undefined,
      orderTrackingId,
    });
    throw error;
  }
}

/**
 * Verify IPN signature (if using IPN)
 */
export function verifyPesaPalIPNSignature(
  data: string,
  signature: string
): boolean {
  try {
    // PesaPal uses HMAC-SHA1 with consumer secret
    const expectedSignature = crypto
      .createHmac('sha1', CONSUMER_SECRET)
      .update(data)
      .digest('base64');

    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  } catch (error) {
    logger.error('Error verifying PesaPal IPN signature', {
      error: error instanceof Error ? error.message : undefined,
    });
    return false;
  }
}

