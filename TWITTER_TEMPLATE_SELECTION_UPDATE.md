# Twitter Template Selection Update

## Overview
Updated the Twitter automation system to allow users to select which template to use before generating and posting content.

## Changes Made

### 1. Template Structure (`lib/social/twitter-generator.ts`)
- Updated templates to match user's specification exactly
- Added template IDs, names, and categories
- Templates are now organized by category:
  - Blog Summary (5 templates)
  - Upcoming Match (2 templates)
  - Live Analysis (2 templates)
  - Parlay (1 template)
  - Brand (2 templates)

### 2. Generator Methods
- `generateMatchPost()` now accepts optional `templateId` parameter
- `generateParlayPost()` now accepts optional `templateId` parameter
- If templateId is not provided, uses first available template (for backwards compatibility)

### 3. API Endpoints
- `/api/admin/social/twitter/preview` - Now accepts `templateId` in request body
- `/api/admin/social/twitter` - Now accepts `templateId` in request body
- `/api/admin/social/twitter/templates` - NEW endpoint to fetch available templates

### 4. UI Updates Needed
The UI should include:
1. Template selection dropdown for each match/parlay
2. Preview button (requires template selection)
3. Schedule button (in preview dialog)

## Template List

### Match Templates (Blog Summary)
1. **ai-confidence** - AI Confidence (requires confidence score)
2. **ai-vs-market** - AI vs Market
3. **neutral-preview** - Neutral Preview
4. **value-signal** - Value Signal
5. **minimal** - Minimal

### Match Templates (Upcoming Match)
6. **fixture-alert** - Fixture Alert (no link)
7. **league-focus** - League Focus (no link)

### Match Templates (Live Analysis)
8. **live-momentum** - Momentum (requires live data)
9. **live-observations** - Observations (requires live data)

### Parlay Templates
10. **daily-parlay** - Daily Parlay

### Brand Templates
11. **brand-authority** - Authority (no link)
12. **brand-educational** - Educational (no link)

## Next Steps for UI Implementation

1. Add template dropdown in match/parlay list
2. Filter available templates based on match data (e.g., confidence score)
3. Update preview handler to use selected template
4. Update schedule handler to use selected template

