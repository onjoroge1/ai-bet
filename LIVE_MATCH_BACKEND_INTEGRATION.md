# Live Match Backend Integration Summary

**Date:** November 1, 2025  
**Source:** Backend team development notes  
**Status:** ✅ **Integration Plan Ready**

---

## 📋 Backend Features Delivered

### **1. WebSocket Streaming** 🔌
- **Endpoint:** `/ws/live/{match_id}`
- **Updates:** Delta payloads every 60 seconds
- **Connection:** Auto-cleanup, graceful disconnects
- **Message Types:** Match stats, momentum, model markets

### **2. Live Data Fields** 📊
```json
{
  "live_data": {
    "current_score": {"home": 1, "away": 0},
    "minute": 67,
    "period": "Second Half",
    "statistics": {...}
  },
  "momentum": {
    "home": 72,
    "away": 28,
    "driver_summary": {
      "shots": "home_dominant",
      "possession": "balanced",
      "odds_velocity": "home_strengthening"
    },
    "minute": 67
  },
  "model_markets": {
    "updated_at": "2025-11-01T15:30:45Z",
    "win_draw_win": {"home": 0.68, "draw": 0.22, "away": 0.10},
    "over_under": {"over": 0.62, "under": 0.38, "line": 2.5},
    "next_goal": {"home": 0.55, "none": 0.25, "away": 0.20}
  }
}
```

### **3. API Updates** 🚀
- **GET `/market?status=live`** - Returns enhanced live matches
- **Single match lookup** - `GET /market?match_id=X` (already implemented)
- **V1-only mode** - `GET /market?include_v2=false` (already implemented)

### **4. Metrics & Monitoring** 📈
- Momentum Engine metrics
- Live Market Engine metrics
- WebSocket connection tracking
- Alerting rules configured

---

## ✅ Frontend Integration Strategy

### **Decision: NO Separate Route**
- ❌ NOT creating `/match/live/[id]`
- ✅ Using existing `/match/[match_id]` for all statuses
- ✅ Progressive enhancement when `status=LIVE`

### **Rationale:**
1. **URL Simplicity** - One canonical URL
2. **SEO Friendly** - No duplicate content
3. **State Transitions** - Handles upcoming → live → finished
4. **User Experience** - Same page, enhanced features
5. **Maintainability** - Single codebase

---

## 🔧 Implementation Checklist

### **Phase 1: Type Definitions** ✅ Ready
- [ ] Define `LiveData` interface
- [ ] Define `Momentum` interface
- [ ] Define `ModelMarkets` interface
- [ ] Update `MatchData` interface
- [ ] Create WebSocket delta type

### **Phase 2: WebSocket Hook** 🔌
- [ ] Create `useLiveMatchWebSocket(matchId, isLive)`
- [ ] Implement connection management
- [ ] Add delta merging logic
- [ ] Implement fallback to polling
- [ ] Add reconnection logic
- [ ] Handle errors gracefully

### **Phase 3: UI Components** 🎨
- [ ] `LiveScoreCard` - Score, minute, period
- [ ] `MomentumIndicator` - Visual momentum bar
- [ ] `LiveMarketsCard` - Win/draw/win, over/under, next goal
- [ ] Add pulsing LIVE badge
- [ ] Smooth update animations

### **Phase 4: Integration** 🔗
- [ ] Update `/api/match/[match_id]` to pass live data
- [ ] Enhance match detail page with live detection
- [ ] Add conditional rendering for live features
- [ ] Test state transitions
- [ ] Add loading states

---

## 💻 Code Examples

### **WebSocket Connection:**

