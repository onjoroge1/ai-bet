# Tip Purchase Flow & Receipt System

## Overview

The tip purchase flow is a comprehensive system that handles the purchase of individual tips, processes payments through Stripe, and presents users with a detailed receipt upon successful completion.

## Flow Architecture

### 1. Purchase Initiation
- User clicks on a tip in the UI (QuickPurchaseModal)
- System validates user authentication and country-specific pricing
- Payment method selection (credit card, Apple Pay, Google Pay, PayPal)

### 2. Payment Processing
- Stripe payment intent creation
- Secure payment processing
- Webhook handling for payment confirmation
- Database transaction recording

### 3. Receipt Generation
- Fetch latest purchase details
- Generate comprehensive receipt with all tip information
- Display receipt in modal with option to view in dashboard

## Key Components

### QuickPurchaseModal (`components/quick-purchase-modal.tsx`)
- Handles the entire purchase flow
- Manages payment method selection
- Processes payment through Stripe
- Shows receipt upon successful purchase

### TipReceipt (`components/tip-receipt.tsx`)
- Displays comprehensive purchase receipt
- Shows match details, prediction information, and payment details
- Provides navigation to user's tips dashboard

### API Endpoints

#### `/api/my-tips` (GET)
- Fetches user's purchased tips
- Supports `latest=1` parameter for receipt generation
- Returns structured data for receipt display

#### `/api/payments/create-payment-intent` (POST)
- Creates Stripe payment intent
- Handles both tip and package purchases
- Validates pricing and availability

#### `/api/payments/webhook` (POST)
- Processes Stripe webhook events
- Creates purchase records in database
- Handles payment success/failure scenarios

## Data Flow

### 1. Purchase Request
```javascript
// User selects payment method
handleSelectPayment('card')

// System creates payment intent
POST /api/payments/create-payment-intent
{
  itemId: "tip_123",
  itemType: "tip",
  paymentMethod: "card"
}
```

### 2. Payment Processing
```javascript
// Stripe processes payment
// Webhook receives confirmation
POST /api/payments/webhook
{
  type: "payment_intent.succeeded",
  data: { object: paymentIntent }
}
```

### 3. Receipt Generation
```javascript
// Fetch latest purchase for receipt
GET /api/my-tips?latest=1

// Response structure
{
  tips: [{
    id: "purchase_123",
    purchaseId: "purchase_123",
    name: "Premium Tip",
    type: "tip",
    price: 9.99,
    amount: 9.99,
    description: "AI-powered prediction",
    features: ["Analysis", "Confidence Score"],
    isUrgent: false,
    timeLeft: null,
    currencySymbol: "$",
    currencyCode: "USD",
    purchaseDate: "2024-01-15T10:30:00Z",
    paymentMethod: "stripe",
    homeTeam: "Manchester United",
    awayTeam: "Liverpool",
    matchDate: "2024-01-16T20:00:00Z",
    league: "Premier League",
    predictionType: "home_win",
    confidenceScore: 85,
    odds: 2.5,
    valueRating: "high"
  }],
  total: 1
}
```

## Receipt Features

### 1. Success Confirmation
- Clear success message with checkmark icon
- Purchase confirmation details

### 2. Match Information
- Home and away teams
- League and match date
- Venue information (if available)

### 3. Prediction Details
- Prediction type (home win, away win, draw)
- Confidence score percentage
- Odds and value rating

### 4. Payment Information
- Transaction ID
- Amount paid with currency
- Payment method used
- Purchase date and time

### 5. Tip Features
- List of included features
- Additional details in expandable section

## Error Handling

### 1. Payment Failures
- Stripe error handling
- User-friendly error messages
- Retry mechanisms

### 2. API Failures
- Fallback receipt generation
- Graceful degradation
- Error logging and monitoring

### 3. Network Issues
- Timeout handling
- Retry logic
- Offline state management

## Testing

### Manual Testing
1. **Purchase Flow Test**
   ```bash
   npm run test-tip-purchase
   ```

2. **UI Testing Steps**
   - Navigate to tip purchase modal
   - Select payment method
   - Complete payment
   - Verify receipt displays correctly
   - Check receipt data accuracy
   - Test navigation to dashboard

### Automated Testing
- Unit tests for receipt component
- Integration tests for API endpoints
- E2E tests for complete purchase flow

## Database Schema

### Purchase Table
```sql
CREATE TABLE "Purchase" (
  id TEXT PRIMARY KEY,
  userId TEXT NOT NULL,
  quickPurchaseId TEXT NOT NULL,
  amount DECIMAL NOT NULL,
  paymentMethod TEXT NOT NULL,
  status TEXT NOT NULL,
  createdAt TIMESTAMP NOT NULL,
  updatedAt TIMESTAMP NOT NULL
);
```

### QuickPurchase Table
```sql
CREATE TABLE "QuickPurchase" (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  price DECIMAL NOT NULL,
  description TEXT,
  features TEXT[],
  type TEXT NOT NULL,
  predictionData JSONB,
  -- ... other fields
);
```

## Security Considerations

### 1. Payment Security
- Stripe handles sensitive payment data
- No card details stored in our database
- Webhook signature verification

### 2. Data Validation
- Input sanitization
- Type checking
- Authorization checks

### 3. Rate Limiting
- API rate limiting
- Payment attempt limits
- Fraud detection

## Performance Optimization

### 1. Database Queries
- Optimized queries with proper indexing
- Efficient joins for related data
- Pagination for large datasets

### 2. Caching
- Redis caching for frequently accessed data
- Cache invalidation strategies
- Performance monitoring

### 3. API Response
- Structured JSON responses
- Minimal data transfer
- Compression where appropriate

## Monitoring and Analytics

### 1. Success Metrics
- Purchase completion rate
- Payment success rate
- Receipt view rate

### 2. Error Tracking
- Payment failure rates
- API error monitoring
- User experience metrics

### 3. Performance Metrics
- API response times
- Database query performance
- Frontend load times

## Future Enhancements

### 1. Receipt Features
- PDF receipt generation
- Email receipt delivery
- Receipt sharing capabilities

### 2. Payment Methods
- Additional payment gateways
- Local payment methods
- Cryptocurrency support

### 3. User Experience
- One-click purchases
- Saved payment methods
- Purchase history improvements

## Troubleshooting

### Common Issues

1. **Receipt Not Showing**
   - Check API response structure
   - Verify purchase record exists
   - Check browser console for errors

2. **Payment Processing Issues**
   - Verify Stripe configuration
   - Check webhook endpoint
   - Validate payment intent creation

3. **Data Mismatch**
   - Check database consistency
   - Verify API response format
   - Test with sample data

### Debug Commands
```bash
# Test purchase flow
npm run test-tip-purchase

# Check database state
npm run db:studio

# Monitor logs
npm run monitor-logs
```

## Support

For issues related to the tip purchase flow:
1. Check the logs for error messages
2. Verify database state
3. Test with the provided test script
4. Review API response structures
5. Check Stripe dashboard for payment status 