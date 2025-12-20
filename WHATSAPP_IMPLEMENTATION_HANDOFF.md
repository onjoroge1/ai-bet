# WhatsApp Commands Implementation - Handoff Document

## Overview

This document provides a complete handoff for the WhatsApp commands implementation for SnapBet. It covers what was implemented, the data structure, pending work, and reference files.

---

## Table of Contents

1. [Project Context](#project-context)
2. [What Was Implemented](#what-was-implemented)
3. [Data Structure](#data-structure)
4. [Pending Implementation](#pending-implementation)
5. [Key Files Reference](#key-files-reference)
6. [Testing](#testing)
7. [Related Documentation](#related-documentation)

---

## Project Context

SnapBet is a sports betting prediction platform that uses AI/ML to provide match predictions. The WhatsApp integration allows users to interact with the platform via WhatsApp messages, receiving predictions, market analysis, and purchasing VIP access.

### Architecture
- **Backend**: Next.js API routes
- **Database**: PostgreSQL via Prisma ORM
- **WhatsApp**: Meta Cloud API integration
- **Payments**: Stripe Checkout Sessions

---

## What Was Implemented

### Session Summary

We focused on fixing and enhancing the BTTS, OVERS, and UNDERS commands to:
1. **Read data from the correct database fields** (`additional_markets_flat` and `additional_markets_v2`)
2. **Show all goal lines** (0.5, 1.5, 2.5, 3.5, 4.5) instead of just 2.5
3. **Create documentation** for command messages and implementation roadmap

### Commands Status

| Command | Status | Description |
|---------|--------|-------------|
| **BTTS** (browse) | ✅ Fixed | Shows top 5 BTTS matches from DB |
| **BTTS [Match ID]** | ✅ Fixed | Shows BTTS analysis for specific match |
| **OVERS** (browse) | ✅ Fixed | Shows top 5 Over 2.5 matches from DB |
| **OVERS [Match ID]** | ✅ Enhanced | Shows ALL goal lines (0.5-4.5) |
| **UNDERS** (browse) | ✅ Fixed | Shows top 5 Under 2.5 matches from DB |
| **UNDERS [Match ID]** | ✅ Enhanced | Shows ALL under lines (0.5-4.5) |
| **BUY** | ✅ Working | VIP subscription with payment links |
| **VIP** | ✅ Working | VIP pricing info |
| **MENU** | ✅ Working | Command list |
| **HELP** | ✅ Working | How-to guide |
| **STATUS** | ✅ Working | Account status |
| **PARLAY** | ✅ Working | AI parlay picks |

### Key Changes Made

#### 1. Data Extraction Priority
Changed from using only `additional_markets.total_goals` to:
```
Priority 1: additional_markets_flat (most complete)
Priority 2: additional_markets_v2 (nested structure)
Priority 3: additional_markets (legacy fallback)
```

#### 2. Files Modified

**`app/api/whatsapp/webhook/route.ts`**:
- `sendBTTSPicks()` - Browse mode, uses flat/v2 data
- `sendBTTSForMatch()` - Match mode, uses flat/v2 data
- `sendOversPicks()` - Browse mode, uses flat/v2 data
- `sendOversForMatch()` - Match mode, shows all goal lines 0.5-4.5
- `sendUndersPicks()` - Browse mode, uses flat/v2 data
- `sendUndersForMatch()` - Match mode, shows all under lines 0.5-4.5

**`app/api/whatsapp/test-command/helper-functions.ts`**:
- `getBTTSPicksMessage()` - Test route helper
- `getOversPicksMessage()` - Test route helper
- `getOversForMatchMessage()` - Test route helper, all goal lines
- `getUndersPicksMessage()` - Test route helper
- `getUndersForMatchMessage()` - Test route helper, all under lines

---

## Data Structure

### Primary Data Source: `QuickPurchase.predictionData`

The prediction data for each match is stored in the `predictionData` JSON field of the `QuickPurchase` table.

### Data Paths (Priority Order)

#### 1. `additional_markets_flat` (BEST - Use First)
Flat structure with ALL markets:
```json
{
  "btts_yes": 0.413,
  "btts_no": 0.587,
  "totals_over_0_5": 0.874,
  "totals_over_1_5": 0.613,
  "totals_over_2_5": 0.342,
  "totals_over_3_5": 0.156,
  "totals_over_4_5": 0.059,
  "totals_under_0_5": 0.126,
  "totals_under_1_5": 0.387,
  "totals_under_2_5": 0.658,
  "totals_under_3_5": 0.844,
  "totals_under_4_5": 0.941,
  "dnb_home": 0.439,
  "dnb_away": 0.561,
  "double_chance_1X": 0.607,
  "double_chance_X2": 0.693,
  "double_chance_12": 0.699,
  "win_to_nil_home": 0.2,
  "win_to_nil_away": 0.261,
  "clean_sheet_home": 0.326,
  "clean_sheet_away": 0.387
}
```

#### 2. `additional_markets_v2` (Nested Structure)
```json
{
  "btts": { "yes": 0.413, "no": 0.587 },
  "totals": {
    "0_5": { "over": 0.874, "under": 0.126 },
    "1_5": { "over": 0.613, "under": 0.387 },
    "2_5": { "over": 0.342, "under": 0.658 },
    "3_5": { "over": 0.156, "under": 0.844 },
    "4_5": { "over": 0.059, "under": 0.941 }
  },
  "dnb": { "home": 0.439, "away": 0.561 },
  "double_chance": { "1X": 0.607, "X2": 0.693, "12": 0.699 },
  "correct_scores": [
    { "score": "0-1", "p": 0.141 },
    { "score": "1-1", "p": 0.134 },
    { "score": "0-0", "p": 0.126 }
  ],
  "team_totals": {
    "home": { "0_5": { "over": 0.613, "under": 0.387 } },
    "away": { "0_5": { "over": 0.674, "under": 0.326 } }
  }
}
```

#### 3. `comprehensive_analysis` (Team Analysis & Risk)
```json
{
  "ai_verdict": {
    "team_analysis": {
      "home_team": {
        "strengths": ["..."],
        "weaknesses": ["..."],
        "injury_impact": "...",
        "form_assessment": "..."
      },
      "away_team": { ... }
    },
    "risk_assessment": "Medium",
    "betting_recommendations": {
      "primary_bet": "...",
      "alternative_bets": ["..."],
      "risk_level": "Medium",
      "suggested_stake": "Moderate"
    }
  },
  "ml_prediction": {
    "probabilities": { "home_win": 0.307, "draw": 0.301, "away_win": 0.393 },
    "confidence": 0.174,
    "model_type": "pre_computed_consensus"
  }
}
```

#### 4. `predictions` (Main Prediction)
```json
{
  "home_win": 0.307,
  "draw": 0.301,
  "away_win": 0.393,
  "confidence": 0.174,
  "recommended_bet": "Lean: away_win (small stake)"
}
```

#### 5. `data_freshness` (Stats Info)
```json
{
  "h2h_matches": 3,
  "form_matches": 5,
  "home_injuries": 0,
  "away_injuries": 0
}
```

### Data Extraction Code Pattern

```typescript
const predictionData = quickPurchase.predictionData as any;

// Try additional_markets_flat first (most complete)
const flat = predictionData?.additional_markets_flat;
const totalsV2 = predictionData?.additional_markets_v2?.totals;
const additionalMarkets = predictionData?.additional_markets || 
                          predictionData?.prediction?.additional_markets;

let over25: number | undefined;
let under25: number | undefined;

if (flat) {
  over25 = flat.totals_over_2_5;
  under25 = flat.totals_under_2_5;
} else if (totalsV2?.['2_5']) {
  over25 = totalsV2['2_5'].over;
  under25 = totalsV2['2_5'].under;
} else if (additionalMarkets?.total_goals) {
  over25 = additionalMarkets.total_goals.over_2_5;
  under25 = additionalMarkets.total_goals.under_2_5;
}
```

---

## Pending Implementation

### New Commands to Implement

| Command | Priority | Data Source | Description |
|---------|----------|-------------|-------------|
| **CS** (browse) | High | `additional_markets_v2.correct_scores` | Correct score predictions |
| **CS [Match ID]** | High | Same | Detailed correct scores for match |
| **REASON [Match ID]** | Medium | `comprehensive_analysis.ai_verdict.team_analysis` | Team strengths/weaknesses/injuries |
| **RISK [Match ID]** | Medium | `comprehensive_analysis.ai_verdict.risk_assessment` + `betting_recommendations` | Risk level, stake suggestion |
| **CONFIDENCE [Match ID]** | Medium | `comprehensive_analysis.ml_prediction` + `predictions` | Probability breakdown |
| **VALUE [Match ID]** | Medium | `QuickPurchase.odds` + `valueRating` | Value assessment |
| **ALT [Match ID]** | Medium | `additional_markets_v2` (btts, totals, double_chance, dnb) | Alternative bets |
| **STATS [Match ID]** | Low | `data_freshness` + `comprehensive_analysis` | Match stats snapshot |
| **MORE [Match ID]** | Low | All markets aggregated | All available markets |

### Message Formats for Pending Commands

See `WHATSAPP_COMMANDS_MESSAGES.md` for detailed message formats for each command.

### Implementation Steps

1. Add command handler in `app/api/whatsapp/webhook/route.ts`
2. Add helper function in `app/api/whatsapp/test-command/helper-functions.ts`
3. Update command routing in `handleIncomingText()`
4. Update `lib/whatsapp-messages.ts` MENU/HELP if needed
5. Test via `/whatsapp/test` page

---

## Key Files Reference

### Core Implementation Files

| File | Purpose |
|------|---------|
| `app/api/whatsapp/webhook/route.ts` | Main webhook handler, all command implementations |
| `app/api/whatsapp/test-command/route.ts` | Test endpoint for commands |
| `app/api/whatsapp/test-command/helper-functions.ts` | Helper functions for test route |
| `lib/whatsapp-messages.ts` | Centralized message templates (MENU, HELP, WELCOME) |
| `lib/whatsapp-service.ts` | WhatsApp API service (send text, image, interactive) |
| `lib/whatsapp-premium.ts` | Premium access checking |
| `lib/whatsapp-payment.ts` | Payment session creation |

### Database Schema

| Table | Purpose |
|-------|---------|
| `QuickPurchase` | Match predictions with `predictionData` JSON |
| `WhatsAppUser` | WhatsApp user tracking |
| `WhatsAppPurchase` | Individual pick purchases |
| `ParlayConsensus` | Parlay predictions |
| `UserPackage` | VIP subscription packages |

### Documentation Files

| File | Purpose |
|------|---------|
| `WHATSAPP_COMMANDS_MESSAGES.md` | Complete message formats for all commands |
| `WHATSAPP_COMMANDS_UPDATE_ROADMAP.md` | Implementation roadmap and data analysis |
| `WHATSAPP_COMMANDS_TABLE.md` | Command reference table |
| `WHATSAPP_IMPLEMENTATION_HANDOFF.md` | This handoff document |

---

## Testing

### Test Endpoint
```
http://localhost:3000/whatsapp/test
```

Enter commands in the input field to test responses.

### Test Commands
```
BTTS
BTTS 1391942
OVERS
OVERS 1391942
UNDERS
UNDERS 1391942
MENU
HELP
BUY
```

### Verify Data Extraction

Run this script to verify data is being read correctly:
```javascript
// debug-script.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkData() {
  const match = await prisma.quickPurchase.findFirst({
    where: { isActive: true, predictionData: { not: null } },
    select: { matchId: true, name: true, predictionData: true }
  });
  
  const pd = match.predictionData;
  console.log('Match:', match.name);
  console.log('Has flat:', !!pd.additional_markets_flat);
  console.log('Has v2:', !!pd.additional_markets_v2);
  
  if (pd.additional_markets_flat) {
    console.log('BTTS Yes:', pd.additional_markets_flat.btts_yes);
    console.log('Over 2.5:', pd.additional_markets_flat.totals_over_2_5);
  }
  
  await prisma.$disconnect();
}
checkData();
```

---

## Related Documentation

### Files to Read for Context

1. **`WHATSAPP_COMMANDS_MESSAGES.md`** - Complete message formats
2. **`WHATSAPP_COMMANDS_UPDATE_ROADMAP.md`** - Implementation roadmap
3. **`WHATSAPP_COMMANDS_TABLE.md`** - Command reference
4. **`prisma/schema.prisma`** - Database schema
5. **`lib/whatsapp-service.ts`** - WhatsApp API integration

### Quick Start for New Agent

1. Read this handoff document
2. Read `WHATSAPP_COMMANDS_MESSAGES.md` for message formats
3. Check `app/api/whatsapp/webhook/route.ts` for existing implementations
4. Use the data extraction pattern shown above
5. Test via `/whatsapp/test` endpoint

---

## Summary

### Completed
- ✅ Fixed BTTS/OVERS/UNDERS to read from correct data fields
- ✅ Enhanced OVERS/UNDERS [Match ID] to show all goal lines (0.5-4.5)
- ✅ Created comprehensive documentation

### Pending
- ⏳ CS (Correct Score) command
- ⏳ REASON [Match ID] command
- ⏳ RISK [Match ID] command
- ⏳ CONFIDENCE [Match ID] command
- ⏳ VALUE [Match ID] command
- ⏳ ALT [Match ID] command
- ⏳ STATS [Match ID] command
- ⏳ MORE [Match ID] command

### Key Insight
The data exists in `predictionData.additional_markets_flat` and `predictionData.additional_markets_v2`. Always check these first before falling back to `additional_markets`.

---

*Last Updated: December 18, 2025*

