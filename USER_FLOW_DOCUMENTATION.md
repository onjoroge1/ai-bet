# User Flow & Navigation Documentation

## **Overview**

This document provides a comprehensive overview of the user journey through the SnapBet platform, detailing how users discover matches, purchase predictions, and access their purchased tips. It explains how all components, pages, and API endpoints work together to create a cohesive user experience.

---

## **Core User Journey**

```
Homepage Discovery
    ↓
Match Detail Exploration
    ↓
Purchase Decision
    ↓
Access Purchased Content
```

---

## **1. Homepage Match Discovery** (`/`)

### **Purpose**
- Primary entry point for users to discover upcoming matches
- Displays live and upcoming matches with odds and predictions
- Provides first glimpse of AI-powered predictions (V1 free, V2 premium teaser)

### **Key Components**

#### **OddsPredictionTable** (`components/ui/odds-prediction-table.tsx`)
- **Data Source**: `/api/market` endpoint
  - Fetches matches with status: `live` or `upcoming`
  - Includes odds from multiple bookmakers
  - Contains model predictions (V1 consensus, V2 lightgbm)
  
- **Display Features**:
  - **Match Info**: Teams, league, kickoff time
  - **Odds Section**: Labeled Home/Draw/Away odds from primary bookmaker
  - **Prediction Section**:
    - **V1 (Free)**: Visible prediction with confidence percentage
    - **V2 (Premium)**: Masked confidence with gold "Unlock Premium" badge
    - Model version indicator (V1/V2 badge)
  
- **Filtering Options**:
  - Date tabs: All, Today, Tomorrow, Day After, Upcoming
  - Match count indicators on each tab
  - TBD match filtering with fallback to placeholder names

#### **MarqueeTicker** (`components/marquee-ticker.tsx`)
- **Data Source**: `/api/market?status=live&limit=5`
- Updates every 30 seconds
- Shows live match confidence scores
- Filters out TBD matches

### **User Actions on Homepage**
1. **Browse Matches**: View table of upcoming matches
2. **Click Match Row**: Navigates to match detail page (to be implemented)
3. **View Basic Prediction**: See V1 free prediction for all matches
4. **See Premium Teaser**: Notice V2 premium predictions (masked)

### **Current Navigation Behavior**
- **Click Handler**: `router.push(match.link || `/matches/${match.id}`)`
- **Current Issue**: `/matches/${match.id}` route doesn't exist yet
- **Recommendation**: Implement dedicated match detail page (see Section 4)

---

## **2. Public Matches Browse** (`/matches`)

### **Purpose**
- Public-facing match browsing page
- Shows available predictions for purchase
- Encourages sign-up/login for authentication
- Displays match previews without full access

### **Key Features**

#### **Data Source**
- **API**: `/api/matches`
- Returns QuickPurchase items filtered for public display
- Shows match data, prediction types, confidence scores
- Includes pricing information

#### **Display Elements**
- **Match Cards**: 
  - Team names, league, venue, date
  - Prediction type (home win, away win, draw)
  - Confidence score badge
  - Value rating badge
  - Analysis summary (preview)
  
- **Authentication CTAs**:
  - "Login to Purchase" button
  - "Sign Up" button
  - Redirects to `/signin` or `/signup` with callback URLs

#### **User Actions**
1. **Browse Available Matches**: See all upcoming predictions
2. **Filter Matches**: Search, filter by status, confidence, value rating
3. **Attempt Purchase**: Redirected to sign in if not authenticated
4. **View Match Details**: (Currently limited, needs improvement)

### **Authentication Flow**
```
Unauthenticated User
    ↓
Clicks "Login to Purchase" or "Sign Up"
    ↓
Redirected to /signin or /signup
    ↓
callbackUrl=/dashboard/matches (or specific match page)
    ↓
After authentication → Redirected to callback URL
```

---

## **3. Authenticated Matches Browse** (`/dashboard/matches`)

### **Purpose**
- Authenticated user's marketplace for predictions
- Browse available matches with full information
- Purchase predictions directly
- Filter out already purchased matches

### **Key Features**

#### **Data Source**
- **API**: `/api/quick-purchases`
- Returns QuickPurchase items for authenticated user
- Automatically filters out already-purchased matches
- Uses optimized data decoder for performance

