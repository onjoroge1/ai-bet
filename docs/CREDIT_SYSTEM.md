# Credit System Documentation

## Overview

The AI Sports Tipster platform uses a unified credit system that combines package credits, quiz credits, and direct credits to provide users with a seamless experience for claiming AI-powered predictions.

## Credit Types

### 1. **Package Credits** (Primary)
- **Source**: `UserPackage.tipsRemaining`
- **How earned**: Purchasing subscription packages
- **Storage**: `UserPackage` table
- **Priority**: Highest (used first)

### 2. **Quiz Credits** (Secondary)
- **Source**: `UserPoints.points / 50` (50 points = 1 credit)
- **How earned**: Completing quizzes and earning points
- **Storage**: `UserPoints` table
- **Priority**: Medium

### 3. **Direct Credits** (Legacy)
- **Source**: `User.predictionCredits`
- **How earned**: Direct purchases, bonuses, manual additions
- **Storage**: `User` table
- **Priority**: Lowest (fallback)

## Unified Credit System

The system prioritizes credits in this order:
1. **Package Credits** (if available)
2. **Quiz Credits** (if package credits exhausted)
3. **Direct Credits** (legacy system, shown for reference)

### Credit Calculation Logic

```typescript
// Package credits calculation
let packageCreditsCount = 0;
let hasUnlimited = false;

for (const userPackage of userPackages) {
  if (userPackage.packageOffer.tipCount === -1) {
    hasUnlimited = true;
    break;
  } else {
    packageCreditsCount += userPackage.tipsRemaining;
  }
}

// Quiz credits calculation
const quizCreditsCount = userPoints ? Math.floor(userPoints.points / 50) : 0;

// Total unified credits
const totalCredits = hasUnlimited ? Infinity : (packageCreditsCount + quizCreditsCount);
```

## API Endpoints

### 1. **Credit Balance API**
**Endpoint**: `GET /api/credits/balance`

**Purpose**: Get user's current credit balance and breakdown

**Response**:
```json
{
  "success": true,
  "data": {
    "currentCredits": 8,
    "directCredits": 17,
    "quizCredits": 0, // <-- NEW: always present, number of available quiz credits
    "creditBreakdown": {
      "packageCredits": 8,
      "quizCredits": 0,
      "totalCredits": 8,
      "hasUnlimited": false
    }
  }
}
```

- **quizCredits**: The number of available quiz credits, always present. Calculated as `Math.floor(UserPoints.points / 50)`. This is also included in `creditBreakdown.quizCredits` and is part of `currentCredits`.
- **currentCredits**: The sum of all available credits (package + quiz credits).
- **directCredits**: Legacy direct credits, used as a fallback.

**Caching**: 5 minutes with Redis

### 2. **Credit Eligibility API**
**Endpoint**: `GET /api/credits/check-eligibility?predictionId={id}`

**Purpose**: Check if user can claim a specific prediction

**Response**:
```json
{
  "success": true,
  "data": {
    "isEligible": true,
    "hasEnoughCredits": true,
    "alreadyClaimed": false,
    "isFree": false,
    "currentCredits": 8,
    "requiredCredits": 1,
    "creditBreakdown": {
      "packageCredits": 8,
      "quizCredits": 0,
      "totalCredits": 8,
      "hasUnlimited": false
    }
  }
}
```

### 3. **Claim Tip API**
**Endpoint**: `POST /api/credits/claim-tip`

**Purpose**: Claim a prediction using credits

**Request**:
```json
{
  "predictionId": "prediction-uuid"
}
```

**Response**:
```json
{
  "success": true,
  "message": "Tip claimed successfully",
  "data": {
    "purchaseId": "purchase-uuid",
    "creditsSpent": 1,
    "remainingCredits": 7,
    "creditDeductionSource": "package",
    "creditBreakdown": {
      "packageCredits": 6,
      "quizCredits": 1,
      "totalCredits": 7,
      "hasUnlimited": false
    },
    "expiresAt": "2024-01-16T10:30:00Z"
  }
}
```

**Credit Deduction Priority**:
1. **Package Credits** (if available) - Deducts from `UserPackage.tipsRemaining`
2. **Quiz Credits** (if no package credits) - Deducts 50 points from `UserPoints.points`
3. **Direct Credits** (fallback) - Deducts from `User.predictionCredits`

**Transaction Safety**: Uses database transactions to ensure data consistency across all credit sources.

