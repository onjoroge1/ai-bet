# 🔥 Auth Simplification - NextAuth Only

## Problem Identified

You had **two competing authentication systems**:

1. **Custom JWT** (`token` cookie) - Used by `/api/auth/signin`, `/api/auth/signup`, middleware (partially)
2. **NextAuth** (`next-auth.session-token` cookie) - Used by `SignInForm`, `AuthProvider`, middleware (partially)

### The Issue

- **Middleware** was seeing `hasToken: true` (NextAuth's token)
- **Client-side** (`useSession()`) was not seeing a session
- **Result**: Nav bar showed "Login" even though you were logged in

This happened because:
- Custom JWT routes (`/api/auth/signin`) set a `token` cookie
- NextAuth sets a `next-auth.session-token` cookie
- They're different tokens, different cookies, different systems
- Client components use NextAuth, but the session wasn't being set properly

## Solution: Go All-In on NextAuth

### Changes Made

#### 1. **SignInForm** (`components/auth/signin-form.tsx`)
- ✅ Removed manual `router.push()` and `router.refresh()` logic
- ✅ Uses `signIn("credentials")` with `redirect: false` to catch errors
- ✅ On success, uses `window.location.href` for a **hard redirect** to ensure session cookie is picked up
- ✅ Removed dependency on `useAuth().login()` - NextAuth handles session state

**Key Change:**
```typescript
// Before: Manual navigation with router.push()
// After: Hard redirect with window.location.href after NextAuth sets session
if (result?.ok) {
  window.location.href = callbackUrl
  return
}
```

#### 2. **AuthProvider** (`components/auth-provider.tsx`)
- ✅ Simplified to trust `useSession()` directly
- ✅ Sets `isAuthenticated: true` **immediately** when `status === 'authenticated'`
- ✅ Removed `login()` function from context (not needed - NextAuth handles it)
- ✅ Profile fetch is **optional enrichment** (adds country, etc.), not a blocker
- ✅ Logout uses NextAuth's `signOut()` with redirect

**Key Change:**
```typescript
// Before: Waited for profile fetch before marking authenticated
// After: Trusts NextAuth session immediately, profile is enrichment only
if (status === 'authenticated' && session?.user) {
  return {
    user: enrichedUser,
    isAuthenticated: true, // Set immediately!
    isLoading: false,
    // ...
  }
}
```

#### 3. **Middleware** (`middleware.ts`)
- ✅ Already correct - uses NextAuth's `getToken()` from `next-auth/jwt`
- ✅ No changes needed

#### 4. **lib/auth.ts** - Custom JWT Helpers
- ✅ Added `@deprecated` JSDoc comments to:
  - `verifyToken()`
  - `generateToken()`
  - `setTokenCookie()`
  - `getTokenPayload()`
- ✅ Documented these are for legacy/API-only use, not web session auth
- ✅ NextAuth handles all web session authentication

## How It Works Now

### Login Flow

1. User submits `SignInForm`
2. `signIn("credentials")` calls NextAuth's `/api/auth/[...nextauth]`
3. NextAuth validates credentials via `CredentialsProvider.authorize()`
4. NextAuth sets `next-auth.session-token` cookie
5. `SignInForm` redirects with `window.location.href = callbackUrl`
6. Page reloads, `SessionProvider` + `useSession()` read the cookie
7. `AuthProvider` sees `status === 'authenticated'` → `isAuthenticated: true`
8. Nav bar and dashboard show authenticated state **immediately**

### Authentication State

- **Server-side (middleware)**: Uses `getToken()` from `next-auth/jwt` → reads `next-auth.session-token`
- **Client-side (components)**: Uses `useSession()` from `next-auth/react` → reads `next-auth.session-token`
- **Single source of truth**: NextAuth's session cookie

### What About Custom JWT Routes?

The following routes still exist but are **not used by the web UI**:
- `/api/auth/signin` - Custom JWT route (legacy, not used by SignInForm)
- `/api/auth/signup` - Custom JWT route (may be used by signup, but should migrate to NextAuth)
- `/api/auth/me` - Custom JWT route (legacy, not used by AuthProvider)

**Recommendation**: These can be removed or kept for API-only use, but the web UI should **only** use NextAuth.

## Testing

After these changes:

1. **Clear browser cookies** for `localhost:3000` (or use incognito)
2. **Sign in** via `/signin`
3. **Expected behavior**:
   - ✅ Redirects to `/dashboard` (or callbackUrl)
   - ✅ Nav bar shows user name / "Sign Out" button **immediately**
   - ✅ Dashboard loads with authenticated state
   - ✅ No need to refresh the page

## Files Changed

1. `components/auth/signin-form.tsx` - Simplified to use NextAuth redirect
2. `components/auth-provider.tsx` - Trusts NextAuth session immediately
3. `lib/auth.ts` - Added deprecation comments to custom JWT helpers

## Next Steps (Optional)

1. **Migrate signup to NextAuth**: Update `/signup` to use NextAuth's signup flow
2. **Remove legacy routes**: Delete or document `/api/auth/signin`, `/api/auth/signup`, `/api/auth/me` if not needed
3. **Add OAuth providers**: Now that NextAuth is the single source, adding Google/GitHub login is straightforward

## Key Takeaways

✅ **One auth system**: NextAuth for web sessions  
✅ **No competing tokens**: Only `next-auth.session-token` cookie  
✅ **Immediate UI updates**: `isAuthenticated` set as soon as NextAuth reports authenticated  
✅ **Hard redirect on login**: Ensures session cookie is picked up by client  
✅ **Middleware and client in sync**: Both use NextAuth's token


