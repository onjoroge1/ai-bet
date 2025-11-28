# Session Crossover - Comprehensive Root Cause Analysis

**Date**: December 2024  
**Status**: 🔴 **CRITICAL ISSUE - ANALYSIS REQUIRED**  
**Problem**: New users seeing previous user's information after login

---

## 🎯 Problem Statement

**User Report**:
- User A logs in → sees their data ✅
- User A logs out
- User B logs in → sees User A's data ❌ (session crossover)

**Critical Question**: Is this a single-user scenario (one browser, sequential logins) or multi-user scenario (multiple users logging in simultaneously)?

---

## 🔍 Infrastructure Layers Analysis

### **Layer 1: Browser Cookie Isolation** ✅ **ISOLATED**

**How It Works**:
- NextAuth sets session cookie: `next-auth.session-token` (dev) or `__Secure-next-auth.session-token` (prod)
- Cookie is **browser-scoped** - each browser instance gets its own cookie
- Cookie is **domain-scoped** - only accessible by your domain

**Current Implementation**:
```typescript
// lib/auth.ts
cookies: {
  sessionToken: {
    name: process.env.NODE_ENV === 'production' 
      ? '__Secure-next-auth.session-token' 
      : 'next-auth.session-token',
    options: {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 24 * 60 * 60, // 24 hours
    },
  },
}
```

**Assessment**: ✅ **SAFE**
- Cookies are isolated per browser
- HttpOnly prevents JavaScript access
- SameSite prevents CSRF attacks
- **No cookie sharing between users**

---

### **Layer 2: Session Token Uniqueness** ✅ **UNIQUE**

**How NextAuth Generates Tokens**:
- Each login generates a **unique JWT token**
- Token includes: user ID, email, role, referral code
- Token is cryptographically signed with `NEXTAUTH_SECRET`
- Even same user logging in twice = two different tokens

**Token Structure**:
```typescript
// lib/auth.ts - JWT callback
token.id = user.id        // User-specific
token.email = user.email  // User-specific
token.name = user.name    // User-specific
```

**Assessment**: ✅ **SAFE**
- Tokens are unique per session
- Even same user gets different tokens on each login
- **No token reuse between users**

---

### **Layer 3: Redis Session Cache** ⚠️ **POTENTIAL ISSUE**

**Current Cache Key Strategy**:
```typescript
// lib/session-cache.ts
const cacheKey = `session:${sessionToken}`
// Example: auth:session:eyJhbGciOiJkaXIiLCJlbmMiOiJBMjU2R0NNIn0...
```

**How It Works**:
1. User A logs in → Token A → Cache key: `auth:session:TokenA` → User A's data
2. User A logs out → Cache cleared for Token A
3. User B logs in → Token B → Cache key: `auth:session:TokenB` → Should be User B's data

**Critical Questions**:
1. **Is cache being cleared on logout?** ✅ (Yes - `clearCachedSession()`)
2. **Is cache being cleared between logins?** ⚠️ (Maybe - depends on timing)
3. **Can old cache entries persist?** ⚠️ (TTL is 5 seconds, but what if...)

**Potential Issues**:
- **Race Condition**: User B logs in before User A's cache expires
- **Cache Key Collision**: If session tokens somehow collide (extremely unlikely but possible)
- **Cache Not Cleared**: If logout doesn't clear cache properly
- **Stale Cache Returned**: If cache returns before fresh session is validated

**Assessment**: ⚠️ **NEEDS INVESTIGATION**
- Cache keys are unique per token ✅
- But cache clearing timing could be an issue ⚠️

---

### **Layer 4: Server-Side Session Validation** ✅ **VALIDATED**

**Session API Route Flow**:
```typescript
// app/api/auth/session/route.ts
1. Get session token from cookie
2. Verify cookie exists → return null if not
3. Call getServerSession() → validates token + returns session
4. Check Redis cache (only if session valid)
5. Return session data
```