### 4. **Claimed Tips API**
**Endpoint**: `GET /api/credits/claim-tip?limit=20`

**Purpose**: Get user's claimed tips

**Response**:
```json
{
  "success": true,
  "data": {
    "claimedTips": [
      {
        "id": "purchase-uuid",
        "predictionId": "prediction-uuid",
        "creditsSpent": 1,
        "claimedAt": "2024-01-15T10:30:00Z",
        "expiresAt": "2024-01-16T10:30:00Z",
        "status": "completed",
        "prediction": {
          "id": "prediction-uuid",
          "predictionType": "home_win",
          "odds": 1.85,
          "confidenceScore": 75,
          "valueRating": "high",
          "explanation": "AI analysis...",
          "match": {
            "id": "match-uuid",
            "homeTeam": { "name": "Arsenal" },
            "awayTeam": { "name": "Chelsea" },
            "league": { "name": "Premier League" },
            "matchDate": "2024-01-15T20:00:00Z"
          }
        }
      }
    ],
    "pagination": {
      "total": 5,
      "limit": 20,
      "offset": 0,
      "hasMore": false
    }
  }
}
```

**Caching**: 
- Active tips: 5 minutes
- Used tips: 30 minutes  
- Expired tips: 1 hour

## Frontend Components

### 1. **Prediction Credits Dashboard**
**File**: `components/dashboard/prediction-credits.tsx`

**Features**:
- Real-time credit balance display
- Credit breakdown (Package, Quiz, Direct)
- Recent activity tracking
- Automatic refresh capability

**API Integration**: Uses `/api/credits/balance`

### 2. **Claim Tip Button**
**File**: `components/ui/ClaimTipButton.tsx`

**Features**:
- Eligibility checking
- Credit balance display
- Claim functionality
- Success/error handling

**API Integration**: Uses `/api/credits/check-eligibility` and `/api/credits/claim-tip`

### 3. **Claimed Tips Section**
**File**: `components/dashboard/ClaimedTipsSection.tsx`

**Features**:
- Tabbed interface (Active, Used, Expired)
- Real-time filtering
- Count badges for each category
- Detailed tip information

**Filtering Logic**:
- **Active**: Not expired AND match not played
- **Used**: Match has been played
- **Expired**: Expired but match not played

## Caching System

### Cache Manager
**File**: `lib/cache-manager.ts`

**Features**:
- Redis-based caching
- Configurable TTL per cache type
- Automatic cache invalidation
- Error handling and retry logic

**Cache Configurations**:
```typescript
static readonly CONFIGS = {
  COUNTRIES: { ttl: 86400, prefix: 'countries' }, // 24 hours
  PREDICTIONS: { ttl: 3600, prefix: 'predictions' }, // 1 hour
  USER_PROFILE: { ttl: 1800, prefix: 'user' }, // 30 minutes
  PACKAGE_OFFERS: { ttl: 7200, prefix: 'packages' }, // 2 hours
  SYSTEM_HEALTH: { ttl: 300, prefix: 'health' }, // 5 minutes
  CLAIMED_TIPS: { ttl: 1800, prefix: 'claimed-tips' }, // 30 minutes
  CREDIT_BALANCE: { ttl: 300, prefix: 'credits' }, // 5 minutes
}
```

### Cache Invalidation
- **Credit Balance**: Invalidated when tips are claimed
- **Claimed Tips**: Invalidated when new tips are claimed
- **Pattern-based**: Uses Redis pattern matching for bulk invalidation

## Database Schema

### Key Tables

#### User Table
```sql
CREATE TABLE "User" (
  "id" TEXT PRIMARY KEY,
  "predictionCredits" INTEGER DEFAULT 0,
  "totalCreditsEarned" INTEGER DEFAULT 0,
  "totalCreditsSpent" INTEGER DEFAULT 0,
  -- other fields...
);
```

#### UserPackage Table
```sql
CREATE TABLE "UserPackage" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "tipsRemaining" INTEGER NOT NULL,
  "status" TEXT NOT NULL,
  "expiresAt" TIMESTAMP,
  -- other fields...
);
```

#### UserPoints Table
```sql
CREATE TABLE "UserPoints" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "points" INTEGER DEFAULT 0,
  "totalEarned" INTEGER DEFAULT 0,
  "totalSpent" INTEGER DEFAULT 0,
  -- other fields...
);
```

