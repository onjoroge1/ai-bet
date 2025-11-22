import Stripe from 'stripe'

// NOTE:
// The generated Stripe typings in this project expect a specific apiVersion literal.
// To avoid type errors while still using the desired runtime version, we cast through `any`.

// Server-side Stripe instance (only for server-side)
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
  apiVersion: '2025-03-31.basil' as any,
})

// Re-export utility functions that are safe for server-side
export { formatAmountForStripe, getStripeCurrency } from './stripe'