#### **Purchase Filtering Logic**
```typescript
// Core filtering logic (from API)
1. Get user's completed purchases from Purchase table
2. Extract QuickPurchase.matchId from each purchase
3. Create Set of purchased matchIds
4. Filter QuickPurchase items:
   - If matchId in purchasedMatchIds → Exclude (already purchased)
   - If matchId not in purchasedMatchIds → Include (available)
```

#### **Database Tables Used**
- **Purchase**: Main purchase records
- **QuickPurchase**: Available items with matchId
- **Relationship**: `Purchase.quickPurchaseId` → `QuickPurchase.id`
- **Match Filtering**: `QuickPurchase.matchId` used for filtering

#### **Display Features**
- **Match Grid**: Cards showing match details
- **Filtering Options**:
  - Search by team names, league
  - Filter by status (upcoming, scheduled)
  - Filter by confidence (high, medium, low)
  - Filter by value rating (very high, high, medium, low)
  - Sort by date, confidence, price, name
  
- **Purchase CTAs**: "Purchase" button on each match card

#### **User Actions**
1. **Browse Available Matches**: See predictions they haven't purchased
2. **Purchase Match**: Click "Purchase" → Opens QuickPurchaseModal
3. **View Purchased Content**: Navigate to `/dashboard/my-tips`

### **Purchase Flow** (from `/dashboard/matches`)
```
User clicks "Purchase" button
    ↓
QuickPurchaseModal opens
    ↓
User selects payment method
    ↓
Payment processed via Stripe
    ↓
Purchase record created in database
    ↓
Purchase confirmation modal shows receipt
    ↓
Option to "View in My Tips" → /dashboard/my-tips
```

---

## **4. Match Detail Page** (Recommended: `/match/[match_id]`)

### **Status**: ⚠️ **TO BE IMPLEMENTED**

### **Purpose**
- Dedicated page for individual match details
- Preview before purchase
- Full content after purchase
- SEO-friendly match pages

### **Recommended Implementation**

#### **Route**: `/match/[match_id]`

#### **Data Sources**
1. **Basic Match Data**: 
   - From `/api/market?match_id=X` (quick load)
   - Or use cached data from homepage
   
2. **Full Prediction Data**: 
   - `/api/predictions/predict?match_id=X` (POST request)
   - Only fetched when:
     - User is authenticated AND not purchased (show preview)
     - User has purchased (show full content)
   
3. **Purchase Status**: 
   - `/api/my-tips` - Check if match already purchased
   - `/api/quick-purchases` - Find QuickPurchase ID for purchase

#### **Page Sections**

##### **Section 1: Match Overview** (Always Visible)
- Teams with logos
- League information
- Venue and date/time
- Current score (if live)
- Labeled odds (Home/Draw/Away)

##### **Section 2: Predictions Tier** (Tiered Content)
- **Free Tier (V1 Visible)**:
  - Prediction type (home win/draw/away win)
  - Confidence percentage (visible)
  - Basic reasoning (2-3 sentences)
  - Model indicator: "V1" badge
  
- **Premium Tier (V2 Teaser)**:
  - Same prediction type
  - Confidence masked with gold "Unlock Premium" badge
  - Teaser text: "Advanced AI model with deeper analysis..."
  - Model indicator: "V2" badge

##### **Section 3: Purchase/Access CTA**
- **If Not Purchased**:
  - Price display
  - "Purchase Full Prediction" button
  - Feature list:
    - ✓ Full V2 analysis
    - ✓ Team analysis (strengths/weaknesses)
    - ✓ Advanced markets (Totals, BTTS, Handicaps)
    - ✓ Risk assessment
    - ✓ Betting recommendations
  - Opens QuickPurchaseModal
  
- **If Already Purchased**:
  - "Full Access Granted" badge
  - "View Complete Analysis" button (expands content)
  - Link: "View in My Tips" → `/dashboard/my-tips`

##### **Section 4: Full Analysis** (After Purchase)
- AI Analysis Summary
- Team Analysis (Home & Away):
  - Strengths
  - Weaknesses
  - Form assessment
  - Injury impact
- Prediction Analysis:
  - Model assessment
  - Value assessment
  - Confidence factors
  - Risk factors
- Betting Recommendations:
  - Primary bet
  - Alternative bets
  - Risk level
  - Suggested stake
- Additional Markets V2:
  - Total Goals
  - Team Totals
  - Both Teams to Score
  - Double Chance
  - Draw No Bet
  - Asian Handicap
  - Winning Margin
  - Correct Scores
  - Odd/Even Total
  - Clean Sheet
  - Win to Nil

