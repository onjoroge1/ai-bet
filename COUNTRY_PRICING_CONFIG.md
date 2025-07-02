# Country-Specific Pricing Configuration

## Overview

The SnapBet system now supports country-specific pricing through environment variables. This allows for localized pricing strategies that reflect the economic conditions and purchasing power of different regions.

## Environment Variable Structure

### Default Pricing (Fallback)
```env
# Default pricing for countries not specifically configured
DEFAULT_PREDICTION_PRICE=2.99
DEFAULT_PREDICTION_ORIGINAL_PRICE=4.99
```

### Country-Specific Pricing
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

## How It Works

1. **Country Detection**: The system uses the user's country currency code to determine pricing
2. **Priority System**: 
   - First, looks for country-specific pricing (e.g., `KENYA_PREDICTION_PRICE`)
   - If not found, falls back to default pricing (`DEFAULT_PREDICTION_PRICE`)
3. **Dynamic Application**: Prices are applied in real-time from environment variables

## Adding New Countries

To add pricing for a new country:

1. **Add environment variables** using the pattern: `{COUNTRY_CODE}_PREDICTION_PRICE`
2. **Restart the application** to load new environment variables
3. **Test** with a user from that country

### Example for Nigeria (NGN):
```env
NIGERIA_PREDICTION_PRICE=1200
NIGERIA_PREDICTION_ORIGINAL_PRICE=2000
```

## Benefits

- **Localized Pricing**: Prices reflect local purchasing power
- **Easy Management**: No database changes required
- **Quick Updates**: Change prices by updating environment variables
- **Scalable**: Easy to add new countries
- **Consistent**: Same pricing logic across all features

## Implementation Details

The pricing is applied in:
- `app/api/quick-purchases/route.ts` - User-facing quick purchase options
- `app/api/admin/leagues/[id]/sync/route.ts` - New prediction creation

## Currency Codes Used

The system uses ISO 4217 currency codes:
- **KES** - Kenyan Shilling
- **UGX** - Ugandan Shilling  
- **TZS** - Tanzanian Shilling
- **ZAR** - South African Rand
- **GHS** - Ghanaian Cedi
- **USD** - US Dollar

## Testing

To test country-specific pricing:
1. Set up environment variables for target countries
2. Create test users with different country settings
3. Verify prices display correctly for each country
4. Check that fallback pricing works for unconfigured countries 