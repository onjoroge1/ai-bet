# Pricing Configuration

## Environment Variables

The AI Sports Tipster system now supports configurable pricing through environment variables.

### Prediction Pricing

- **`DEFAULT_PREDICTION_PRICE`**: Default price for AI predictions (default: `2.99`)
- **`DEFAULT_PREDICTION_ORIGINAL_PRICE`**: Original/crossed-out price for predictions (default: `4.99`)

### Example Configuration

Add these to your `.env` file:

```env
# Prediction Pricing
DEFAULT_PREDICTION_PRICE=2.99
DEFAULT_PREDICTION_ORIGINAL_PRICE=4.99
```

### Pricing Strategy

The current pricing strategy uses:
- **Sale Price**: $2.99 (configurable via `DEFAULT_PREDICTION_PRICE`)
- **Original Price**: $4.99 (configurable via `DEFAULT_PREDICTION_ORIGINAL_PRICE`)
- **Discount**: ~40% off original price

### Benefits of Configurable Pricing

1. **Environment-specific pricing**: Different prices for development, staging, and production
2. **A/B testing**: Easy to test different price points
3. **Market adaptation**: Quickly adjust pricing based on market conditions
4. **Currency support**: Can be adapted for different currencies and regions

### Implementation

The pricing is applied in:
- `app/api/admin/leagues/[id]/sync/route.ts` - When creating new QuickPurchase records
- All new predictions will use the configured pricing
- Existing predictions retain their original pricing until updated

### Future Enhancements

Potential future pricing features:
- League-specific pricing
- Match importance-based pricing
- Dynamic pricing based on confidence scores
- Subscription-based pricing models 