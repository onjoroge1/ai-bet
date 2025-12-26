# Parlay Admin System Implementation

**Date**: January 2025  
**Status**: ✅ **COMPLETE**  
**Priority**: HIGH - New Revenue Stream

---

## 🎯 **Overview**

Complete admin system for managing parlays generated from `QuickPurchase.predictionData.additional_markets_v2`. The system includes:

1. **Admin Page** - Display and manage parlays
2. **API Endpoints** - Generate, sync, and list parlays
3. **Cron Job** - Automatic sync of parlays
4. **Purchase Tracking** - Integration with ParlayPurchase table

---

## 📋 **Components Created**

### **1. Admin Component**
**File**: `components/admin/parlay-management.tsx`

**Features**:
- Display existing parlays from ParlayConsensus table
- Display potential parlays (generated from predictionData)
- Filter by status, type, confidence
- Search functionality
- Sync button to store generated parlays
- Generate button to analyze predictionData

**Tabs**:
- **Existing Parlays**: Shows all parlays stored in database
- **Potential Parlays**: Shows generated parlays not yet synced

---

### **2. API Endpoints**

#### **POST /api/admin/parlays/generate**
- Generates potential single-game parlays from `predictionData.additional_markets_v2`
- Analyzes UPCOMING matches from MarketMatch table
- Returns list of potential SGP combinations

#### **POST /api/admin/parlays/sync-generated**
- Takes generated parlays and stores them in ParlayConsensus table
- Creates ParlayLeg records for each leg
- Calculates correlation penalties and pricing
- Skips duplicates (same match + same legs)

#### **GET /api/admin/parlays/list**
- Lists all parlays with filters
- Includes purchase count and revenue
- Includes performance metrics
- Supports pagination

#### **POST /api/admin/parlays/sync-scheduled**
- Cron job endpoint for automatic sync
- Uses CRON_SECRET for authentication
- Generates and syncs parlays automatically

#### **POST /api/parlays/purchase**
- Creates purchase record in ParlayPurchase table
- Links to user and parlay
- Calculates potential return
- Tracks purchase status

#### **GET /api/parlays/purchase**
- Gets user's parlay purchase history
- Filters by status
- Includes parlay details

---

## 🔄 **Sync Process**

### **Manual Sync (Admin UI)**

1. Click **"Generate Potential"** button
   - Analyzes QuickPurchase records with predictionData
   - Extracts `additional_markets_v2`
   - Generates SGP combinations (2-3 legs)
   - Displays in "Potential Parlays" tab

2. Click **"Sync to Database"** button
   - Takes potential parlays
   - Stores in ParlayConsensus table
   - Creates ParlayLeg records
   - Updates existing parlays if found

### **Automatic Sync (Cron Job)**

**Endpoint**: `POST /api/admin/parlays/sync-scheduled`

**Authentication**: Uses `CRON_SECRET` environment variable

**Process**:
1. Fetches UPCOMING matches from MarketMatch
2. Gets QuickPurchase records with predictionData
3. Generates SGPs from additional_markets_v2
4. Stores in ParlayConsensus table
5. Creates ParlayLeg records

**Cron Schedule** (to be configured):
- Recommended: Every 15-30 minutes
- Or: When new matches are synced

---

## 📊 **Data Flow**

```
MarketMatch (UPCOMING)
    ↓
QuickPurchase (with predictionData)
    ↓
additional_markets_v2 extraction
    ↓
SGP Generation (2-3 leg combinations)
    ↓
ParlayConsensus (stored)
    ↓
ParlayLeg (individual legs)
    ↓
ParlayPurchase (user purchases)
```

---

## 🗄️ **Database Tables Used**

### **ParlayConsensus**
- Stores parlay metadata
- `parlayType = 'single_game'` for SGPs
- Links to ParlayLeg records

### **ParlayLeg**
- Individual legs of parlay
- Contains matchId, outcome, probabilities
- Links to ParlayConsensus