#### **Authentication States**

##### **Unauthenticated User**
```
Display:
- Match overview
- V1 free prediction (visible)
- V2 premium teaser (masked)
CTA:
- "Sign in to purchase full prediction"
- Redirect: /signin?callbackUrl=/match/[match_id]
```

##### **Authenticated + Not Purchased**
```
Display:
- Match overview
- V1 free prediction (visible)
- V2 premium teaser (masked)
- Purchase pricing
CTA:
- "Purchase Full Prediction"
- Opens QuickPurchaseModal
```

##### **Authenticated + Purchased**
```
Display:
- Match overview
- Full V1 + V2 predictions
- Complete analysis sections
- All additional markets
CTA:
- "View in My Tips" → /dashboard/my-tips
- "Purchase Another Match" → /dashboard/matches
```

---

## **5. Purchase Flow** (QuickPurchaseModal)

### **Component**: `components/quick-purchase-modal.tsx`

### **Purpose**
- Handle purchase of individual tips/predictions
- Process payments through Stripe
- Manage credit-based purchases
- Display receipt after successful purchase

### **Data Flow**

#### **Step 1: Purchase Initiation**
```typescript
// User clicks purchase button
handlePurchaseClick(match)
    ↓
// Convert match to QuickPurchaseItem
setModalItem(quickPurchaseItem)
setShowPurchaseModal(true)
    ↓
// QuickPurchaseModal opens with item details
```

#### **Step 2: Payment Method Selection**
- Options: Credit Card, Apple Pay, Google Pay, PayPal
- Credits option (if user has credits available)

#### **Step 3: Payment Processing**
```typescript
// Create payment intent
POST /api/payments/create-payment-intent
{
  itemId: "quickPurchaseId",
  itemType: "tip" | "prediction",
  paymentMethod: "card" | "apple_pay" | "google_pay" | "paypal" | "credits"
}
    ↓
// Stripe processes payment
// Webhook receives confirmation
POST /api/payments/webhook
{
  type: "payment_intent.succeeded",
  data: { object: paymentIntent }
}
    ↓
// Purchase record created
Purchase.create({
  userId, quickPurchaseId, amount, paymentMethod, status: 'completed'
})
```

#### **Step 4: Receipt Display**
- Fetch latest purchase: `GET /api/my-tips?latest=1`
- Display TipReceipt component
- Show purchase confirmation
- Option: "View in My Tips" → `/dashboard/my-tips`

### **Database Updates**
- **Purchase Table**: New record with `status: 'completed'`
- **User Table**: Credits deducted (if using credits)
- **QuickPurchase**: Availability updated (if needed)

---

## **6. My Tips Page** (`/dashboard/my-tips`)

### **Purpose**
- Display all purchased predictions
- Show full prediction details
- Organize by upcoming vs completed matches
- Provide detailed analysis for purchased items

### **Data Source**

#### **API**: `/api/my-tips`
- Fetches user's completed purchases
- Includes QuickPurchase details
- Transforms prediction data for display
- Returns comprehensive tip information

#### **Data Structure**
```typescript
interface Tip {
  id: string
  purchaseDate: string
  amount: number
  paymentMethod: string
  tipType: 'purchase' | 'credit_claim'
  
  // Match information
  homeTeam: string
  awayTeam: string
  matchDate: string | null
  venue: string | null
  league: string | null
  matchStatus: string | null
  
  // Prediction data
  predictionType: string | null
  confidenceScore: number | null
  odds: number | null
  valueRating: string | null
  analysisSummary: string | null
  
  // Raw prediction data
  predictionData: PredictionData | null
  
  // Formatted prediction
  prediction: {
    match: MatchData
    prediction: string
    odds: string
    confidence: number
    analysis: string
    valueRating: string
    detailedReasoning: string[]
    extraMarkets: ExtraMarket[]
    // ... full prediction structure
  } | null
}
```

### **Display Sections**

#### **Upcoming Matches Section**
- Full-size cards for matches not yet played
- Shows:
  - Time remaining until match
  - Match teams and league
  - Prediction type and confidence
  - Value rating
  - Purchase date
- "View Prediction" button → Opens detailed modal

#### **Completed Matches Section**
- Compact cards for finished matches
- Shows:
  - Match date
  - Teams and league
  - Prediction result (if available)
  - Status badge (won/lost/pending)
