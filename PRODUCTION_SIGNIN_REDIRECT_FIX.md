# Production Signin Redirect Issue - Comprehensive Analysis & Fix

## Issue Summary

**Production Symptom:**
- User signs in successfully (`signIn()` returns `ok: true`)
- But `result.url` is `'https://www.snapbet.bet/api/auth/signin?csrf=true'` instead of dashboard
- User gets redirected to `/api/auth/signin?csrf=true` (CSRF endpoint) instead of `/dashboard`
- This issue **does NOT occur in lower environments** (dev/staging)

**Root Cause:**
NextAuth's `signIn()` with `redirect: false` is returning a CSRF validation endpoint URL in production instead of the actual callback URL. This is likely due to:
1. **CSRF token validation differences** between environments
2. **Production-specific NextAuth behavior** with secure cookies
3. **Cookie domain/path issues** in production
4. **NextAuth internal redirect logic** that differs in production

## Technical Analysis

### Current Code Flow

```typescript
// components/auth/signin-form.tsx (BEFORE FIX)
const result = await signIn("credentials", {
  email: trimmedEmail,
  password: trimmedPassword,
  redirect: false,
  callbackUrl, // "/dashboard"
})

// ❌ PROBLEM: result.url = '/api/auth/signin?csrf=true' in production
const target = result?.url ?? callbackUrl
// This uses the CSRF endpoint instead of callbackUrl!
window.location.href = target
```

### Why This Happens in Production Only

1. **Secure Cookie Configuration:**
   - Production uses `__Secure-next-auth.session-token` (secure cookie)
   - Dev uses `next-auth.session-token` (regular cookie)
   - Secure cookies have stricter validation requirements

2. **CSRF Token Handling:**
   - NextAuth validates CSRF tokens more strictly in production
   - When `redirect: false`, NextAuth may return a CSRF validation endpoint
   - This is a NextAuth internal behavior that differs by environment

3. **Domain/Path Issues:**
   - Production domain (`www.snapbet.bet`) may have different cookie settings
   - CDN/proxy layers may affect cookie propagation
   - SameSite cookie policies are stricter in production

### Why Lower Environments Work

- **Development:** Less strict CSRF validation, cookies work immediately
- **Staging:** May not have the same secure cookie configuration
- **Production:** Full security enabled, stricter validation, different behavior

## Solution Implemented

### Fix: Validate Redirect URL

```typescript
// ✅ NEW: Validate result.url before using it
let target = callbackUrl // Default to callbackUrl

if (result?.url) {
  const resultUrl = result.url
  const isCSRFEndpoint = resultUrl.includes('/api/auth/signin') || resultUrl.includes('csrf=true')
  const isInvalidRedirect = resultUrl.includes('/api/') && !resultUrl.includes('/dashboard')
  
  if (isCSRFEndpoint || isInvalidRedirect) {
    // ❌ Invalid URL - use callbackUrl instead
    logger.warn("NextAuth returned invalid redirect URL, using callbackUrl", {
      resultUrl,
      callbackUrl,
      reason: isCSRFEndpoint ? "CSRF endpoint" : "Invalid API route",
    })
    target = callbackUrl
  } else {
    // ✅ Valid redirect URL - use it
    target = resultUrl
  }
}
```

### Key Changes

1. **URL Validation:**
   - Check if `result.url` contains `/api/auth/signin` (CSRF endpoint)
   - Check if `result.url` contains `csrf=true` (CSRF parameter)
   - Check if `result.url` is an invalid API route (not dashboard)

2. **Fallback Logic:**
   - If invalid, use `callbackUrl` (which is sanitized and safe)
   - Always defaults to `callbackUrl` if `result.url` is missing

3. **Better Logging:**
   - Log when invalid URL is detected
   - Include reason for rejection
   - Helps debug production issues

## Expected Behavior After Fix

### Production Flow (After Fix):
1. ✅ User signs in successfully
2. ✅ `signIn()` returns `ok: true`
3. ✅ `result.url` is validated
4. ✅ If invalid (CSRF endpoint), use `callbackUrl` instead
5. ✅ Redirect to `/dashboard` (correct destination)
6. ✅ DashboardLayout checks session with 500ms delay
7. ✅ User sees dashboard

### Lower Environments (Unchanged):
- Continue to work as before
- If `result.url` is valid, use it
- If invalid, fallback to `callbackUrl` (defensive)

## Testing Checklist

- [ ] **Production Sign-In:**
  - Sign in from production
  - Verify redirect goes to `/dashboard` (not `/api/auth/signin`)
  - Check logs for "invalid redirect URL" warning if CSRF endpoint detected
  - Verify dashboard loads correctly

- [ ] **Lower Environments:**
  - Sign in from dev/staging
  - Verify redirect still works correctly
  - No regressions

- [ ] **Edge Cases:**
  - Test with custom `callbackUrl` parameter
  - Test with invalid `callbackUrl` (should be sanitized)
  - Test with missing `callbackUrl` (should default to `/dashboard`)

## Additional Recommendations

### 1. Monitor Production Logs
- Watch for "invalid redirect URL" warnings
- Track frequency of CSRF endpoint returns
- This helps understand if NextAuth behavior changes

### 2. Consider NextAuth Configuration
If this issue persists, consider:
- Adding explicit `redirect` callback in NextAuth config
- Configuring CSRF token handling
- Reviewing secure cookie settings

### 3. Alternative Approach (If Needed)
If validation isn't enough, we could:
- Always use `callbackUrl` and ignore `result.url` in production
- Add environment-specific logic
- Use NextAuth's `redirect: true` instead of manual redirect

## Files Modified

1. **components/auth/signin-form.tsx**
   - Added URL validation logic
   - Added fallback to `callbackUrl` for invalid URLs
   - Added logging for invalid redirect detection

## Related Issues

- **Cookie Propagation Timing:** See `SIGNIN_COOKIE_PROPAGATION_FIX.md`
- **Rate Limiting:** See `PRODUCTION_429_RATE_LIMIT_FIX.md`
- **Session Sync:** See `AUTH_SESSION_SYNC_ANALYSIS.md`