**Critical Validation**:
- ✅ Always validates session via `getServerSession()` BEFORE checking cache
- ✅ Only caches if session is valid
- ✅ Returns null if no session/cookie

**Assessment**: ✅ **SAFE**
- Session validation happens before cache check
- NextAuth validates token signature
- **No way to get wrong user's session from cookie**

---

### **Layer 5: API Route User Identification** ✅ **USER-SPECIFIC**

**Dashboard Data API**:
```typescript
// app/api/user/dashboard-data/route.ts
const session = await getServerSession(authOptions) // Gets session from cookie
const user = await prisma.user.findUnique({
  where: { id: session.user.id } // Queries by user ID from session
})
```

**Critical Flow**:
1. API reads session from **user's cookie**
2. Extracts user ID from **validated session**
3. Queries database for **that specific user ID**
4. Returns data for **that user only**

**Assessment**: ✅ **SAFE**
- API always uses session.user.id from validated session
- Database queries are scoped to user ID
- **No way to get wrong user's data from database**

---

### **Layer 6: Client-Side React Query Cache** 🔴 **CRITICAL ISSUE**

**Current Implementation**:
```typescript
// hooks/use-dashboard-data.ts
const { data } = useQuery({
  queryKey: ['dashboard-data', userId],
  queryFn: async () => {
    const response = await fetch('/api/user/dashboard-data')
    return response.json()
  },
  staleTime: 5 * 60 * 1000, // 5 minutes
  gcTime: 10 * 60 * 1000, // 10 minutes
})
```

**Critical Issues**:

#### **Issue #1: Stale React Query Cache** 🔴 **ROOT CAUSE #1**

**Scenario**:
```
1. User A logs in → userId = "userA"
   → React Query caches: ['dashboard-data', "userA"] → User A's data
   
2. User A logs out
   → Cache should be cleared ✅ (SignInForm clears cache)
   
3. User B logs in → userId = "userB"
   → React Query should cache: ['dashboard-data', "userB"] → User B's data
   
BUT: If cache wasn't cleared, User B might see:
   - Old cache entry: ['dashboard-data', "userA"] → User A's data ❌
   - OR: Stale data from previous session
```

**Why This Happens**:
- React Query cache persists across page reloads (in memory)
- If cache isn't cleared on logout/login, old data persists
- `userId` might be `null` initially, causing cache key mismatch

**Assessment**: 🔴 **ROOT CAUSE**
- Cache clearing might not be working
- Cache might persist between sessions
- Query keys might not change properly

---

#### **Issue #2: userId State Management** 🔴 **ROOT CAUSE #2**

**Current Implementation**:
```typescript
// hooks/use-dashboard-data.ts
const [userId, setUserId] = useState<string | null>(null)

useEffect(() => {
  const checkAuth = async () => {
    const session = await getSession()
    if (session?.user?.id) {
      setUserId(session.user.id) // ⚠️ Only sets if different
    }
  }
  checkAuth()
}, []) // Empty deps - only runs once on mount
```

**Critical Issues**:
1. **Empty dependency array**: Hook only checks session once on mount
2. **userId starts as null**: Query key is `['dashboard-data', null]` initially
3. **Race condition**: If component mounts before session is ready, userId stays null
4. **Stale userId**: If session changes but component doesn't re-check, userId stays old

**Assessment**: 🔴 **ROOT CAUSE**
- Hook doesn't react to session changes
- userId might be stale
- Query might use wrong userId in cache key

---

#### **Issue #3: Query Key Stability** ⚠️ **POTENTIAL ISSUE**

**Current Query Key**:
```typescript
queryKey: ['dashboard-data', userId]
```

**Issues**:
- If `userId` is `null` initially, cache key is `['dashboard-data', null]`
- If `userId` changes from `null` to actual ID, React Query creates new cache entry
- But old cache entry with `null` might still exist
- If component briefly shows `null` userId again, it might hit old cache

