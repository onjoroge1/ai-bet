# Redis Session Cache - Logout Implementation Guide

## Question: How to Clear Redis Cache on Logout?

**Answer:** Yes, you need to clear the Redis cache when logging out. Here's how to implement it properly.

---

## Current Logout Flow

**What Happens Now:**
1. User clicks logout
2. `signOut({ redirect: false })` is called
3. NextAuth destroys the session token cookie
4. **❌ Redis cache is NOT cleared** (this is the gap)

**Problem:**
- Session token is destroyed ✅
- But Redis cache still has the session data ❌
- If someone makes a request with the old token (before TTL expires), they might get cached data

---

## Solution: Clear Cache on Logout

### Approach 1: Server-Side Cache Clearing (RECOMMENDED) ⭐

**Best Practice:** Clear cache in the NextAuth signout handler (server-side)

**Why:**
- ✅ Guaranteed to run (server-side, can't be bypassed)
- ✅ Works even if client-side code fails
- ✅ Handles all logout scenarios (button click, session expiry, etc.)

### Implementation

#### Step 1: Create Session Cache Utility

```typescript
// lib/session-cache.ts
import { cacheManager } from '@/lib/cache-manager'

const SESSION_CACHE_PREFIX = 'auth'
const SESSION_CACHE_TTL = 5 // 5 seconds

/**
 * Get cached session data
 */
export async function getCachedSession(sessionToken: string) {
  if (!sessionToken) return null
  
  const cacheKey = `session:${sessionToken}`
  return await cacheManager.get(cacheKey, { 
    prefix: SESSION_CACHE_PREFIX,
    ttl: SESSION_CACHE_TTL 
  })
}

/**
 * Set cached session data
 */
export async function setCachedSession(sessionToken: string, sessionData: any) {
  if (!sessionToken || !sessionData?.user) return false
  
  const cacheKey = `session:${sessionToken}`
  return await cacheManager.set(cacheKey, sessionData, {
    prefix: SESSION_CACHE_PREFIX,
    ttl: SESSION_CACHE_TTL
  })
}

/**
 * Clear cached session data (for logout)
 */
export async function clearCachedSession(sessionToken: string) {
  if (!sessionToken) return false
  
  const cacheKey = `session:${sessionToken}`
  return await cacheManager.delete(cacheKey, {
    prefix: SESSION_CACHE_PREFIX
  })
}

/**
 * Clear all sessions for a user (for security - logout from all devices)
 */
export async function clearAllUserSessions(userId: string) {
  // Clear all session caches for this user
  // Pattern: auth:session:*
  const pattern = `${SESSION_CACHE_PREFIX}:session:*`
  
  // Note: This requires scanning Redis keys, which can be expensive
  // Better approach: Store user->session mapping and clear specific sessions
  return await cacheManager.invalidatePattern(pattern)
}
```

#### Step 2: Integrate with NextAuth Signout

NextAuth doesn't have a built-in signout callback, but we can create a custom signout API route:

```typescript
// app/api/auth/signout/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { clearCachedSession } from '@/lib/session-cache'
import { logger } from '@/lib/logger'

export async function POST(request: NextRequest) {
  try {
    // Get the session token from cookie before it's destroyed
    const sessionToken = request.cookies.get('next-auth.session-token')?.value || 
                        request.cookies.get('__Secure-next-auth.session-token')?.value
    
    // Get token data to identify user
    const token = await getToken({ 
      req: request,
      secret: process.env.NEXTAUTH_SECRET 
    })
    
    logger.info('Signout - Clearing session cache', {
      tags: ['auth', 'signout', 'cache'],
      data: {
        userId: token?.id,
        email: token?.email,
        hasSessionToken: !!sessionToken
      }
    })
    
    // Clear Redis cache BEFORE NextAuth destroys the session
    if (sessionToken) {
      await clearCachedSession(sessionToken)
      logger.info('Session cache cleared successfully', {
        tags: ['auth', 'signout', 'cache'],
        data: { sessionToken: sessionToken.substring(0, 20) + '...' }
      })
    }
    
    // NextAuth will handle the actual session destruction
    // This route just clears the cache
    
    return NextResponse.json({ success: true })
  } catch (error) {
    logger.error('Error clearing session cache on signout', {
      tags: ['auth', 'signout', 'cache', 'error'],
      error: error instanceof Error ? error : undefined
    })
    
    // Don't fail logout if cache clearing fails
    // Session token destruction is more important
    return NextResponse.json({ success: true })
  }
}
```

#### Step 3: Update Logout Button to Call Signout API

```typescript
// components/auth/logout-button.tsx
const handleLogout = async () => {
  try {
    // Step 1: Clear React Query cache
    queryClient.invalidateQueries()
    queryClient.removeQueries()
    
    // Step 2: Clear Redis session cache (BEFORE signOut)
    try {
      await fetch('/api/auth/signout', {
        method: 'POST',
        credentials: 'include',
      })
      logger.info('Redis session cache cleared', {
        tags: ['auth', 'logout', 'cache'],
      })
    } catch (cacheError) {
      // Don't block logout if cache clearing fails
      logger.warn('Failed to clear session cache, but continuing with logout', {
        tags: ['auth', 'logout', 'cache'],
        error: cacheError instanceof Error ? cacheError : undefined,
      })
    }
    
    // Step 3: Kill session server-side (NextAuth)
    await signOut({ redirect: false })
    
    // Step 4: Redirect
    window.location.href = "/signin"
  } catch (error) {
    logger.error('Error during logout', {
      tags: ['auth', 'logout', 'error'],
      error: error instanceof Error ? error : undefined
    })
    window.location.href = "/signin"
  }
}
```

#### Step 4: Update Session API to Use Cache

```typescript
// app/api/auth/session/route.ts (NextAuth route)
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getCachedSession, setCachedSession } from '@/lib/session-cache'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const sessionToken = request.cookies.get('next-auth.session-token')?.value || 
                      request.cookies.get('__Secure-next-auth.session-token')?.value
  
  // Check cache first
  if (sessionToken) {
    const cached = await getCachedSession(sessionToken)
    if (cached) {
      return NextResponse.json(cached)
    }
  }
  
  // Generate session (NextAuth logic)
  const session = await getServerSession(authOptions)
  
  // Cache it if valid
  if (sessionToken && session?.user) {
    await setCachedSession(sessionToken, session)
  }
  
  return NextResponse.json(session)
}
```

---

## Alternative Approach: Client-Side Cache Clearing

**Less Recommended** - Only use if you can't modify server-side routes:

```typescript
// components/auth/logout-button.tsx
const handleLogout = async () => {
  try {
    // Get session token before logout
    const sessionToken = document.cookie
      .split('; ')
      .find(row => row.startsWith('next-auth.session-token='))
      ?.split('=')[1]
    
    // Clear React Query cache
    queryClient.invalidateQueries()
    queryClient.removeQueries()
    
    // Clear Redis cache via API
    if (sessionToken) {
      await fetch('/api/auth/cache/clear', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionToken }),
        credentials: 'include',
      })
    }
    
    // Kill session
    await signOut({ redirect: false })
    
    // Redirect
    window.location.href = "/signin"
  } catch (error) {
    // Handle error
  }
}
```

**Why Less Recommended:**
- ⚠️ Client-side code can be bypassed
- ⚠️ Doesn't handle session expiry automatically
- ⚠️ Requires exposing session token to client

---

## Edge Cases & Considerations

### 1. **Multiple Devices/Logout from All Devices**

If you want to log out from all devices:

```typescript
// lib/session-cache.ts
export async function clearAllUserSessions(userId: string) {
  // Store user->sessions mapping in Redis
  const userSessionsKey = `user:sessions:${userId}`
  const sessionTokens = await cacheManager.get<string[]>(userSessionsKey, {
    prefix: 'auth'
  })
  
  if (sessionTokens) {
    // Clear all session caches
    await Promise.all(
      sessionTokens.map(token => clearCachedSession(token))
    )
    
    // Clear the mapping
    await cacheManager.delete(userSessionsKey, { prefix: 'auth' })
  }
}
```

### 2. **Cache TTL Expiration**

**Good News:** Even if you forget to clear cache, it expires in 5 seconds (your TTL).

**Best Practice:** Still clear it explicitly for:
- ✅ Immediate logout (no 5-second delay)
- ✅ Security (no chance of stale data)
- ✅ Consistency (predictable behavior)

### 3. **Session Expiry (Automatic Logout)**

NextAuth sessions expire automatically. You should also clear cache on expiry:

```typescript
// lib/auth.ts - In NextAuth callbacks
callbacks: {
  async jwt({ token, user }) {
    // ... existing logic ...
    
    // Check if token is expired
    if (token.exp && token.exp * 1000 < Date.now()) {
      // Token expired - clear cache
      const sessionToken = // Get from request somehow
      await clearCachedSession(sessionToken)
    }
    
    return token
  }
}
```

**Note:** This is tricky because callbacks don't have direct access to the session token. Better to rely on TTL expiration.

### 4. **Race Conditions**

**Scenario:** User clicks logout, but another request is in flight.

**Solution:** 
- Cache TTL is short (5 seconds)
- NextAuth destroys the token immediately
- Even if cache isn't cleared, the token won't validate

**Best Practice:** Clear cache first, then destroy token (as shown in implementation above).

---

## Complete Logout Flow (With Cache)

```
1. User clicks "Logout"
   ↓
2. Clear React Query cache (client-side)
   ↓
3. Call /api/auth/signout (server-side)
   ├─ Get session token from cookie
   ├─ Clear Redis cache for that token
   └─ Return success
   ↓
4. Call signOut() (NextAuth)
   ├─ Destroy session token cookie
   └─ Broadcast logout to all tabs
   ↓
5. Redirect to /signin
   ↓
6. /signin page checks /api/auth/session
   ├─ Token doesn't exist → Cache miss
   ├─ NextAuth returns null
   └─ User sees signin page ✅
```

---

## Security Considerations

### ✅ **What's Protected:**
- Session token is HttpOnly cookie (can't be read by JavaScript)
- Cache is cleared server-side (can't be bypassed)
- TTL ensures cache expires quickly (5 seconds)

### ⚠️ **Potential Issues:**
1. **Stale Cache:** If cache isn't cleared, it expires in 5 seconds anyway
2. **Multiple Sessions:** Each device has its own session token, cache is per-token
3. **Cache Failure:** If Redis is down, session still works (just slower)

### ✅ **Best Practices:**
1. **Clear cache BEFORE destroying token** (current implementation)
2. **Use short TTL** (5 seconds is good)
3. **Handle cache failures gracefully** (don't block logout)
4. **Log cache operations** (for debugging)

---

## Testing Checklist

- [ ] Logout clears Redis cache
- [ ] Logout destroys session token
- [ ] After logout, `/api/auth/session` returns null
- [ ] Cache is cleared even if Redis is slow
- [ ] Logout works even if cache clearing fails
- [ ] Multiple devices can logout independently
- [ ] Cache expires after 5 seconds (TTL)
- [ ] No stale session data after logout

---

## Summary

**Answer to Your Question:**

**Yes, you need to clear Redis cache on logout.** Here's the flow:

1. **Get session token** from cookie (before it's destroyed)
2. **Clear Redis cache** using the session token as key
3. **Destroy session token** (NextAuth does this)
4. **Redirect to signin**

**Implementation:**
- ✅ Create `/api/auth/signout` route to clear cache server-side
- ✅ Call it from logout button BEFORE `signOut()`
- ✅ Update `/api/auth/session` to use cache
- ✅ Handle cache failures gracefully (don't block logout)

**Result:**
- ✅ Clean logout (no stale cache)
- ✅ Secure (server-side cache clearing)
- ✅ Fast (cached session checks)
- ✅ Reliable (TTL fallback if cache clearing fails)

