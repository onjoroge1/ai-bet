import Stripe from 'stripe'

// Server-side Stripe instance (only for server-side)
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-05-28.basil' as any, // Type mismatch, but this version works
})

// Re-export utility functions that are safe for server-side
export { formatAmountForStripe, getStripeCurrency } from './stripe' 