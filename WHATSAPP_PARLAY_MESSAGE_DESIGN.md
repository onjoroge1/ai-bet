# WhatsApp Parlay Message Design

## Overview
This document explains the design for displaying parlay picks to WhatsApp users, with different formats for free and premium users.

## Design Principles

### 1. **Free Users (1 Parlay Preview)**
- **Complete Details**: Show ALL legs of the single parlay with full information
- **Purpose**: Give users a complete preview so they understand the value
- **Format**: Full parlay breakdown with every leg detailed

### 2. **Premium Users (Multiple Parlays)**
- **First Parlay**: Full details with ALL legs (same as free users get)
- **Additional Parlays**: Summary format with key metrics and preview of first 2 legs
- **Purpose**: Show breadth of options while keeping message manageable
- **Interaction**: Users can request full details by sending any Match ID from a parlay

## Message Format Details

### Free User Format

```
🔗 **AI PARLAY**

**Preview - Complete Parlay Details:**

**3 Leg Parlay**
Edge: 8.5%
Combined Odds: 4.25
Confidence: 23.5%

**All Legs:**

**Leg 1:**
Manchester United vs Liverpool
Pick: Home Win
Odds: 2.10
Match ID: 12345
Edge: +5.2%

**Leg 2:**
Arsenal vs Chelsea
Pick: Away Win
Odds: 1.85
Match ID: 12346
Edge: +3.1%

**Leg 3:**
Barcelona vs Real Madrid
Pick: Draw
Odds: 3.20
Match ID: 12347
Edge: +2.3%

**Earliest Kickoff:** Dec 15, 2024 3:00 PM

──────────────────────────────

🔒 **Want unlimited parlays?**

Upgrade to VIP to access:
• Unlimited parlay picks
• Multiple parlay options
• All premium markets

Send 'BUY' to see pricing options!
```

### Premium User Format

```
🔗 **AI PARLAYS**

Found 5 upcoming parlays:

**📋 PARLAY 1 (Full Details):**

3 legs | Edge: 8.5% | Odds: 4.25
Confidence: 23.5%

**All Legs:**

**Leg 1:**
Manchester United vs Liverpool
Pick: Home Win
Odds: 2.10
Match ID: 12345
Edge: +5.2%
Probability: 47.6%

**Leg 2:**
Arsenal vs Chelsea
Pick: Away Win
Odds: 1.85
Match ID: 12346
Edge: +3.1%
Probability: 54.1%

**Leg 3:**
Barcelona vs Real Madrid
Pick: Draw
Odds: 3.20
Match ID: 12347
Edge: +2.3%
Probability: 31.3%

**Earliest Kickoff:** Dec 15, 2024 3:00 PM

──────────────────────────────

**📊 Additional Parlays:**

**Parlay 2:**
4 legs | Edge: 6.2% | Odds: 5.50
Confidence: 18.2%
Legs preview:
  1. Tottenham vs Newcastle - H @ 1.95
  2. City vs Brighton - A @ 2.30
  ... and 2 more legs
  Match IDs: 12348, 12349, 12350, 12351

**Parlay 3:**
2 legs | Edge: 12.1% | Odds: 2.75
Confidence: 36.4%
Legs preview:
  1. PSG vs Marseille - H @ 1.75
  2. Bayern vs Dortmund - H @ 1.90
  Match IDs: 12352, 12353

**Parlay 4:**
5 legs | Edge: 4.8% | Odds: 8.20
Confidence: 12.2%
Legs preview:
  1. Juventus vs Inter - D @ 3.10
  2. Atletico vs Sevilla - H @ 2.05
  ... and 3 more legs
  Match IDs: 12354, 12355, 12356...

**Parlay 5:**
3 legs | Edge: 7.3% | Odds: 3.85
Confidence: 26.0%
Legs preview:
  1. Leeds vs Villa - A @ 2.15
  2. Wolves vs Everton - H @ 1.88
  ... and 1 more leg
  Match IDs: 12357, 12358, 12359

💡 **To see full details of any parlay:**
Send any Match ID from that parlay to get the complete analysis!
```

## Key Design Decisions

### 1. **Why Show ALL Legs for Free Users?**
- **Value Demonstration**: Users need to see the complete parlay to understand what they're getting
- **Transparency**: Shows all picks, odds, and edges so users can evaluate quality
- **Conversion**: Complete preview increases likelihood of upgrade

### 2. **Why Summary Format for Premium Additional Parlays?**
- **Message Length**: WhatsApp has 4096 character limit
- **Information Overload**: Too many full details would be overwhelming
- **Efficiency**: Users can quickly scan multiple options
- **Flexibility**: Users can request details for specific parlays they're interested in

### 3. **Why Match ID Interaction?**
- **On-Demand Details**: Users only get full details for parlays they care about
- **Reduces Message Size**: Keeps initial message manageable
- **Better UX**: Users control what information they see
- **Scalable**: Works even with 10+ parlays

## Implementation Details

### Function Structure

1. **`formatFreeUserParlay(parlay)`**
   - Formats single parlay with ALL legs
   - Includes complete leg details (teams, pick, odds, match ID, edge)
   - Adds upgrade prompt

2. **`formatPremiumUserParlays(parlays)`**
   - Formats first parlay with full details (all legs)
   - Formats remaining parlays as summaries
   - Includes interaction instructions

3. **`formatParlayFullDetails(parlay)`**
   - Helper to format complete parlay details
   - Used for first parlay in premium list
   - Can be reused when user requests details via Match ID

4. **Fallback Functions**
   - `formatSingleParlayCompact()`: Compact version if message too long
   - `formatPremiumUserParlaysCompact()`: Ultra-compact for premium users

### Message Length Handling

- **Primary Format**: Full details (may exceed 4096 chars)
- **Fallback 1**: Compact format (reduced details)
- **Fallback 2**: Ultra-compact (minimal info)
- **Final Safety**: Truncate with "..." if still too long

## Future Enhancements

### 1. **Match ID Command Handler**
When a user sends a Match ID, we could:
- Find all parlays containing that match
- Show full details of those parlays
- Provide context about why that match appears in multiple parlays

### 2. **Parlay Filtering Commands**
- `PARLAY HIGH` - Only high confidence parlays
- `PARLAY 2LEG` - Only 2-leg parlays
- `PARLAY TODAY` - Only parlays for today's matches

### 3. **Parlay Comparison**
- Show side-by-side comparison of similar parlays
- Highlight differences between options

## Testing Scenarios

### Scenario 1: Free User - Single 3-Leg Parlay
- **Expected**: Full details of all 3 legs + upgrade prompt
- **Message Length**: ~800-1000 characters

### Scenario 2: Free User - Single 5-Leg Parlay
- **Expected**: Full details of all 5 legs + upgrade prompt
- **Message Length**: ~1500-1800 characters
- **Fallback**: May need compact format if very long team names

### Scenario 3: Premium User - 5 Parlays (3-4 legs each)
- **Expected**: First parlay full details, others summarized
- **Message Length**: ~2500-3500 characters
- **Fallback**: Compact format if needed

### Scenario 4: Premium User - 10 Parlays
- **Expected**: First parlay full, others very compact summaries
- **Message Length**: May approach limit
- **Fallback**: Ultra-compact format

## Code Location

The implementation is in:
- **File**: `app/api/whatsapp/webhook/route.ts`
- **Function**: `sendParlayPicks(to: string)`
- **Helper Functions**: 
  - `formatFreeUserParlay()`
  - `formatPremiumUserParlays()`
  - `formatParlayFullDetails()`
  - `formatSingleParlayCompact()`
  - `formatPremiumUserParlaysCompact()`

