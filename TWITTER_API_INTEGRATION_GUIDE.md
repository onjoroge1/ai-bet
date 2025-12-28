# Twitter/X API Integration Guide

**Status**: ⚠️ **REQUIRED FOR LIVE POSTING**

The Twitter automation system is fully implemented, but currently **simulates** posting. To enable live posting, you need to integrate with Twitter API v2.

---

## What You Need

### 1. **Twitter/X Account**
- A Twitter/X account to post from
- Recommended: Create a dedicated account for SnapBet (e.g., @SnapBetAI)

### 2. **Twitter Developer Account**
- Sign up at: https://developer.twitter.com/
- Apply for API access (usually approved within 24-48 hours)

### 3. **Twitter API Credentials**
Once approved, create a new App in the Developer Portal and get:
- **API Key** (`TWITTER_API_KEY`)
- **API Secret** (`TWITTER_API_SECRET`)
- **Access Token** (`TWITTER_ACCESS_TOKEN`)
- **Access Token Secret** (`TWITTER_ACCESS_TOKEN_SECRET`)
- **Bearer Token** (`TWITTER_BEARER_TOKEN`) - Optional but recommended

**Note**: You need **Elevated Access** or **Academic Research** tier to post tweets.

---

## Installation

Install the Twitter API library:

```bash
npm install twitter-api-v2
```

---

## Environment Variables

Add to your `.env` file:

```env
# Twitter API Credentials
TWITTER_API_KEY=your_api_key_here
TWITTER_API_SECRET=your_api_secret_here
TWITTER_ACCESS_TOKEN=your_access_token_here
TWITTER_ACCESS_TOKEN_SECRET=your_access_token_secret_here
TWITTER_BEARER_TOKEN=your_bearer_token_here  # Optional
```

---

## Implementation

Update `app/api/admin/social/twitter/post-scheduled/route.ts`:

### **Option 1: Using twitter-api-v2 (Recommended)**

```typescript
import { TwitterApi } from 'twitter-api-v2'

// Initialize Twitter client (add at top of file)
const getTwitterClient = () => {
  const client = new TwitterApi({
    appKey: process.env.TWITTER_API_KEY!,
    appSecret: process.env.TWITTER_API_SECRET!,
    accessToken: process.env.TWITTER_ACCESS_TOKEN!,
    accessSecret: process.env.TWITTER_ACCESS_TOKEN_SECRET!,
  })
  
  return client.readWrite
}

// In the POST handler, replace the simulation with:
for (const post of scheduledPosts) {
  try {
    const twitterClient = getTwitterClient()
    
    // Build tweet text
    const tweetText = post.content + (post.url ? ` ${post.url}` : '')
    
    // Post tweet
    const tweet = await twitterClient.v2.tweet({
      text: tweetText,
    })
    
    // Update post status
    await prisma.socialMediaPost.update({
      where: { id: post.id },
      data: {
        status: 'posted',
        postedAt: new Date(),
        postId: tweet.data.id, // Store actual tweet ID
      },
    })

    posted++
    logger.info('🕐 CRON: Twitter post published', {
      tags: ['api', 'admin', 'social', 'twitter', 'cron'],
      data: {
        postId: post.id,
        tweetId: tweet.data.id,
        templateId: post.templateId,
        postType: post.postType,
      },
    })
  } catch (error) {
    // Handle errors...
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    
    // Check for specific Twitter API errors
    if (error instanceof Error && 'code' in error) {
      const twitterError = error as any
      
      // Rate limit exceeded (429)
      if (twitterError.code === 429) {
        logger.warn('🕐 CRON: Twitter rate limit exceeded', {
          tags: ['api', 'admin', 'social', 'twitter', 'cron'],
          data: { postId: post.id },
        })
        // Skip remaining posts for this run
        break
      }
      
      // Invalid credentials (401)
      if (twitterError.code === 401) {
        logger.error('🕐 CRON: Twitter API authentication failed', {
          tags: ['api', 'admin', 'social', 'twitter', 'cron', 'error'],
          error,
        })
        // Stop processing
        break
      }
    }
    
    failed++
    errors.push(`Post ${post.id}: ${errorMessage}`)
    
    await prisma.socialMediaPost.update({
      where: { id: post.id },
      data: {
        status: 'failed',
        errorMessage: errorMessage.substring(0, 500),
      },
    })
  }
}
```

### **Option 2: Using Native Fetch (Alternative)**

```typescript
// Post to Twitter API v2 using fetch
const response = await fetch('https://api.twitter.com/2/tweets', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${process.env.TWITTER_BEARER_TOKEN}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    text: post.content + (post.url ? ` ${post.url}` : ''),
  }),
})

if (!response.ok) {
  const errorData = await response.json()
  throw new Error(`Twitter API error: ${errorData.detail || response.statusText}`)
}

const data = await response.json()
const tweetId = data.data.id
```

---

## Rate Limits

Twitter API v2 rate limits:
- **Tweets**: 200 tweets per 15 minutes per user
- **Tweet Lookup**: 300 requests per 15 minutes

**Current implementation enforces:**
- Max 5 posts per hour
- Max 30 posts per day

This is well within Twitter's limits.

---

## Error Handling

### Common Errors:

1. **429 - Rate Limit Exceeded**
   - Wait and retry after rate limit resets
   - Current code already handles this

2. **401 - Unauthorized**
   - Check API credentials
   - Verify tokens are correct

3. **403 - Forbidden**
   - Account may be suspended
   - App may not have write permissions

4. **400 - Bad Request**
   - Tweet text may be too long (280 chars)
   - Invalid characters in tweet
   - Current code already enforces character limits

---

## Testing

Before going live:

1. **Test with a single post:**
   ```typescript
   // Temporarily set scheduledPosts to just one item
   const scheduledPosts = await prisma.socialMediaPost.findMany({
     where: {
       platform: 'twitter',
       status: 'scheduled',
       scheduledAt: { lte: now },
     },
     take: 1, // Test with just one
   })
   ```

2. **Monitor logs:**
   - Check for successful posts
   - Verify tweet IDs are stored correctly
   - Watch for rate limit errors

3. **Verify on Twitter:**
   - Check that tweets appear on your account
   - Verify links work correctly
   - Check character count handling

---

## Security Best Practices

1. **Never commit credentials:**
   - Always use environment variables
   - Add `.env` to `.gitignore`

2. **Rotate credentials regularly:**
   - Update API keys every 90 days
   - Revoke old keys when rotating

3. **Use separate accounts:**
   - Don't use your personal Twitter account
   - Create a dedicated SnapBet account

4. **Monitor usage:**
   - Set up alerts for API errors
   - Track posting success rate
   - Monitor for suspicious activity

---

## Updated File Location

**File to update**: `app/api/admin/social/twitter/post-scheduled/route.ts`

**Look for this section** (around line 103-118):
```typescript
// TODO: Integrate with Twitter API v2 here
// For now, we'll simulate posting
// In production, use: await twitterClient.v2.tweet({ text: post.content + (post.url ? ` ${post.url}` : '') })

// Simulate Twitter API call
const tweetId = `sim_${Date.now()}_${Math.random().toString(36).substring(7)}`
```

**Replace with actual Twitter API code** (see Option 1 above).

---

## Current Status

✅ **System is ready** - All infrastructure is in place  
⚠️ **Needs Twitter API integration** - Currently simulates posting  
📋 **Next step**: Get Twitter API credentials and implement posting code

Once you have the credentials and update the code, the system will automatically start posting to Twitter!