- "View Details" button → Opens detailed modal

### **Detailed Prediction Modal**

When user clicks "View Prediction", a comprehensive modal opens showing:

#### **Match Information**
- Home/Away teams
- Match date and venue
- League information

#### **Prediction Details**
- Prediction type
- Confidence score
- Purchase information

#### **Hero Section**
- Large display of match teams
- Recommended bet
- Confidence percentage

#### **Full Analysis Sections**
1. **AI Analysis Summary**: Comprehensive match analysis
2. **Team Analysis**: 
   - Home team: Strengths, weaknesses, form, injuries
   - Away team: Strengths, weaknesses, form, injuries
3. **Prediction Analysis**:
   - Model assessment
   - Value assessment
   - Confidence factors
   - Risk factors
4. **Betting Recommendations**:
   - Primary bet
   - Alternative bets
   - Risk level
   - Suggested stake
5. **Additional Markets V2**:
   - Total Goals markets
   - Team Totals
   - Both Teams to Score
   - Double Chance
   - Draw No Bet
   - Asian Handicap
   - Winning Margin
   - Correct Scores
   - Odd/Even Total
   - Clean Sheet
   - Win to Nil
6. **Model Information**:
   - Model type and version
   - Performance metrics
   - Data sources
7. **Data Freshness**:
   - H2H matches count
   - Form matches count
   - Injury information
   - Last updated timestamp

### **User Actions**
1. **View Purchased Tips**: Browse all purchases
2. **See Upcoming**: Focus on matches not yet played
3. **Review Completed**: Check past predictions and results
4. **View Full Analysis**: Open detailed modal for any tip
5. **Navigate to Purchase More**: Link to `/dashboard/matches`

---

## **7. Complete User Journey Examples**

### **Journey 1: New User Discovers and Purchases**

```
1. User lands on Homepage (/)
   - Sees OddsPredictionTable with upcoming matches
   - Views V1 free predictions
   - Notices V2 premium badges (teaser)
   
2. User clicks on match row
   - SHOULD navigate to /match/[match_id] (TO BE IMPLEMENTED)
   - Currently: May navigate to /matches/[match_id] (doesn't exist)
   - FALLBACK: User manually navigates to /matches
   
3. User browses /matches (public page)
   - Sees available predictions
   - Clicks "Login to Purchase"
   - Redirected to /signin
   
4. User signs in
   - Redirected to /dashboard/matches
   
5. User sees match in authenticated view
   - Clicks "Purchase" button
   - QuickPurchaseModal opens
   - Selects payment method (credit card)
   - Completes payment
   
6. Purchase successful
   - Receipt modal appears
   - User clicks "View in My Tips"
   - Redirected to /dashboard/my-tips
   
7. User views purchased tip
   - Sees match in "Upcoming Matches" section
   - Clicks "View Prediction"
   - Detailed modal opens with full analysis
   - Can see all V2 premium features
```

### **Journey 2: Returning User Purchases Another Match**

```
1. User returns to Homepage (/)
   - Sees updated match table
   - Clicks on a new match
   
2. Navigates to match detail (if implemented)
   - Sees match preview
   - V1 visible, V2 masked
   - Clicks "Purchase Full Prediction"
   
3. OR navigates to /dashboard/matches
   - Already authenticated
   - Sees all available matches (excluding purchased)
   - Previously purchased matches filtered out
   
4. Clicks "Purchase" on new match
   - QuickPurchaseModal opens
   - Uses saved payment method or credits
   - Purchase completes
   
5. Redirected to /dashboard/my-tips
   - Sees new purchase in "Upcoming Matches"
   - Can view full analysis
```

### **Journey 3: User Reviews Purchased Content**

```
1. User navigates to /dashboard/my-tips
   - Sees all purchased predictions
   - Organized: Upcoming vs Completed
   
2. User clicks on upcoming match
   - "View Prediction" button
   - Detailed modal opens
   
3. Modal displays:
   - Full match information
   - Complete AI analysis
   - Team analysis (both teams)
   - Prediction details (V1 + V2)
   - All additional markets
   - Betting recommendations
   - Model information
```

---

## **8. Data Flow & API Integration**

### **API Endpoints Used**

#### **Match Data APIs**
- **`/api/market`**: Homepage match data
  - Status: `live` | `upcoming`
  - Returns: Matches with odds and predictions
  - Models: V1 consensus, V2 lightgbm
  