#### Purchase Table (Unified)
```sql
CREATE TABLE "Purchase" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "quickPurchaseId" TEXT NOT NULL,
  "amount" DECIMAL(10,2) DEFAULT 0,
  "paymentMethod" TEXT NOT NULL, -- 'credits' or 'money'
  "status" TEXT NOT NULL,
  "createdAt" TIMESTAMP DEFAULT NOW(),
  -- other fields...
);
```

## Credit Flow

### 1. **Credit Check Flow**
```
User clicks "Claim Tip" 
→ Check eligibility (/api/credits/check-eligibility)
→ Display current credits and eligibility
→ Enable/disable claim button
```

### 2. **Credit Claim Flow**
```
User clicks "Claim with Credit"
→ POST to /api/credits/claim-tip
→ Validate credits (must have > 1 credit)
→ Deduct 1 credit from appropriate source
→ Create purchase record
→ Send notification
→ Invalidate caches
→ Return success response
```

### 3. **Credit Display Flow**
```
Component mounts
→ Fetch credit balance (/api/credits/balance)
→ Display unified credit count
→ Show breakdown if needed
→ Cache for 5 minutes
```

## Error Handling

### Common Error Scenarios

1. **Insufficient Credits**
   ```json
   {
     "error": "Insufficient credits",
     "currentCredits": 0,
     "requiredCredits": 1,
     "message": "You need more than 1 credit to claim a tip"
   }
   ```

2. **Already Claimed**
   ```json
   {
     "error": "Tip already purchased",
     "purchaseId": "existing-purchase-id",
     "purchasedAt": "2024-01-15T10:30:00Z"
   }
   ```

3. **Cache Errors**
   - Graceful fallback to database queries
   - Logging for debugging
   - No impact on user experience

## Performance Optimizations

### 1. **Caching Strategy**
- **Credit Balance**: 5-minute cache (frequently accessed)
- **Claimed Tips**: Variable cache based on status
- **Eligibility**: No cache (real-time data needed)

### 2. **Database Optimizations**
- Indexed queries on `userId` and `paymentMethod`
- Efficient joins with `QuickPurchase` table
- Pagination for large result sets

### 3. **Frontend Optimizations**
- Debounced API calls
- Optimistic UI updates
- Background cache invalidation

## Monitoring and Logging

### Key Metrics
- Credit balance API response times
- Cache hit/miss ratios
- Credit claim success rates
- Error rates by endpoint

### Logging
- Structured logging with tags
- Error tracking with context
- Performance monitoring
- User action tracking

## Security Considerations

### 1. **Authentication**
- All credit APIs require valid session
- User ID validation on all requests
- CSRF protection

### 2. **Data Validation**
- Input sanitization
- Credit amount validation
- Prediction ID validation

### 3. **Rate Limiting**
- API rate limiting on claim endpoints
- Prevention of credit farming
- Abuse detection

## Future Enhancements

### Planned Features
1. **Credit History**: Detailed transaction log
2. **Credit Analytics**: Usage patterns and insights
3. **Credit Expiration**: Time-based credit expiration
4. **Credit Transfers**: User-to-user credit transfers
5. **Credit Promotions**: Special offers and bonuses

### Technical Improvements
1. **Real-time Updates**: WebSocket integration
2. **Advanced Caching**: Multi-level caching strategy
3. **Performance Monitoring**: Enhanced metrics and alerts
4. **Mobile Optimization**: Native app credit integration

## Troubleshooting

### Common Issues

1. **Credit Balance Not Updating**
   - Check cache invalidation
   - Verify API response
   - Clear browser cache

2. **Claimed Tips Not Showing**
   - Check filtering logic
   - Verify API response format
   - Check database records

3. **Cache Issues**
   - Verify Redis connection
   - Check cache configuration
   - Monitor cache hit rates

### Debug Commands
```bash
# Test credit balance API
curl -H "Authorization: Bearer <token>" /api/credits/balance

# Test claimed tips API
curl -H "Authorization: Bearer <token>" /api/credits/claim-tip?limit=5

# Clear cache (development)
node scripts/clear-cache.js
```

## Version History

### v1.0.0 (Current)
- Unified credit system implementation
- Redis caching integration
- Real-time credit balance display
- Claimed tips management
- Comprehensive error handling

### Planned v1.1.0
- Credit history and analytics
- Advanced caching strategies
- Performance optimizations
- Enhanced security features 