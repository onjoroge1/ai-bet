# Homepage Match Tables Implementation

## Overview

This document describes the implementation of match tables on the homepage that display upcoming and live matches, organized by time periods (today, tomorrow, other upcoming).

## Files Created

### 1. `components/homepage-matches.tsx`
- **Purpose**: Main component that fetches and displays match tables
- **Features**:
  - Fetches upcoming matches from `/market?status=upcoming&limit=50` endpoint
  - Fetches live matches from `/market?status=live&limit=50` endpoint
  - Groups matches by time period (today, tomorrow, other upcoming)
  - Auto-refreshes every 30 seconds
  - Displays tables in sections for live and upcoming matches

### 2. `components/marquee-ticker.tsx`
- **Purpose**: Scrolling ticker component for showcasing live updates
- **Features**:
  - Continuous scrolling animation
  - Displays sports updates and predictions
  - Auto-updates ticker items every 5 seconds
  - Shows "LIVE" badge with trending icon

## API Integration

### Endpoint Details
- **Base URL**: `http://localhost:8000/market`
- **Authentication**: Bearer token `betgenius_secure_key_2024`
- **Query Parameters**:
  - `status`: `upcoming` or `live`
  - `limit`: Maximum number of matches (default: 50)
  - `league`: Optional filter by league ID

### Expected Response Format
```json
{
  "matches": [
    {
      "id": 123,
      "status": "upcoming" | "live" | "finished",
      "homeTeam": {
        "id": 1,
        "name": "Team Name",
        "logo": "https://..."
      },
      "awayTeam": {
        "id": 2,
        "name": "Team Name",
        "logo": "https://..."
      },
      "matchDate": "2025-01-15T20:00:00Z",
      "league": {
        "id": 39,
        "name": "Premier League",
        "country": "🇬🇧"
      },
      "odds": {
        "home": 2.50,
        "draw": 3.00,
        "away": 2.75
      },
      "bookmakers": ["Bet365", "Unibet", "Pinnacle"],
      "prediction": {
        "team": "Team Name",
        "confidence": 75,
        "isPremium": false
      },
      "liveScore": { // Only for live matches
        "home": 2,
        "away": 1
      },
      "elapsed": 67 // minutes in play for live matches
    }
  ],
  "total_count": 50
}
```

## Table Structure

### Columns Displayed

1. **Match**: Team names with logos, LIVE badge for live matches, current score
2. **League**: Country flag emoji + league name
3. **Time**: 
   - For upcoming: Date/time format `dd/hh:mm`
   - For live: Elapsed time `mm:ss`
4. **Odds**: 
   - Home odds
   - Draw odds
   - Away odds
   - Bookmaker sources below
5. **Prediction**: 
   - Predicted team name
   - Confidence percentage or "Unlock Premium" badge

### Time Grouping

Matches are organized into three categories:
- **Today**: Matches scheduled for today
- **Tomorrow**: Matches scheduled for tomorrow
- **Other Upcoming**: Matches scheduled for later dates

## Component Usage

### In `app/page.tsx`

```tsx
import { HomepageMatches } from "@/components/homepage-matches"
import { MarqueeTicker } from "@/components/marquee-ticker"

// Add after hero section
<MarqueeTicker />

// Add after quiz section
<HomepageMatches />
```

## Styling

### CSS Animations

Updated `app/globals.css` with improved marquee animations:

```css
@keyframes marquee {
  0% { transform: translateX(0); }
  100% { transform: translateX(-50%); }
}

.animate-marquee {
  animation: marquee 30s linear infinite;
}

@keyframes marquee-vertical {
  0% { transform: translateY(0); }
  100% { transform: translateY(-50%); }
}

.animate-marquee-vertical {
  animation: marquee-vertical 30s linear infinite;
}
```

## Features

### Live Matches
- Displays "LIVE" badge on live matches
- Shows current score (home : away)
- Shows elapsed time in MM:SS format
- Red pulsing dot indicator

### Upcoming Matches
- Date/time display in DD/HH format
- Future prediction confidence scores
- Premium unlock badges for paid predictions

### Responsive Design
- Mobile-friendly table layout
- Horizontal scrolling on small screens
- Hover effects on table rows
- Loading and error states

## API Configuration

To use the market API, ensure:

1. Backend is running on `http://localhost:8000`
2. API endpoint `/market` is available
3. Bearer token authentication is configured
4. Response matches expected format above

## Testing

To test the implementation:

1. Start the Next.js development server: `npm run dev`
2. Visit the homepage: `http://localhost:3000`
3. Verify:
   - Marquee ticker displays with scrolling animation
   - Match tables load and display data
   - Matches are grouped by time period
   - Refresh every 30 seconds works correctly
   - Error handling displays appropriately

## Error Handling

The component includes:
- Loading state with spinner
- Error message display
- Empty state message
- Graceful fallback for missing data

## Performance

- Auto-refresh every 30 seconds
- Efficient re-rendering
- Client-side filtering and grouping
- Minimal API calls

---

**Created**: January 2025
**Status**: ✅ Complete
**Author**: AI Assistant