### **ParlayPurchase**
- Tracks user purchases
- Links to user and parlay
- Stores amount, status, returns

### **ParlayPerformance**
- Performance metrics per parlay
- Win/loss tracking
- ROI calculation

---

## 🎨 **Admin Page Integration**

**Location**: `/admin` page

**Section**: Collapsible "Parlay Management" section

**Features**:
- Generate potential parlays
- Sync to database
- View existing parlays
- View potential parlays
- Filter and search
- Purchase tracking

---

## 🔧 **Configuration**

### **Environment Variables**

```env
# For cron job authentication
CRON_SECRET=your-secret-key-here
```

### **Cron Job Setup**

Add to `vercel.json` or your cron scheduler:

```json
{
  "crons": [{
    "path": "/api/admin/parlays/sync-scheduled",
    "schedule": "*/30 * * * *"
  }]
}
```

Or use external cron service:
- Call `POST /api/admin/parlays/sync-scheduled`
- Header: `Authorization: Bearer ${CRON_SECRET}`

---

## 📈 **Parlay Generation Logic**

### **Markets Analyzed**

From `additional_markets_v2`:
- **DNB** (Draw No Bet) - Home/Away
- **Totals** - Over/Under 2.5, 3.5, 4.5
- **BTTS** (Both Teams to Score) - Yes/No
- **Double Chance** - 1X, X2, 12
- **Win to Nil** - Home/Away

### **Combination Rules**

**Safe Builder (2-3 legs)**:
- Minimum probability: 55% per leg
- Markets: DNB, Under 3.5/4.5, BTTS No
- Confidence: High (≥30% combined prob)

**Balanced Value (2-3 legs)**:
- Minimum probability: 55% per leg
- Markets: DNB + Totals, Double Chance
- Confidence: Medium (≥20% combined prob)

**Aggressive Edge (3 legs)**:
- Minimum probability: 55% per leg
- Markets: Multiple combinations
- Confidence: Medium/Low

### **Pricing Calculation**

1. **Fair Odds**: `1 / combined_probability`
2. **Correlation Penalty**: 
   - 2 legs: 0.85
   - 3 legs: 0.80
3. **Adjusted Probability**: `combined_prob * correlation_penalty`
4. **Implied Odds**: `1 / adjusted_probability`
5. **Edge**: `((implied_odds - fair_odds) / fair_odds) * 100`

---

## ✅ **Features Implemented**

- ✅ Admin page component
- ✅ Generate potential parlays API
- ✅ Sync parlays to database API
- ✅ List parlays API
- ✅ Cron job endpoint
- ✅ Purchase tracking API
- ✅ Filter and search functionality
- ✅ Integration with existing admin page
- ✅ Purchase count and revenue tracking
- ✅ Performance metrics

---

## 🚀 **Next Steps**

1. **Configure Cron Job**
   - Set up Vercel cron or external scheduler
   - Configure CRON_SECRET environment variable

2. **Test Purchase Flow**
   - Test parlay purchase endpoint
   - Integrate with Stripe payment processing
   - Update purchase status after payment

3. **Add User-Facing Page**
   - Create `/dashboard/parlays` page
   - Display available parlays
   - Purchase functionality

4. **Performance Tracking**
   - Update ParlayPerformance table
   - Track wins/losses
   - Calculate ROI

---

## 📝 **Usage**

### **For Admins**

1. Go to `/admin` page
2. Expand "Parlay Management" section
3. Click "Generate Potential" to analyze predictionData
4. Review potential parlays in "Potential Parlays" tab
5. Click "Sync to Database" to store them
6. View stored parlays in "Existing Parlays" tab

### **For Users (Future)**

1. Browse parlays at `/dashboard/parlays`
2. Select a parlay
3. Purchase via Stripe
4. Track purchase in "My Parlays"

---

**Last Updated**: January 2025  
**Status**: ✅ **COMPLETE - READY FOR TESTING**

