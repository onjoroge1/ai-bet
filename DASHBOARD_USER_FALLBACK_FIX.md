# Dashboard "User" Fallback Fix

## Issue
After signing in, the dashboard was showing "User" as a placeholder, then updating to show the actual user profile name. This created a poor user experience with a visible "flip" from generic to real data.

## Root Cause
1. **Two-step data loading**: 
   - `useDashboardData` first checks `/api/auth/session` to get userId
   - Then fetches `/api/user/dashboard-data` to get full user profile
   - During the gap between these calls, `user?.fullName` is undefined
   - Dashboard header shows "User" as fallback (line 56: `|| 'User'`)

2. **Session data not used**: The session from `/api/auth/session` already contains `session.user.name` (which is the user's fullName), but this wasn't being used as a fallback

3. **Production signin flow**: Using `router.push()` for redirect can have cookie propagation issues in production, causing session checks to fail initially

## Solution

### Fix 1: Use Session Data as Immediate Fallback ✅
- Updated `useDashboardData` to store session user data (`name`, `email`) from the initial `/api/auth/session` check
- When dashboard data is loading or unavailable, use session data to create a temporary `DashboardResponse`
- This prevents showing "User" fallback - shows actual user name immediately

### Fix 2: Improve Production Signin Flow ✅
- Changed redirect from `router.push()` to `window.location.href` for more reliable cookie propagation
- Added 100ms delay in `DashboardLayout` before checking session to allow cookie propagation
- This ensures session cookie is available when dashboard checks authentication

## Files Modified

1. **hooks/use-dashboard-data.ts**
   - Added `sessionUser` state to store session data
   - Store session user data during initial auth check
   - Merge session data as fallback when dashboard data is loading

2. **components/auth/signin-form.tsx**
   - Changed redirect from `router.push()` to `window.location.href`
   - More reliable for production cookie propagation

3. **app/dashboard/layout.tsx**
   - Added 100ms delay before first session check
   - Allows session cookie to propagate after redirect

## Expected Behavior After Fix

1. ✅ User signs in successfully
2. ✅ Redirects to dashboard (full page reload ensures cookies are set)
3. ✅ DashboardLayout waits 100ms, then checks session
4. ✅ `useDashboardData` gets session data immediately
5. ✅ Dashboard header shows user's actual name from session (no "User" fallback)
6. ✅ Dashboard data loads in background and updates when ready
7. ✅ No visible "flip" from generic to real data

## Testing Checklist

- [ ] Sign in from production
- [ ] Verify dashboard shows actual user name immediately (no "User" fallback)
- [ ] Verify dashboard data loads and updates correctly
- [ ] Verify no redirect loops or authentication issues
- [ ] Verify session cookie is properly set and available

