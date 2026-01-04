# 🎯 Parlays System - Implementation Plan

**Date**: January 2, 2026  
**Status**: 📋 **IMPLEMENTATION IN PROGRESS**  
**Based on**: PARLAYS_COMPREHENSIVE_ANALYSIS.md

---

## 📋 **Implementation Priority Order**

### **Phase 1: Critical Fixes (IMMEDIATE)**
1. ✅ Fix backend duplication issue - Add deduplication logic
2. ⏳ Implement quality filtering for existing parlays

### **Phase 2: Quality Generation (HIGH PRIORITY)**
3. ⏳ Implement quality parlay generation using QuickPurchase.predictionData
4. ⏳ Add quality metrics display

### **Phase 3: User Features (HIGH PRIORITY)**
5. ⏳ Build user parlay builder interface
6. ⏳ Add purchase/trade integration

### **Phase 4: Display Enhancements (MEDIUM PRIORITY)**
7. ⏳ Enhance display with match context (logos, badges, links)
8. ⏳ Add quality metrics visualization

---

## 🔧 **Implementation Details**

### **1. Fix Backend Duplication Issue** ✅

**Approach**: Add deduplication logic in sync function
- Create unique key from leg combinations (match_id + outcome pairs)
- Skip parlays with duplicate leg combinations
- Log skipped duplicates for monitoring
- Keep best parlay (highest edge %) when duplicates found

**Files to Modify**:
- `app/api/parlays/route.ts` - syncParlaysFromVersion function

**Key Changes**:
```typescript
// Before processing, create leg combination key
const legKey = parlay.legs
  .map(l => `${l.match_id}:${l.outcome}`)
  .sort()
  .join('|')

// Check if combination already seen
if (seenCombinations.has(legKey)) {
  // Skip or update existing (keep best edge)
  continue
}
seenCombinations.add(legKey)
```

---

### **2. Quality Parlay Generation Using QuickPurchase.predictionData**

**Approach**: Create local parlay generation system
- Generate parlays from QuickPurchase.predictionData
- Use additional_markets_v2 for diverse markets
- Apply quality filters (confidence, quality_score, risk)
- Store in ParlayConsensus table with source="local"

**New Files**:
- `app/api/parlays/generate-quality/route.ts` - Quality parlay generation endpoint
- `lib/parlays/quality-generator.ts` - Core generation logic
- `lib/parlays/quality-filters.ts` - Quality filtering utilities

**Key Features**:
- High-probability match selection (confidence >= 0.60)
- Smart market selection from additional_markets_v2
- Risk-adjusted combinations
- Correlation awareness

---

### **3. User Parlay Builder**

**Approach**: Build user-facing parlay builder
- UI component for match selection
- Market type selection from additional_markets_v2
- Real-time odds calculation
- Save/favorite functionality

**New Files**:
- `app/dashboard/parlays/builder/page.tsx` - Builder page
- `components/parlays/parlay-builder.tsx` - Builder component
- `components/parlays/match-selector.tsx` - Match selection
- `components/parlays/market-selector.tsx` - Market selection
- `app/api/parlays/build/route.ts` - Build endpoint (calculate odds)

**Key Features**:
- Select from upcoming MarketMatch records
- Choose markets from QuickPurchase.predictionData.additional_markets_v2
- Real-time combined probability calculation
- Validation (contradictory selections, correlation)
- Save to user favorites

---

### **4. Purchase/Trade Integration**

**Approach**: Connect parlays to existing purchase system
- Extend QuickPurchaseModal or create ParlayPurchaseModal
- Integrate with Stripe payment system
- Create ParlayPurchase records
- Link to existing purchase flow

**Files to Modify**:
- `components/quick-purchase-modal.tsx` - Extend for parlays OR
- `components/parlays/parlay-purchase-modal.tsx` - New modal (preferred)
- `app/api/payments/create-payment-intent/route.ts` - Add parlay support
- `app/api/payments/webhook/route.ts` - Handle parlay purchases

**Key Features**:
- Purchase button on parlay cards
- Payment processing via Stripe
- Purchase confirmation
- Purchase history tracking

---

### **5. Enhanced Display with Match Context**

**Approach**: Add match context to parlay display
- Team logos from MarketMatch
- League badges
- Match detail page links
- Quality metrics visualization

**Files to Modify**:
- `app/dashboard/parlays/page.tsx` - Enhanced parlay cards
- `components/parlays/parlay-card.tsx` - New enhanced card component

**Key Features**:
- Team logos (from MarketMatch.homeTeamLogo, awayTeamLogo)
- League badges with logos
- Clickable match links to /match/[match_id]
- Quality score badges
- Risk indicators
- Data freshness indicators

---

## 🗄️ **Database Changes**

### **Optional Schema Enhancement** (Future)
```prisma
model ParlayConsensus {
  // ... existing fields ...
  source String @default("backend") // "backend" | "local" | "user"
  qualityScore Decimal? // Composite quality score
  generatedAt DateTime? // When locally generated
}
```

---

## 📝 **Implementation Checklist**

### **Phase 1: Critical Fixes**
- [x] Create implementation plan
- [ ] Fix backend duplication issue
- [ ] Add quality filtering for existing parlays
- [ ] Test deduplication logic
- [ ] Update documentation

### **Phase 2: Quality Generation**
- [ ] Create quality generator utilities
- [ ] Implement quality filtering logic
- [ ] Create quality parlay generation endpoint
- [ ] Test quality generation
- [ ] Add quality metrics to display

### **Phase 3: User Features**
- [ ] Create parlay builder UI
- [ ] Implement match selection
- [ ] Implement market selection
- [ ] Add real-time odds calculation
- [ ] Add save/favorite functionality
- [ ] Test builder flow

### **Phase 4: Purchase Integration**
- [ ] Create parlay purchase modal
- [ ] Integrate with payment system
- [ ] Test purchase flow
- [ ] Add purchase history

### **Phase 5: Display Enhancements**
- [ ] Add team logos to cards
- [ ] Add league badges
- [ ] Add match links
- [ ] Add quality metrics visualization
- [ ] Test enhanced display

---

## 🎯 **Success Criteria**

1. ✅ No duplicate parlays in database (deduplication working)
2. ✅ Quality parlays generated using QuickPurchase.predictionData
3. ✅ Users can build custom parlays
4. ✅ Users can purchase parlays
5. ✅ Enhanced display with match context

---

**Status**: Implementation in progress  
**Last Updated**: January 2, 2026

