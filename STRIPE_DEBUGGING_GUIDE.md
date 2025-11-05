# Stripe Payment Form Debugging Guide

**Date:** November 3, 2025  
**Issue:** Stripe is null error in payment form

---

## 🔍 Current Status

✅ **Build successful** - All configuration is correct  
⚠️ **Runtime issue** - Stripe.js not loading in browser

---

## 📋 What We've Fixed

1. ✅ Updated Stripe API version to `2025-03-31.basil`
2. ✅ Fixed TypeScript type error
3. ✅ Removed duplicate `loader: 'auto'` configuration
4. ✅ Changed `Promise.resolve(null)` to `loadStripe()` call
5. ✅ Added comprehensive logging
6. ✅ Verified environment variables are properly formatted

---

## 🧪 Browser Testing Required

### Step 1: Start Dev Server
```bash
npm run dev
```

### Step 2: Open Browser Console
Open DevTools (F12) → Console tab

### Step 3: Navigate to Payment Flow
1. Go to: `http://localhost:3000/dashboard/matches`
2. Click on a match
3. Click "Quick Purchase"
4. Select payment method
5. Click "Continue to Payment"

### Step 4: Check Console Logs

**Expected logs when Stripe loads correctly:**
```
[Stripe] getStripeKey() called
[Stripe] Key exists? true
[Stripe] Trimmed key preview: pk_test_51RhBB0PIROxmSIgQbG...
[Stripe] Loading Stripe.js with key: pk_test_51RhBB0PIROx...
[PaymentForm] Stripe state: { stripe: 'loaded', elements: 'loaded', hasKey: true }
[QuickPurchaseModal] ✅ Stripe Elements initialized successfully
[PaymentForm] ✅ Stripe ready!
```

**If key is missing:**
```
[Stripe] getStripeKey() called
[Stripe] Key exists? false
[Stripe] NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY is missing
[Stripe] Publishable key is missing or invalid, trying to load anyway
[PaymentForm] Stripe state: { stripe: 'null (failed)', elements: 'not loaded', hasKey: false }
```

---

## 🐛 Troubleshooting

### Issue 1: "Stripe key is missing" in console

**Cause:** Environment variable not being inlined at build time

**Fix:**
1. Verify `.env.local` exists and has key on single line
2. Restart dev server completely
3. Clear Next.js cache: `rm -rf .next`
4. Rebuild: `npm run build`

### Issue 2: "Stripe.js failed to load from CDN"

**Possible causes:**
- Ad blocker blocking `js.stripe.com`
- Network/firewall issues
- CSP violations

**Debug steps:**
1. Check Network tab in DevTools
2. Filter by "stripe"
3. Look for failed requests to `js.stripe.com/v3`
4. Check CSP headers in response

**Quick test:**
```javascript
// In browser console:
fetch('https://js.stripe.com/v3')
  .then(r => console.log('Stripe CDN accessible:', r.ok))
  .catch(e => console.error('Stripe CDN blocked:', e))
```

### Issue 3: Still getting null error

**Try browser cache:**
1. Hard refresh: Ctrl+Shift+R (Windows) or Cmd+Shift+R (Mac)
2. Clear browser cache
3. Try incognito mode
4. Try different browser

---

## 📁 Files to Check

### Critical Files:
- `lib/stripe.ts` - Client-side Stripe initialization
- `lib/stripe-server.ts` - Server-side Stripe instance
- `.env.local` - Environment variables
- `components/quick-purchase-modal.tsx` - Elements wrapper
- `components/payment-form.tsx` - Payment form component

### Configuration Files:
- `next.config.js` - CSP headers
- `app/layout.tsx` - Preconnect links
- `package.json` - Stripe package versions

---

## 🔧 Alternative Debugging

### Check Built JavaScript
```bash
# Search for Stripe key in built output
grep -r "pk_test_51RhBB0PIROx" .next/static/
```

If key is found in built output, but console shows missing:
- Browser cache issue
- Service worker caching old version

### Network Inspection
1. Open DevTools → Network tab
2. Filter: `stripe` or `v3`
3. Check if `https://js.stripe.com/v3` loads
4. Check response headers for CSP

---

## 🎯 Expected Behavior

When everything works correctly:

1. Page loads → Stripe.js loads from CDN
2. User clicks purchase → `getStripeKey()` runs
3. Console shows key preview → Stripe.js initialized
4. Payment intent created → Stripe Elements renders
5. Payment form displays → User can enter card details

---

## ⚠️ Next Steps if Still Failing

1. **Check actual browser console** for our debug logs
2. **Verify environment variable** is actually being inlined
3. **Test with fresh browser** (incognito)
4. **Check network tab** for CDN loading
5. **Inspect CSP headers** for violations

---

**Last Modified:** November 3, 2025


