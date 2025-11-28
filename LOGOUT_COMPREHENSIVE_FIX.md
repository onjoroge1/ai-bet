# Comprehensive Logout Fix - useSession() Stale Cache

**Date**: December 2024  
**Status**: 🔴 **CRITICAL FIX REQUIRED**  
**Issue**: `/api/auth/session` returns null (correct) but `useSession()` shows authenticated (stale cache)

---

## 🐛 Root Cause Analysis

### **Issue #1: Custom Session Route Returns Stale Redis Cache** ❌ **CRITICAL**

**Problem**:
- Our custom `/api/auth/session/route.ts` checks Redis cache FIRST
- After logout, Redis cache might still have session data
- Even though cookie is cleared, Redis cache returns stale session
- `useSession()` gets stale data from Redis cache

**Flow**:
```
1. User logs out
2. Cookie is cleared ✅
3. Redis cache is cleared (or should be)
4. useSession() calls /api/auth/session
5. Our route checks Redis cache first
6. Redis cache might still have session ❌
7. Returns stale session to useSession() ❌
```

**Evidence**:
```typescript
// app/api/auth/session/route.ts:32-61
if (sessionToken) {
  const cached = await getCachedSession(sessionToken) // Checks Redis FIRST
  
  if (cached) {
    return NextResponse.json(validSession) // Returns cached data
  }
}
// Only checks NextAuth if cache miss
const session = await getServerSession(authOptions)
```

**Problem**: 
- If Redis cache has stale data, it's returned immediately
- Never checks if cookie actually exists
- `getServerSession()` is only called on cache miss

---

### **Issue #2: Redis Cache Not Fully Cleared** ❌ **CRITICAL**

**Problem**:
- We clear Redis cache by session token
- But if cache key doesn't match exactly, cache persists
- Multiple cache entries might exist

---

### **Issue #3: useSession() React Query Cache Not Cleared** ❌ **CRITICAL**

**Problem**:
- NextAuth's `useSession()` uses React Query internally
- React Query caches session data
- After logout, React Query cache might still have session
- `update()` might not clear React Query cache properly

---

### **Issue #4: Competing Auth Infrastructure** ⚠️ **HIGH**

**Current Setup**:
1. NextAuth's `useSession()` - expects NextAuth behavior
2. Custom `/api/auth/session` route - intercepts, adds Redis caching
3. Custom session request manager - for direct API calls
4. Redis session caching - adds another layer

**Conflict**:
- `useSession()` calls `/api/auth/session`
- Our custom route intercepts it
- Redis cache might have stale data
- `useSession()` gets stale data

---

## 💡 Solutions

### **Solution 1: Check Cookie Before Returning Cached Data** ⭐ **CRITICAL**

**Fix**: Always verify cookie exists before returning cached session

```typescript
// app/api/auth/session/route.ts
export async function GET(request: NextRequest) {
  // Get session token from cookies
  const sessionToken = getSessionTokenFromCookies(request.cookies)
  
  // ✅ CRITICAL FIX: Check if session token exists in cookie FIRST
  // If no cookie, don't return cached data (cookie was cleared)
  if (!sessionToken) {
    // No cookie means logged out - clear cache and return null
    logger.debug('Session API - No session token in cookie, returning null', {
      tags: ['auth', 'session-api'],
    })
    return NextResponse.json({ user: null, expires: null })
  }
  
  // Now check Redis cache
  if (sessionToken) {
    const cached = await getCachedSession(sessionToken)
    
    // ✅ CRITICAL FIX: Verify cookie still exists before returning cache
    // If cookie was cleared, cache is stale
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      // Cookie was cleared but cache exists - return null
      logger.warn('Session API - Cache exists but cookie cleared, returning null', {
        tags: ['auth', 'session-api', 'stale-cache'],
      })
      return NextResponse.json({ user: null, expires: null })
    }
    
    if (cached && session?.user) {
      // Cache and cookie both exist - return cached
      return NextResponse.json(cached)
    }
  }
  
  // Cache miss or no cookie - get from NextAuth
  const session = await getServerSession(authOptions)
  // ...
}
```

---

### **Solution 2: Clear All Session Caches on Logout** ⭐ **CRITICAL**

**Fix**: Clear all Redis cache entries (not just one token)

```typescript
// Clear ALL session caches, not just one
await clearAllSessionCaches()
```

---

### **Solution 3: Clear React Query Cache for NextAuth** ⭐ **CRITICAL**

**Fix**: Explicitly clear NextAuth's React Query cache

```typescript
// Clear NextAuth's session query from React Query
queryClient.removeQueries({ 
  queryKey: ['session'], // NextAuth's query key
  exact: false 
})
```

---

### **Solution 4: Wait for useSession() to Update Before Redirect** ⭐ **HIGH**

**Fix**: Wait for `useSession()` to reflect logged-out state

```typescript
// After signOut()
await signOut({ redirect: false })

// Wait for NextAuth broadcast
await new Promise(resolve => setTimeout(resolve, 500))

// Clear React Query cache
queryClient.removeQueries({ queryKey: ['session'], exact: false })

// Force useSession() to refetch
await update()

// Wait for useSession() to update
let attempts = 0
while (attempts < 10) {
  // Check useSession() status
  const { status } = useSession()
  if (status === 'unauthenticated') {
    break
  }
  await new Promise(resolve => setTimeout(resolve, 100))
  attempts++
}

// Now redirect
```

---

## 🎯 Implementation Plan

### **Phase 1: Fix Session Route to Check Cookie First** ⭐ **CRITICAL**

1. ✅ Always check cookie before returning cached data
2. ✅ If no cookie, return null immediately
3. ✅ Verify cookie exists even if cache hit

### **Phase 2: Clear All Caches on Logout** ⭐ **CRITICAL**

1. ✅ Clear all Redis session caches
2. ✅ Clear React Query cache for NextAuth
3. ✅ Wait for useSession() to update

### **Phase 3: Remove Competing Infrastructure** ⚠️ **FUTURE**

1. Consider removing custom session route (let NextAuth handle it)
2. Or ensure custom route is fully compatible with NextAuth

---

**Document Created**: December 2024  
**Status**: 🔴 **FIX REQUIRED**  
**Next Step**: Implement fixes to check cookie before returning cache