- **`/api/matches`**: Public matches browse
  - Returns: QuickPurchase items for public display
  
- **`/api/quick-purchases`**: Authenticated matches
  - Returns: Available QuickPurchase items
  - Filters: Excludes already purchased matches

#### **Prediction APIs**
- **`/api/predictions/predict`**: Full prediction data
  - Method: POST
  - Body: `{ match_id: number }`
  - Returns: Complete prediction analysis
  - Usage: Match detail page, purchased tips

- **`/api/predictions/predictions-with-matchid`**: Cached predictions
  - Method: GET
  - Query: `?match_id=X&include_analysis=true`
  - Returns: Cached prediction if available

#### **Purchase APIs**
- **`/api/payments/create-payment-intent`**: Payment processing
  - Creates Stripe payment intent
  - Validates pricing and availability
  
- **`/api/payments/webhook`**: Payment confirmation
  - Processes Stripe webhooks
  - Creates Purchase records
  
- **`/api/purchase-tip`**: Credit-based purchase
  - Alternative to Stripe for credit purchases

#### **User Data APIs**
- **`/api/my-tips`**: Purchased tips
  - Returns: All completed purchases
  - Includes full prediction data
  - Supports `?latest=1` for receipt generation

---

## **9. Database Schema & Relationships**

### **Critical Tables for User Flow**

#### **Purchase Table** (Primary Purchase Records)
```typescript
Purchase {
  id: string
  userId: string → User.id
  quickPurchaseId: string → QuickPurchase.id
  amount: number
  paymentMethod: string
  status: 'completed' | 'pending' | 'failed'
  createdAt: Date
}
```

#### **QuickPurchase Table** (Available Items)
```typescript
QuickPurchase {
  id: string
  matchId: string | null → Match.id
  name: string
  type: 'prediction' | 'tip' | 'package' | 'vip'
  price: number
  confidenceScore: number | null
  predictionData: JSON
  matchData: JSON
  isActive: boolean
  countryId: string → Country.id
}
```

#### **Filtering Logic**
```typescript
// Get purchased match IDs
const purchases = await prisma.purchase.findMany({
  where: { userId, status: 'completed' },
  include: { quickPurchase: { select: { matchId: true } } }
})

const purchasedMatchIds = new Set(
  purchases.map(p => p.quickPurchase?.matchId).filter(Boolean)
)

// Filter QuickPurchase items
const available = quickPurchases.filter(
  qp => !purchasedMatchIds.has(qp.matchId)
)
```

---

## **10. Navigation Flow Diagram**

```
┌─────────────────┐
│   Homepage (/)  │
│  - Match Table  │
│  - V1/V2 Display│
└────────┬────────┘
         │ Click Match Row
         ↓
┌─────────────────────────────────┐
│  Match Detail (/match/[id])     │  ← TO BE IMPLEMENTED
│  - Preview or Full Content      │
│  - Purchase CTA                 │
└────────┬────────────────────────┘
         │
         ├─→ Not Authenticated
         │   ↓
         │   ┌──────────────────┐
         │   │   /matches       │  (Public Browse)
         │   │   - Login CTA    │
         │   └────────┬─────────┘
         │            │
         │            ↓
         │   ┌──────────────────┐
         │   │   /signin        │
         │   └────────┬─────────┘
         │            │
         └────────────┴──────────────────────────┐
                                                 │
         ┌───────────────────────────────────────┘
         │ Authenticated
         ↓
┌────────────────────────────┐
│ /dashboard/matches         │
│ - Available Matches        │
│ - Purchase Buttons         │
└────────┬───────────────────┘
         │ Click Purchase
         ↓
┌────────────────────────────┐
│ QuickPurchaseModal         │
│ - Payment Processing       │
│ - Purchase Confirmation    │
└────────┬───────────────────┘
         │ Purchase Success
         ↓
┌────────────────────────────┐
│ /dashboard/my-tips         │
│ - Purchased Tips           │
│ - Full Analysis Access     │
└────────────────────────────┘
```

---

## **11. Current Issues & Recommendations**

### **Issues Identified**

#### **1. Missing Match Detail Page** 🚨 **HIGH PRIORITY**
- **Problem**: Homepage table tries to navigate to `/matches/${match.id}`
- **Impact**: Broken navigation, poor UX
- **Recommendation**: Implement `/match/[match_id]` route

