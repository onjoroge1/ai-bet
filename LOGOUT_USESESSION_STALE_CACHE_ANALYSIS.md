# Logout useSession() Stale Cache Analysis

**Date**: December 2024  
**Status**: 🔴 **CRITICAL BUG** - useSession() shows stale data after logout  
**Issue**: `/api/auth/session` returns null (correct) but `useSession()` still shows authenticated

---

## 🐛 Problem Identified

**Current State**:
- ✅ `/api/auth/session` → `{ user: null, expires: null }` (CORRECT - cookie cleared)
- ❌ `useSession()` → `{ status: "authenticated", session: {...} }` (WRONG - stale cache)

**Root Cause**: NextAuth's `useSession()` hook has stale cached data that isn't being cleared after logout.

---

## 🔍 Analysis

### **Are We Using NextAuth for useSession()?**

**YES** - We're using NextAuth:
- ✅ `import { useSession } from "next-auth/react"`
- ✅ `<SessionProvider>` from `next-auth/react`
- ✅ `signOut()` from `next-auth/react`

**BUT** - We have a **custom session route** that might be interfering:
- `/api/auth/session/route.ts` - Custom route that wraps NextAuth
- NextAuth expects: `/api/auth/session` to be handled by `[...nextauth]`

**Potential Conflict**:
- Our custom route at `/api/auth/session/route.ts` is MORE specific than `[...nextauth]`
- Therefore, our custom route intercepts NextAuth's session endpoint
- `useSession()` might be calling our custom route, which has Redis caching

---

## 🚨 Critical Issue

### **Issue #1: Custom Session Route Intercepts NextAuth**

**Route Order**:
1. `/api/auth/session/route.ts` ✅ (most specific - intercepts)
2. `/api/auth/[...nextauth]/route.ts` ❌ (catch-all - never reached)

**Impact**:
- `useSession()` calls `/api/auth/session`
- Our custom route handles it (with Redis caching)
- NextAuth's session handling is bypassed
- `useSession()` might not be getting proper logout signals

---

### **Issue #2: useSession() Stale Cache After Logout**

**Problem**:
- After `signOut()`, NextAuth should clear React Query cache
- But `useSession()` still shows authenticated data
- `update()` call might not be working properly
- Hard redirect with `window.location.replace()` might interrupt cache clearing

**Evidence**:
- Cookie is cleared (server-side) ✅
- `/api/auth/session` returns null ✅
- But `useSession()` shows authenticated ❌

---

### **Issue #3: Competing Auth Infrastructure**

**Current Setup**:
- ✅ NextAuth (`useSession()`, `signOut()`)
- ⚠️ Custom `/api/auth/session` route (intercepts NextAuth)
- ⚠️ Custom session request manager (`lib/session-request-manager.ts`)
- ⚠️ Redis session caching

**Question**: Are these competing or complementary?

**Answer**: They're creating conflicts:
1. Custom route intercepts NextAuth's session endpoint
2. `useSession()` expects NextAuth's behavior
3. Caching might prevent proper logout propagation

---

## 💡 Solutions

### **Solution 1: Ensure useSession() Uses NextAuth Directly** ⭐ **RECOMMENDED**

**Option A: Remove Custom Session Route Interception**

Move our custom route to a different path so NextAuth's route takes precedence:
- Current: `/api/auth/session/route.ts` (intercepts)
- Change to: `/api/auth/session-check/route.ts` (no conflict)
- Use it only for server-side checks, not for `useSession()`

**Option B: Make Custom Route Compatible with NextAuth**

Ensure our custom route properly handles logout by clearing cached data:
- Check if session cookie exists
- If no cookie, return null immediately
- Clear Redis cache when session is null

---

### **Solution 2: Force useSession() to Clear Cache on Logout** ⭐ **CRITICAL**

**Problem**: `update()` after `signOut()` might not clear cached data properly

**Solution**: 
1. Wait longer after `signOut()` for NextAuth to broadcast logout
2. Call `update()` multiple times to ensure cache clears
3. Clear React Query cache explicitly for NextAuth's query key

---

### **Solution 3: Use NextAuth's Events for Cache Clearing** ⭐ **BEST PRACTICE**

Add NextAuth events callback to clear Redis cache when NextAuth clears session:

```typescript
// lib/auth.ts
export const authOptions = {
  // ... existing config
  events: {
    async signOut() {
      // Clear Redis cache when NextAuth signs out
      // This ensures cache is cleared when cookie is cleared
    }
  }
}
```

---

## 🎯 Recommended Fix

### **Immediate Fix**: Force useSession() Cache Clear

```typescript
// After signOut()
await signOut({ redirect: false })

// Wait for NextAuth broadcast
await new Promise(resolve => setTimeout(resolve, 500))

// Force clear React Query cache for NextAuth
queryClient.removeQueries({ queryKey: ['session'] })

// Force useSession() to refetch
await update()

// Wait for refetch to complete
await new Promise(resolve => setTimeout(resolve, 300))

// Verify session is cleared
const { data: session, status } = useSession()
// If still authenticated, force hard refresh
```

---

## 📋 Action Items

1. ✅ Verify route structure (no conflicts)
2. ⏳ Fix useSession() cache clearing
3. ⏳ Ensure NextAuth's endpoint is used properly
4. ⏳ Add events callback for cache clearing
5. ⏳ Test logout flow end-to-end

---

**Document Created**: December 2024  
**Status**: 🔴 **INVESTIGATION ONGOING**  
**Next Step**: Verify route conflicts and fix useSession() cache clearing