**Assessment**: ⚠️ **POTENTIAL ISSUE**
- Query keys with `null` could cause cache confusion
- Multiple cache entries for same logical query

---

### **Layer 7: Next.js API Route Caching** ⚠️ **POTENTIAL ISSUE**

**Next.js Config**:
```typescript
// next.config.js
{
  source: '/api/(.*)',
  headers: [
    {
      key: 'Cache-Control',
      value: 'public, max-age=300, s-maxage=300', // ⚠️ 5 minutes caching!
    },
  ],
}
```

**Critical Issue**:
- Next.js is caching **all API routes** for 5 minutes
- This includes `/api/user/dashboard-data` which is **user-specific**!
- If User A calls API, Next.js caches the response
- If User B calls same API (different user, same URL), Next.js might return cached User A's response!

**Assessment**: 🔴 **ROOT CAUSE #3**
- API route caching doesn't account for user context
- Same URL = same cache key (even if different users)
- **This is a critical security and privacy issue**

---

## 🔴 **ROOT CAUSES IDENTIFIED**

### **Root Cause #1: React Query Cache Not Properly Cleared** 🔴 **CRITICAL**

**Problem**:
- React Query cache persists between user sessions
- Cache entries might not be cleared on logout/login
- Old cache entries with wrong userId might be returned

**Evidence**:
- User B sees User A's data
- Navigation shows correct user (uses `useSession()` directly)
- Dashboard shows wrong user (uses React Query cache)

---

### **Root Cause #2: userId State Management** 🔴 **CRITICAL**

**Problem**:
- `use-dashboard-data` hook only checks session once on mount
- If component mounts before session is ready, userId stays `null`
- If session changes, hook doesn't react to changes
- Query might use stale or null userId

**Evidence**:
- Hook uses empty dependency array `[]`
- No reactive session checking
- userId might not update when user changes

---

### **Root Cause #3: Next.js API Route Caching** 🔴 **CRITICAL SECURITY ISSUE**

**Problem**:
- Next.js config caches ALL API routes for 5 minutes
- `/api/user/dashboard-data` is user-specific but cached without user context
- Same URL path = same cache key (ignores user)
- User B might get User A's cached response

**Evidence**:
```javascript
// next.config.js
{
  source: '/api/(.*)', // Matches ALL API routes
  headers: [
    {
      key: 'Cache-Control',
      value: 'public, max-age=300, s-maxage=300', // ⚠️ Caches for ALL users!
    },
  ],
}
```

**Security Impact**: 🔴 **CRITICAL**
- User B can see User A's data
- Privacy violation
- Data leakage

---

### **Root Cause #4: Cache Clearing Timing** ⚠️ **HIGH**

