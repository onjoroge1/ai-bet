# Twitter Developer Portal - App Configuration Guide

**Purpose**: Configure your Twitter app for automated posting (no user authentication required)

---

## Recommended Settings for Automated Posting

### 1. **App permissions** ⭐ **REQUIRED**

**Select:** `Read and write`

**Why:** You need write permissions to post tweets automatically. Since this is automated posting (not user authentication), "Read and write" is sufficient. You don't need "Read and write and Direct message" unless you plan to send DMs.

**Note:** After changing this, you **must regenerate** your Access Token and Access Token Secret (see step 2 below).

---

### 2. **Type of App** ⭐ **REQUIRED**

**Select:** `Web App, Automated App or Bot`

**Why:** This is the correct type for automated posting via API. Your app posts tweets automatically via cron jobs, not through user authentication flows.

---

### 3. **Callback URI / Redirect URL** ⭐ **REQUIRED**

**For Automated Apps/Bots, you can use:**

Option A (Recommended - Your Production URL):
```
https://ai-bet-ruby.vercel.app/api/auth/callback/twitter
```

Option B (Placeholder - Works for automated bots):
```
https://ai-bet-ruby.vercel.app
```

Option C (Simple placeholder):
```
https://snapbet.ai
```

**Why:** Since you're using OAuth 1.0a (not OAuth 2.0 user flows), the callback URL is mostly a formality for automated bots. The Twitter API will still work even if this URL doesn't have a real endpoint, because you're using access tokens directly, not redirecting users.

---

### 4. **Website URL** ⭐ **REQUIRED**

**Enter:** 
```
https://ai-bet-ruby.vercel.app
```

**Or if you have a custom domain:**
```
https://snapbet.ai
```

**Why:** This is your production website URL where the app runs.

---

### 5. **Organization name** (Optional)

**Enter:** `SnapBet AI` or `SnapBet Analytics`

**Or leave blank** - This is optional and mainly shown during user authorization flows (which you're not using for automated posting).

---

### 6. **Organization URL** (Optional)

**Enter:** 
```
https://ai-bet-ruby.vercel.app
```

**Or leave blank** - Optional field.

---

### 7. **Terms of service** (Optional)

**Enter:** (Leave blank or add if you have one)

Since you're not using user authentication flows, this is optional. However, if you want to be compliant:
```
https://ai-bet-ruby.vercel.app/terms
```

---

### 8. **Privacy policy** (Optional)

**Enter:** (Leave blank or add if you have one)

Since you're not using user authentication flows, this is optional. However, if you want to be compliant:
```
https://ai-bet-ruby.vercel.app/privacy
```

---

## ⚠️ **CRITICAL: After Changing App Permissions**

After you enable "Read and write" permissions, you **MUST**:

1. **Regenerate Access Tokens:**
   - Go to "Keys and tokens" tab
   - Under "Access Token and Secret", click "Regenerate"
   - Copy the new tokens immediately (they're only shown once)

2. **Update Your `.env` File:**
   ```env
   TWITTER_ACCESS_TOKEN=<new_access_token_here>
   TWITTER_ACCESS_TOKEN_SECRET=<new_access_token_secret_here>
   ```

3. **Keep Your API Keys:**
   - Your `TWITTER_API_KEY` and `TWITTER_API_SECRET` stay the same
   - Only the Access Token and Secret need to be regenerated

---

## Summary of Required Fields

| Field | Value | Notes |
|-------|-------|-------|
| App permissions | **Read and write** | Required for posting |
| Type of App | **Web App, Automated App or Bot** | Correct type for bots |
| Callback URI | `https://ai-bet-ruby.vercel.app/api/auth/callback/twitter` | Any valid URL works for bots |
| Website URL | `https://ai-bet-ruby.vercel.app` | Your production URL |
| Organization name | `SnapBet AI` (optional) | Can leave blank |
| Organization URL | (optional) | Can leave blank |
| Terms of service | (optional) | Can leave blank |
| Privacy policy | (optional) | Can leave blank |

---

## After Configuration

1. Save your settings in the Twitter Developer Portal
2. Regenerate Access Token and Secret (see above)
3. Update your `.env` file with new tokens
4. Test posting with:
   ```bash
   npx ts-node --project tsconfig.server.json scripts/check-twitter-error-details.ts
   ```

---

**Important Notes:**
- The callback URL is mainly for OAuth 2.0 user flows - since you're using OAuth 1.0a with direct access tokens, it's mostly a formality
- You can change these settings anytime without affecting your API keys
- Only the Access Token/Secret need regeneration after changing permissions

