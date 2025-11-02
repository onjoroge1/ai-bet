# Live Match Implementation Plan

**Date:** November 1, 2025  
**Status:** Planning  
**Decision:** ✅ **Use existing `/match/[match_id]` route (no separate live route)**

---

## 🎯 Key Decision

**Use `/match/[match_id]` for ALL matches (upcoming, live, finished)**
- ❌ **No** `/match/live/[match_id]` route needed
- ✅ **Enhance** existing `/match/[match_id]` with live data detection
- ✅ **Progressive enhancement** - show live features when status=LIVE

**Rationale:**
1. **URL simplicity** - One URL format for all match states
2. **SEO friendly** - Canonical URLs, no duplicates
3. **User experience** - Same page, enhanced for live matches
4. **Maintainability** - Single codebase to maintain
5. **State transitions** - Handles upcoming → live → finished seamlessly

---

## 📊 Backend Data Structure

### **New Fields for Live Matches:**

```typescript
interface MatchData {
  // ... existing fields ...
  status: "UPCOMING" | "LIVE" | "FINISHED"
  
  // NEW: Live-specific data (only when status=LIVE)
  live_data?: {
    current_score: { home: number, away: number }
    minute: number
    period: string
    statistics: { ... }
  }
  
  momentum?: {
    home: number  // 0-100
    away: number  // 0-100
    driver_summary: {
      shots: string
      possession: string
      odds_velocity: string
    }
    minute: number
  }
  
  model_markets?: {
    updated_at: string
    win_draw_win: {
      home: number
      draw: number
      away: number
    }
    over_under: {
      over: number
      under: number
      line: number
    }
    next_goal: {
      home: number
      none: number
      away: number
    }
  }
}
```

---

## 🔌 WebSocket Integration

### **Connection Pattern:**

```typescript
// Only connect when match is LIVE
useEffect(() => {
  if (matchData?.status === 'LIVE') {
    const ws = new WebSocket(`ws://localhost:5000/ws/live/${matchId}`)
    
    ws.onmessage = (event) => {
      const delta = JSON.parse(event.data)
      updateMatchData(delta) // Merge delta updates
    }
    
    ws.onerror = () => {
      console.error('WebSocket error, falling back to polling')
      startPolling() // Fallback to HTTP polling
    }
    
    return () => ws.close()
  }
}, [matchId, matchData?.status])
```

**Fallback Strategy:**
1. **Primary:** WebSocket real-time updates
2. **Fallback:** HTTP polling every 60s if WebSocket fails
3. **Retry:** Attempt WebSocket reconnection every 5s

---

## 🎨 UI Enhancements for Live Matches

### **Live Match Indicators:**

```
┌─────────────────────────────────────────┐
│ [🔴 LIVE] Arsenal 2-1 Chelsea (67')     │
│ Premier League                           │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│ Momentum Indicator                      │
│ ══════════════════                     │
│ Arsenal 72% ▓▓▓▓▓▓▓▓░░ Chelsea 28%     │
└─────────────────────────────────────────┘

┌─────────────────────────────────────────┐
│ Live Market Updates                     │
│ Win/Draw/Win: Arsenal 68% Draw 22% ... │
│ Over 2.5: 62% | Under: 38%             │
│ Next Goal: Arsenal 55% None 25% ...    │
└─────────────────────────────────────────┘
```

---

## 🏗️ Implementation Phases

### **Phase 1: Data Layer** ✅
- [ ] Update `MatchData` interface to include live fields
- [ ] Add TypeScript types for momentum and model_markets
- [ ] Update `/api/match/[match_id]` to pass through live data

### **Phase 2: WebSocket Integration** 🔄
- [ ] Create `useLiveMatchWebSocket` custom hook
- [ ] Implement connection management
- [ ] Add delta update merging logic
- [ ] Add fallback to polling
- [ ] Add reconnection logic

### **Phase 3: UI Components** 🎨
- [ ] Create `LiveScoreCard` component
- [ ] Create `MomentumIndicator` component
- [ ] Create `LiveMarketsCard` component
- [ ] Add live badge/animations
- [ ] Update PredictionCard for live context

### **Phase 4: Progressive Enhancement** ⚡
- [ ] Detect `status=LIVE` in match detail page
- [ ] Conditionally render live components
- [ ] Add smooth transitions (upcoming → live)
- [ ] Handle match end gracefully

---

## 📝 Component Architecture

### **Live Match Detail Page Layout:**

```tsx
export default function MatchDetailPage() {
  const [matchData, setMatchData] = useState<MatchData | null>(null)
  const isLive = matchData?.status === 'LIVE'
  
  return (
    <div>
      {/* Standard Match Header */}
      <MatchHeader data={matchData} />
      
      {/* LIVE-ONLY: Live Score & Indicators */}
      {isLive && (
        <>
          <LiveScoreCard data={matchData.live_data} />
          <MomentumIndicator data={matchData.momentum} />
        </>
      )}
      
      {/* Standard Content */}
      <ConsensusOdds data={matchData.odds} />
      <PredictionCard 
        mode={isPurchased ? "full" : "preview"}
        prediction={fullPrediction}
        matchData={matchData}
      />
      
      {/* LIVE-ONLY: Live Market Updates */}
      {isLive && (
        <LiveMarketsCard data={matchData.model_markets} />
      )}
    </div>
  )
}
```

---

## 🔧 Technical Considerations

### **WebSocket Environment:**

```typescript
// Support both development and production
const getWebSocketUrl = (matchId: string) => {
  const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000'
  const wsProtocol = backendUrl.startsWith('https') ? 'wss' : 'ws'
  const wsHost = backendUrl.replace(/^https?:\/\//, '')
  return `${wsProtocol}://${wsHost}/ws/live/${matchId}`
}
```

### **Delta Updates:**

```typescript
const mergeDeltaUpdate = (current: MatchData, delta: any) => {
  return {
    ...current,
    ...delta,
    momentum: delta.momentum || current.momentum,
    model_markets: delta.model_markets || current.model_markets,
    live_data: {
      ...current.live_data,
      ...delta.live_data
    }
  }
}
```

### **Performance:**
- WebSocket messages: ~60s interval (backend-driven)
- HTTP fallback: 60s polling
- UI updates: Debounced 100ms
- Component renders: Only when data changes

---

## ✅ Success Criteria

### **Functional:**
- [ ] Live matches show real-time score updates
- [ ] Momentum indicator updates every 60s
- [ ] Live markets update every 60s
- [ ] WebSocket connects when match is live
- [ ] HTTP fallback works if WebSocket fails
- [ ] Smooth transition from upcoming → live → finished

### **Performance:**
- [ ] WebSocket latency <100ms
- [ ] Page load <2s even with WebSocket
- [ ] No performance degradation for non-live matches
- [ ] Efficient memory management (close on unmount)

### **UX:**
- [ ] Clear live indicators
- [ ] Engaging momentum visualization
- [ ] Smooth animations
- [ ] No flickering on updates
- [ ] Works on mobile

---

## 📚 Next Steps

1. **Start with TypeScript types** - Define all interfaces
2. **Build WebSocket hook** - Reusable, tested
3. **Create UI components** - Mock data first
4. **Integrate progressively** - Enhance existing page
5. **Test thoroughly** - All edge cases
6. **Deploy incrementally** - Feature flag if needed

---

## 🎉 Expected Outcome

**Users viewing a live match will see:**
- Real-time score updates
- Live momentum shifts
- Dynamic market predictions
- Engaging, responsive UI
- No page refresh needed

**All in the same URL they started with:** `/match/1234567`

---

*Last Updated: November 1, 2025*