**Problem**:
- Cache clearing happens during logout
- But if User B logs in quickly, they might see:
  - Stale React Query cache (not cleared yet)
  - Stale Next.js API cache (not expired yet)
  - Stale Redis session cache (TTL hasn't expired)

**Evidence**:
- Cache clearing is async
- No verification that cache is actually cleared
- Multiple cache layers (React Query + Next.js + Redis)

---

## 🔍 **Multi-User Login Analysis**

### **Can Multiple Users Log In Simultaneously?** ✅ **YES**

**NextAuth Architecture**:
- Each user gets their own unique session token ✅
- Each browser gets its own cookie ✅
- Sessions are stored in JWT (stateless) ✅
- No shared session storage ✅

**Infrastructure Support**:
- ✅ **Browser Isolation**: Each browser has its own cookies
- ✅ **Token Uniqueness**: Each login generates unique token
- ✅ **Server Stateless**: No server-side session storage (JWT strategy)
- ✅ **Database Queries**: Scoped to user ID from session

**Assessment**: ✅ **YES - Multiple users can log in simultaneously**
- NextAuth is designed for multi-user
- Each user is isolated by cookie + token
- Server queries are scoped to user ID

---

### **But There Are Cache Issues** 🔴

**Problem**:
- Even though sessions are isolated, **caches might not be**
- Next.js API route cache doesn't differentiate users
- React Query cache might persist across sessions
- Redis cache might have timing issues

**Assessment**: ⚠️ **Multi-user login works, but caches can leak data**

---

## 💡 **Prevention Strategies**

### **Strategy 1: Remove API Route Caching for User-Specific Routes** ⭐ **CRITICAL**

**Fix**:
- Remove caching from `/api/user/*` routes
- Only cache public, non-user-specific routes
- Use `Cache-Control: private, no-cache` for user routes

**Why**:
- User-specific data should NEVER be cached at CDN/Next.js level
- Each user's request is unique
- Caching breaks user isolation

---

### **Strategy 2: Always Include userId in Query Keys** ⭐ **CRITICAL**

**Fix**:
- Ensure ALL user-specific queries include userId in query key
- Don't allow `null` userId in query keys
- Clear queries when userId is null

**Why**:
- React Query uses query keys for cache isolation
- If query key doesn't include userId, cache isn't user-specific
- Null userId causes cache confusion

---

### **Strategy 3: Verify Cache Clearing on Logout/Login** ⭐ **HIGH**

**Fix**:
- Verify React Query cache is cleared
- Verify Next.js cache is cleared (or use no-cache headers)
- Verify Redis cache is cleared
- Add verification logs

**Why**:
- Multiple cache layers need to be cleared
- Cache clearing might be failing silently
- Need to verify it actually works

---

### **Strategy 4: Make use-dashboard-data Reactive** ⭐ **HIGH**

**Fix**:
- Use `useSession()` directly instead of manual session checking
- Let React Query automatically refetch when session changes
- Remove manual session polling

**Why**:
- `useSession()` is reactive and handles session changes
- Manual polling is error-prone
- Better integration with NextAuth

---

### **Strategy 5: Add Cache Invalidation Headers** ⭐ **HIGH**

**Fix**:
- Add `Cache-Control: private, no-cache` to all user-specific API routes
- Prevent Next.js/CDN from caching user data
- Ensure each request is fresh

**Why**:
- Prevents Next.js from caching user-specific responses
- Forces fresh data on every request
- Better user isolation

---

## 🎯 **Recommended Action Plan**

### **Priority 1: Fix Next.js API Caching** 🔴 **CRITICAL SECURITY**

1. Remove caching from user-specific routes
2. Add `Cache-Control: private, no-cache` headers
3. Only cache public, non-user routes

### **Priority 2: Fix React Query Cache** 🔴 **CRITICAL**

1. Ensure cache is cleared on logout
2. Ensure cache is cleared on login
3. Add userId to all query keys
4. Verify cache clearing works

### **Priority 3: Fix userId State Management** ⚠️ **HIGH**

1. Use `useSession()` directly
2. Remove manual session checking
3. Let React Query handle reactivity

### **Priority 4: Add Verification Logging** ⚠️ **HIGH**

1. Log cache clearing operations
2. Log userId in all queries
3. Log cache hits/misses
4. Monitor for cache leaks

---

## 📋 **Questions to Answer**

1. **Is this happening on the same browser?** (sequential logins)
   - Or different browsers? (simultaneous logins)

2. **Is React Query cache actually being cleared?**
   - Check browser DevTools → Application → Storage → IndexedDB
   - Look for React Query cache entries

3. **Is Next.js API cache the culprit?**
   - Check Network tab → Response Headers → Cache-Control
   - See if API responses are cached

4. **When exactly does User B see User A's data?**
   - Immediately after login?
   - After page refresh?
   - After navigating?

5. **Does this happen every time, or intermittently?**
   - If intermittent, points to race condition
   - If consistent, points to cache configuration

---

**Document Created**: December 2024  
**Status**: 🔴 **ANALYSIS COMPLETE - ROOT CAUSES IDENTIFIED**  
**Next Step**: Review findings and prioritize fixes

