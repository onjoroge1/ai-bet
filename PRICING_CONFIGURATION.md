# Pricing Configuration

## Environment Variables

The SnapBet system now supports configurable pricing through environment variables, including **country-specific pricing** for localized strategies.

### Default Pricing (Fallback)

- **`DEFAULT_PREDICTION_PRICE`**: Default price for AI predictions (default: `2.99`)
- **`DEFAULT_PREDICTION_ORIGINAL_PRICE`**: Original/crossed-out price for predictions (default: `4.99`)

### Country-Specific Pricing

The system supports country-specific pricing using the pattern `{COUNTRY_CODE}_PREDICTION_PRICE`:

```env
# Kenya (KES)
KENYA_PREDICTION_PRICE=150
KENYA_PREDICTION_ORIGINAL_PRICE=250

# Uganda (UGX)
UGANDA_PREDICTION_PRICE=12000
UGANDA_PREDICTION_ORIGINAL_PRICE=20000

# Tanzania (TZS)
TANZANIA_PREDICTION_PRICE=7000
TANZANIA_PREDICTION_ORIGINAL_PRICE=12000

# South Africa (ZAR)
SOUTH_AFRICA_PREDICTION_PRICE=45
SOUTH_AFRICA_PREDICTION_ORIGINAL_PRICE=75

# Ghana (GHS)
GHANA_PREDICTION_PRICE=35
GHANA_PREDICTION_ORIGINAL_PRICE=60

# USA (USD)
USA_PREDICTION_PRICE=2.99
USA_PREDICTION_ORIGINAL_PRICE=4.99
```

### Example Configuration

Add these to your `.env` file:

```env
# Default Pricing
DEFAULT_PREDICTION_PRICE=2.99
DEFAULT_PREDICTION_ORIGINAL_PRICE=4.99

# Country-specific pricing
KENYA_PREDICTION_PRICE=150
KENYA_PREDICTION_ORIGINAL_PRICE=250
UGANDA_PREDICTION_PRICE=12000
UGANDA_PREDICTION_ORIGINAL_PRICE=20000
TANZANIA_PREDICTION_PRICE=7000
TANZANIA_PREDICTION_ORIGINAL_PRICE=12000
SOUTH_AFRICA_PREDICTION_PRICE=45
SOUTH_AFRICA_PREDICTION_ORIGINAL_PRICE=75
GHANA_PREDICTION_PRICE=35
GHANA_PREDICTION_ORIGINAL_PRICE=60
USA_PREDICTION_PRICE=2.99
USA_PREDICTION_ORIGINAL_PRICE=4.99
```

### Pricing Strategy

The current pricing strategy uses:
- **Sale Price**: $2.99 (configurable via `DEFAULT_PREDICTION_PRICE`)
- **Original Price**: $4.99 (configurable via `DEFAULT_PREDICTION_ORIGINAL_PRICE`)
- **Discount**: ~40% off original price

**Country-specific examples:**
- **Kenya**: KES 150 (sale) / KES 250 (original) - ~40% discount
- **Uganda**: UGX 12,000 (sale) / UGX 20,000 (original) - ~40% discount
- **South Africa**: ZAR 45 (sale) / ZAR 75 (original) - ~40% discount

### How Country-Specific Pricing Works

1. **Country Detection**: System uses user's country currency code
2. **Priority System**: 
   - First, looks for country-specific pricing (e.g., `KENYA_PREDICTION_PRICE`)
   - If not found, falls back to default pricing (`DEFAULT_PREDICTION_PRICE`)
3. **Dynamic Application**: Prices applied in real-time from environment variables

### Benefits of Configurable Pricing

1. **Localized Pricing**: Reflects local purchasing power and economic conditions
2. **Environment-specific pricing**: Different prices for development, staging, and production
3. **A/B testing**: Easy to test different price points
4. **Market adaptation**: Quickly adjust pricing based on market conditions
5. **Currency support**: Automatic adaptation for different currencies and regions
6. **Scalable**: Easy to add new countries without code changes

### Adding New Countries

To add pricing for a new country:

1. **Add environment variables** using the pattern: `{COUNTRY_CODE}_PREDICTION_PRICE`
2. **Restart the application** to load new environment variables
3. **Test** with a user from that country

**Example for Nigeria (NGN):**
```env
NIGERIA_PREDICTION_PRICE=1200
NIGERIA_PREDICTION_ORIGINAL_PRICE=2000
```

### Implementation

The pricing is applied in:
- `app/api/quick-purchases/route.ts` - When fetching quick purchase options for users
- `app/api/admin/leagues/[id]/sync/route.ts` - When creating new QuickPurchase records
- All new predictions will use the configured pricing
- Existing predictions retain their original pricing until updated

### Future Enhancements

Potential future pricing features:
- League-specific pricing
- Match importance-based pricing
- Dynamic pricing based on confidence scores
- Subscription-based pricing models
- Seasonal pricing adjustments
- Bulk purchase discounts 