```typescript
import { useEffect, useState, useRef } from 'react'

export function useLiveMatchWebSocket(matchId: string, isLive: boolean) {
  const [delta, setDelta] = useState<any>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>()
  
  useEffect(() => {
    if (!isLive) return
    
    const connect = () => {
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5000'
      const wsProtocol = backendUrl.startsWith('https') ? 'wss' : 'ws'
      const wsHost = backendUrl.replace(/^https?:\/\//, '')
      const wsUrl = `${wsProtocol}://${wsHost}/ws/live/${matchId}`
      
      const ws = new WebSocket(wsUrl)
      
      ws.onmessage = (event) => {
        const data = JSON.parse(event.data)
        setDelta(data)
      }
      
      ws.onerror = () => {
        console.error('WebSocket error')
        ws.close()
      }
      
      ws.onclose = () => {
        // Reconnect after 5s
        reconnectTimeoutRef.current = setTimeout(() => {
          if (isLive) connect()
        }, 5000)
      }
      
      wsRef.current = ws
    }
    
    connect()
    
    return () => {
      if (wsRef.current) wsRef.current.close()
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current)
    }
  }, [matchId, isLive])
  
  return { delta }
}
```

### **Delta Update Merging:**

```typescript
function mergeDeltaUpdate(current: MatchData, delta: any): MatchData {
  return {
    ...current,
    live_data: delta.live_data || current.live_data,
    momentum: delta.momentum || current.momentum,
    model_markets: delta.model_markets || current.model_markets,
  }
}
```

### **Live Match UI:**

```typescript
export default function MatchDetailPage() {
  const { matchData, ... } = useMatchData(matchId)
  const isLive = matchData?.status === 'LIVE'
  const { delta } = useLiveMatchWebSocket(matchId, isLive)
  
  // Merge delta updates
  useEffect(() => {
    if (delta && matchData) {
      setMatchData(mergeDeltaUpdate(matchData, delta))
    }
  }, [delta])
  
  return (
    <div>
      {/* Standard content for all matches */}
      <MatchHeader data={matchData} />
      <ConsensusOdds data={matchData?.odds} />
      
      {/* Live-specific content */}
      {isLive && (
        <>
          <LiveScoreCard 
            score={matchData.live_data?.current_score}
            minute={matchData.live_data?.minute}
            period={matchData.live_data?.period}
          />
          <MomentumIndicator 
            home={matchData.momentum?.home}
            away={matchData.momentum?.away}
            summary={matchData.momentum?.driver_summary}
          />
          <LiveMarketsCard markets={matchData.model_markets} />
        </>
      )}
      
      {/* Standard prediction content */}
      <PredictionCard 
        mode={isPurchased ? "full" : "preview"}
        prediction={fullPrediction}
        matchData={matchData}
      />
    </div>
  )
}
```

---

## 🧪 Testing Strategy

### **Manual Testing:**

```bash
# 1. Start backend
python main.py

# 2. Insert test live match
psql $DATABASE_URL -c "INSERT INTO fixtures ..."

# 3. Trigger momentum calculation
curl -X POST http://localhost:5000/admin/trigger-momentum

# 4. Check /market API
curl -H "Authorization: Bearer betgenius_secure_key_2024" \
     "http://localhost:5000/market?status=live"

# 5. Test WebSocket
wscat -c ws://localhost:5000/ws/live/1234567
```

### **Test Cases:**
- [ ] WebSocket connects when match goes live
- [ ] Delta updates received every 60s
- [ ] UI updates smoothly without flicker
- [ ] Fallback to polling if WebSocket fails
- [ ] Reconnection works after disconnect
- [ ] Graceful handling of match end
- [ ] No WebSocket connection for upcoming matches
- [ ] Performance not degraded

---

## 📊 Performance Targets

| Metric | Target | Status |
|--------|--------|--------|
| WebSocket latency | <100ms | ✅ Backend ready |
| Momentum calculation | <500ms | ✅ Backend ready |
| Market generation | <500ms | ✅ Backend ready |
| API response time | <2s | ✅ Achieved |
| Page load time | <2s | ✅ Target |
| UI update smoothness | 60fps | 🎯 To test |

---

## 🚀 Deployment Plan

### **Step 1: Prepare**
- [ ] Review backend API documentation
- [ ] Set up WebSocket environment variables
- [ ] Prepare testing data

### **Step 2: Implement Core**
- [ ] Add TypeScript types
- [ ] Build WebSocket hook
- [ ] Create basic UI components

### **Step 3: Integrate**
- [ ] Update match detail page
- [ ] Add conditional rendering
- [ ] Test thoroughly

### **Step 4: Polish**
- [ ] Add animations
- [ ] Optimize performance
- [ ] Mobile testing

### **Step 5: Deploy**
- [ ] Feature flag (optional)
- [ ] Gradual rollout
- [ ] Monitor metrics

---

## 📝 Environment Variables

```bash
# WebSocket Configuration
NEXT_PUBLIC_BACKEND_URL=http://localhost:5000  # or production URL
NEXT_PUBLIC_WS_ENABLED=true                    # Feature flag

# API Configuration (already configured)
NEXT_PUBLIC_MARKET_KEY=betgenius_secure_key_2024
```

---

## 🎯 Success Metrics

### **Technical:**
- ✅ WebSocket connects successfully
- ✅ Delta updates received on time
- ✅ Fallback mechanism works
- ✅ No performance regression
- ✅ Clean code, well tested

### **User Experience:**
- ✅ Real-time score updates visible
- ✅ Momentum indicator engaging
- ✅ Live markets useful
- ✅ Smooth animations
- ✅ Mobile friendly

---

## 📚 Resources

- Backend API docs: Internal documentation
- WebSocket spec: https://developer.mozilla.org/en-US/docs/Web/API/WebSocket
- Next.js WebSocket: https://nextjs.org/docs
- Testing tools: wscat, curl, browser DevTools

---

**Status:** ✅ **Ready to Implement**  
**Priority:** High  
**Estimated Time:** 1-2 days

---

*Last Updated: November 1, 2025*

