# Dashboard Stale Data Analysis - Wrong User Data After Login

**Date**: December 2024  
**Status**: 🔴 **CRITICAL BUG IDENTIFIED**  
**Issue**: Navigation shows correct user but dashboard components show previous user's data

---

## 🐛 Problem Description

**User Report**:
- Navigation shows: `asia.anderson07@gmail.com` ✅ (correct)
- Dashboard components/data show: `kim.njo@gmail.com` ❌ (previous user - stale)

**Root Cause**: React Query cache not cleared after login, components using cached data from previous user.

---

## 🔍 Root Cause Analysis

### **Issue #1: React Query Cache Not Cleared on Login** ❌ **CRITICAL**

**Problem**:
- After login, React Query cache still has data from previous user
- `use-dashboard-data.ts` includes `userId` in query key: `['dashboard-data', userId]`
- But cache might have stale data with old userId or null userId

**Evidence**:
- Navigation uses `useSession()` which updates correctly ✅
- Dashboard components use `useDashboardData()` which fetches from API
- API uses `getServerSession()` which should be correct
- But React Query returns cached data before fresh fetch completes

---

### **Issue #2: use-dashboard-data Hook Only Checks Session Once** ❌ **CRITICAL**

**Problem**:
```typescript
// hooks/use-dashboard-data.ts:29
useEffect(() => {
  const checkAuth = async () => {
    const session = await getSession()
    if (session?.user?.id) {
      setUserId(session.user.id)
      // ...
    }
  }
  checkAuth()
}, []) // ⚠️ Empty dependency array - only runs once!
```

**Impact**:
- If component mounts before session is ready, userId might be null
- If user logs in while dashboard is open, userId won't update
- Query might run with wrong userId or cached data

---

### **Issue #3: Cache Invalidation Timing** ⚠️ **HIGH**

**Problem**:
- `AuthProvider` clears cache when `useSession()` updates
- But `useSession()` might not update immediately after login
- Dashboard components might load before cache is cleared

**Flow**:
```
1. User logs in
2. signIn() succeeds, cookie set
3. Redirect to dashboard
4. Dashboard components mount
5. use-dashboard-data checks session → might get old session from cache
6. React Query returns cached data for old userId
7. useSession() updates later (background sync)
8. AuthProvider detects user switch and clears cache (too late!)
```

---

## 💡 Solutions

### **Solution 1: Clear React Query Cache After Successful Login** ⭐ **CRITICAL**

**Fix**: Clear all React Query cache before redirecting to dashboard

```typescript
// components/auth/signin-form.tsx
if (result?.ok) {
  // Clear React Query cache BEFORE redirect
  const queryClient = useQueryClient()
  queryClient.invalidateQueries()
  queryClient.removeQueries()
  
  // Clear session request manager cache
  clearSessionCache()
  
  // Then sync session and redirect
  await update()
  // ... redirect
}
```

---

### **Solution 2: Make use-dashboard-data Reactive to Session Changes** ⭐ **CRITICAL**

**Fix**: Re-check session when it might have changed

```typescript
// hooks/use-dashboard-data.ts
useEffect(() => {
  const checkAuth = async () => {
    const session = await getSession()
    if (session?.user?.id) {
      const newUserId = session.user.id
      // ✅ CRITICAL: Only update if userId actually changed
      if (newUserId !== userId) {
        setUserId(newUserId)
        setIsAuthenticated(true)
        setSessionUser({
          name: session.user.name,
          email: session.user.email,
        })
      }
    }
  }
  checkAuth()
}, [userId]) // ✅ Add userId to dependencies to re-check on change
```

**Better**: Use `useSession()` to detect session changes

```typescript
import { useSession } from 'next-auth/react'

export function useDashboardData() {
  const { data: session, status } = useSession()
  const userId = (session?.user as any)?.id
  
  // Query will automatically refetch when userId changes
  const { data, isLoading } = useQuery({
    queryKey: ['dashboard-data', userId],
    enabled: !!userId && status === 'authenticated',
    // ...
  })
}
```

---

### **Solution 3: Force Cache Invalidation on Login** ⭐ **HIGH**

**Fix**: Clear cache immediately after successful login, before redirect

```typescript
// After signIn() succeeds
// 1. Clear all caches
// 2. Sync session
// 3. Verify session
// 4. Redirect
```

---

## 🎯 Recommended Implementation

### **Option 1: Clear Cache in SignInForm** (Quick Fix)

1. Import `useQueryClient` in `SignInForm`
2. Clear all queries after successful login
3. Clear session request manager cache
4. Then sync and redirect

### **Option 2: Use useSession() in use-dashboard-data** (Best Practice)

1. Use `useSession()` to get userId
2. Remove manual session check
3. Let React Query automatically refetch when userId changes
4. More reactive and reliable

---

## 📋 Action Items

1. ✅ Clear React Query cache in SignInForm after login
2. ⏳ Make use-dashboard-data reactive to session changes
3. ⏳ Ensure all dashboard components use userId in query keys
4. ⏳ Test user switch scenario

---

**Document Created**: December 2024  
**Status**: 🔴 **FIX REQUIRED**  
**Next Step**: Implement cache clearing in SignInForm