#### **2. Inconsistent Navigation**
- Homepage → Match detail (doesn't exist)
- Public matches → Requires login → Dashboard matches
- No clear path for authenticated users from homepage

#### **3. Purchase Flow Disconnect**
- Users might not realize they need to go to `/dashboard/matches`
- No clear indication on homepage that matches are purchasable

### **Recommended Solutions**

#### **Solution 1: Implement Match Detail Page** (Recommended)
- Create `/match/[match_id]` route
- Handle all authentication states
- Provide clear purchase pathway
- Show tiered content (free/premium)

#### **Solution 2: Improve Homepage Navigation**
- Update click handler to check authentication
- If authenticated → `/match/[match_id]`
- If not authenticated → `/matches` (public browse)

#### **Solution 3: Add Purchase Indicators**
- Show "Premium" badges on homepage
- Add "Purchase" buttons for authenticated users
- Quick purchase modal from homepage row click

---

## **12. Future Enhancements**

### **Short-Term**
1. ✅ Implement match detail page (`/match/[match_id]`)
2. ✅ Improve homepage navigation
3. ✅ Add quick purchase from homepage
4. ✅ Better authentication flow handling

### **Medium-Term**
1. Match comparison feature
2. Saved matches/watchlist
3. Share match predictions
4. Social proof (popular matches)

### **Long-Term**
1. Match recommendations (AI-powered)
2. Subscription model for unlimited access
3. Live match updates
4. In-play predictions

---

## **13. Technical Implementation Notes**

### **For Developers**

#### **Adding Match Detail Page**
```typescript
// app/match/[match_id]/page.tsx
export default async function MatchDetailPage({ params }: { params: { match_id: string } }) {
  const session = await getServerSession(authOptions)
  const matchId = params.match_id
  
  // Fetch match data
  const match = await fetchMatchData(matchId)
  
  // Check purchase status (if authenticated)
  const isPurchased = session ? await checkPurchaseStatus(session.user.id, matchId) : false
  
  // Fetch full prediction (if purchased or showing preview)
  const prediction = isPurchased || session 
    ? await fetchFullPrediction(matchId)
    : null
  
  return <MatchDetailPageContent 
    match={match}
    prediction={prediction}
    isPurchased={isPurchased}
    isAuthenticated={!!session}
  />
}
```

#### **Homepage Navigation Update**
```typescript
// components/ui/odds-prediction-table.tsx
const handleClick = () => {
  if (isAuthenticated) {
    router.push(`/match/${match.id}`)
  } else {
    router.push(`/matches`) // Public browse
  }
}
```

---

## **14. Testing Checklist**

### **User Flow Testing**
- [ ] Homepage → Match click navigation
- [ ] Public matches → Login flow
- [ ] Dashboard matches → Purchase flow
- [ ] Purchase → Receipt → My Tips
- [ ] My Tips → View full analysis
- [ ] Match detail page (when implemented)

### **Authentication Testing**
- [ ] Unauthenticated user flow
- [ ] Authenticated user flow
- [ ] Purchase status checking
- [ ] Content access control

### **Purchase Testing**
- [ ] Credit card payment
- [ ] Credit-based purchase
- [ ] Purchase filtering
- [ ] Receipt display

---

## **Documentation Updates**

- **Created**: October 29, 2025
- **Last Updated**: October 29, 2025
- **Related Documents**:
  - `development_plan.md` - Overall development roadmap
  - `TIP_PURCHASE_FLOW.md` - Detailed purchase flow
  - `PREDICTION_QUICKPURCHASE_SYSTEM.md` - System architecture

---

## **Quick Reference**

### **Key Routes**
- `/` - Homepage with match table
- `/matches` - Public matches browse
- `/dashboard/matches` - Authenticated matches browse
- `/match/[match_id]` - Match detail (TO BE IMPLEMENTED)
- `/dashboard/my-tips` - Purchased tips

### **Key APIs**
- `/api/market` - Homepage match data
- `/api/matches` - Public matches
- `/api/quick-purchases` - Authenticated matches
- `/api/predictions/predict` - Full prediction data
- `/api/my-tips` - Purchased tips
- `/api/payments/create-payment-intent` - Payment processing

### **Key Components**
- `OddsPredictionTable` - Homepage match table
- `QuickPurchaseModal` - Purchase flow
- `TipReceipt` - Purchase confirmation
- `MyTipsPage` - Purchased tips display

---

**For questions or clarifications, refer to the related documentation files or consult the development team.**

