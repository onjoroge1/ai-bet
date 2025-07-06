# Stripe Test Card Numbers

## 🧪 Test Mode Cards

When testing payments in Stripe test mode, you must use these official test card numbers:

### ✅ Successful Payments

**Visa (Success)**
- Card Number: `4242 4242 4242 4242`
- Expiry: Any future date (e.g., `12/25`)
- CVC: Any 3 digits (e.g., `123`)
- ZIP: Any 5 digits (e.g., `12345`)

**Mastercard (Success)**
- Card Number: `5555 5555 5555 4444`
- Expiry: Any future date (e.g., `12/25`)
- CVC: Any 3 digits (e.g., `123`)
- ZIP: Any 5 digits (e.g., `12345`)

**American Express (Success)**
- Card Number: `3782 822463 10005`
- Expiry: Any future date (e.g., `12/25`)
- CVC: Any 4 digits (e.g., `1234`)
- ZIP: Any 5 digits (e.g., `12345`)

### ❌ Declined Payments (for testing error handling)

**Card Declined**
- Card Number: `4000 0000 0000 0002`
- Expiry: Any future date
- CVC: Any 3 digits
- ZIP: Any 5 digits

**Insufficient Funds**
- Card Number: `4000 0000 0000 9995`
- Expiry: Any future date
- CVC: Any 3 digits
- ZIP: Any 5 digits

**Expired Card**
- Card Number: `4000 0000 0000 0069`
- Expiry: Any past date
- CVC: Any 3 digits
- ZIP: Any 5 digits

**Incorrect CVC**
- Card Number: `4000 0000 0000 0127`
- Expiry: Any future date
- CVC: Any incorrect 3 digits
- ZIP: Any 5 digits

### 🔐 3D Secure Authentication

**Requires Authentication**
- Card Number: `4000 0025 0000 3155`
- Expiry: Any future date
- CVC: Any 3 digits
- ZIP: Any 5 digits

**Authentication Fails**
- Card Number: `4000 0027 6000 3184`
- Expiry: Any future date
- CVC: Any 3 digits
- ZIP: Any 5 digits

## 🚨 Important Notes

1. **Test Mode Only**: These cards only work in Stripe test mode
2. **No Real Charges**: These cards will never result in real charges
3. **Environment**: Make sure you're using test API keys (`pk_test_` and `sk_test_`)
4. **Webhook Testing**: Use these cards to test your webhook handling

## 🧪 Testing Your Payment Flow

1. **Use the success cards** to test successful payments
2. **Use the declined cards** to test error handling
3. **Use 3D Secure cards** to test authentication flows
4. **Check your webhook logs** to ensure events are received

## 🔍 Troubleshooting

If you're still getting declined transactions:

1. **Check your Stripe keys**: Ensure you're using test keys, not live keys
2. **Verify test mode**: Check your Stripe dashboard shows "Test mode"
3. **Check payment method settings**: Ensure cards are enabled in your Stripe account
4. **Review error messages**: Check the specific decline reason in Stripe logs

## 📞 Need Help?

- Check your Stripe Dashboard: https://dashboard.stripe.com/test/payments
- Review webhook events: https://dashboard.stripe.com/test/webhooks
- Test mode documentation: https://stripe.com/docs/testing 