import { TwitterApi } from 'twitter-api-v2'
import { logger } from '@/lib/logger'

/**
 * Twitter API Client Utility
 * 
 * Provides a singleton Twitter API client for posting tweets.
 * Requires environment variables:
 * - TWITTER_API_KEY
 * - TWITTER_API_SECRET
 * - TWITTER_ACCESS_TOKEN
 * - TWITTER_ACCESS_TOKEN_SECRET
 */

let twitterClient: TwitterApi | null = null

/**
 * Get or create Twitter API client instance
 */
export function getTwitterClient(): TwitterApi {
  if (twitterClient) {
    return twitterClient
  }

  const apiKey = process.env.TWITTER_API_KEY
  const apiSecret = process.env.TWITTER_API_SECRET
  const accessToken = process.env.TWITTER_ACCESS_TOKEN
  const accessTokenSecret = process.env.TWITTER_ACCESS_TOKEN_SECRET

  // Check if all required credentials are present
  if (!apiKey || !apiSecret || !accessToken || !accessTokenSecret) {
    const missing = []
    if (!apiKey) missing.push('TWITTER_API_KEY')
    if (!apiSecret) missing.push('TWITTER_API_SECRET')
    if (!accessToken) missing.push('TWITTER_ACCESS_TOKEN')
    if (!accessTokenSecret) missing.push('TWITTER_ACCESS_TOKEN_SECRET')
    
    throw new Error(
      `Twitter API credentials not configured. Missing: ${missing.join(', ')}. ` +
      'Please set these environment variables to enable Twitter posting.'
    )
  }

  try {
    twitterClient = new TwitterApi({
      appKey: apiKey,
      appSecret: apiSecret,
      accessToken: accessToken,
      accessSecret: accessTokenSecret,
    })

    logger.info('Twitter API client initialized', {
      tags: ['twitter', 'api', 'client'],
    })

    return twitterClient
  } catch (error) {
    logger.error('Failed to initialize Twitter API client', {
      tags: ['twitter', 'api', 'client', 'error'],
      error: error instanceof Error ? error : undefined,
    })
    throw error
  }
}

/**
 * Check if Twitter API credentials are configured
 */
export function isTwitterConfigured(): boolean {
  return !!(
    process.env.TWITTER_API_KEY &&
    process.env.TWITTER_API_SECRET &&
    process.env.TWITTER_ACCESS_TOKEN &&
    process.env.TWITTER_ACCESS_TOKEN_SECRET
  )
}

/**
 * Post a tweet to Twitter
 * 
 * @param text - The tweet text (max 280 characters)
 * @returns The tweet ID
 * @throws Error if posting fails
 */
export async function postTweet(text: string): Promise<string> {
  if (!isTwitterConfigured()) {
    throw new Error('Twitter API credentials not configured')
  }

  // Validate text length (Twitter limit is 280 characters)
  if (text.length > 280) {
    throw new Error(`Tweet text exceeds 280 character limit (${text.length} characters)`)
  }

  if (text.length === 0) {
    throw new Error('Tweet text cannot be empty')
  }

  try {
    const client = getTwitterClient()
    const readWriteClient = client.readWrite

    logger.info('Posting tweet to Twitter', {
      tags: ['twitter', 'api', 'post'],
      data: { textLength: text.length },
    })

    const tweet = await readWriteClient.v2.tweet({
      text: text.trim(),
    })

    logger.info('Tweet posted successfully', {
      tags: ['twitter', 'api', 'post', 'success'],
      data: {
        tweetId: tweet.data.id,
        textLength: text.length,
      },
    })

    return tweet.data.id
  } catch (error) {
    logger.error('Failed to post tweet to Twitter', {
      tags: ['twitter', 'api', 'post', 'error'],
      error: error instanceof Error ? error : undefined,
      data: { textLength: text.length },
    })

    // Re-throw with more context
    // twitter-api-v2 throws errors with useful information in the error message
    if (error instanceof Error) {
      // Include original error message for better debugging
      throw error
    }
    throw new Error('Unknown error occurred while posting tweet')
  }
}

/**
 * Post a tweet with an image attachment to Twitter
 *
 * @param text - The tweet text (max 280 characters)
 * @param imageBuffer - The image data as a Buffer
 * @param mimeType - Image MIME type (default: image/png)
 * @returns The tweet ID
 * @throws Error if posting fails (falls back to text-only is NOT handled here — caller should catch)
 */
export async function postTweetWithMedia(
  text: string,
  imageBuffer: Buffer,
  mimeType: 'image/png' | 'image/jpeg' = 'image/png'
): Promise<string> {
  if (!isTwitterConfigured()) {
    throw new Error('Twitter API credentials not configured')
  }

  if (text.length > 280) {
    throw new Error(`Tweet text exceeds 280 character limit (${text.length} characters)`)
  }

  try {
    const client = getTwitterClient()

    logger.info('Uploading media to Twitter', {
      tags: ['twitter', 'api', 'media', 'upload'],
      data: { bufferSize: imageBuffer.length, mimeType },
    })

    // Upload image via v1 API (media upload not available in v2)
    const mediaId = await client.v1.uploadMedia(imageBuffer, {
      mimeType,
    })

    logger.info('Media uploaded, posting tweet with image', {
      tags: ['twitter', 'api', 'media', 'post'],
      data: { mediaId, textLength: text.length },
    })

    // Post tweet with media attachment via v2 API
    const tweet = await client.readWrite.v2.tweet({
      text: text.trim(),
      media: { media_ids: [mediaId] },
    })

    logger.info('Tweet with image posted successfully', {
      tags: ['twitter', 'api', 'media', 'post', 'success'],
      data: { tweetId: tweet.data.id, mediaId, textLength: text.length },
    })

    return tweet.data.id
  } catch (error) {
    logger.error('Failed to post tweet with media', {
      tags: ['twitter', 'api', 'media', 'post', 'error'],
      error: error instanceof Error ? error : undefined,
      data: { textLength: text.length, bufferSize: imageBuffer.length },
    })

    if (error instanceof Error) throw error
    throw new Error('Unknown error posting tweet with media')
  }
}

/**
 * Check Twitter API rate limit status
 * Note: This is a placeholder - Twitter API v2 doesn't provide easy rate limit checking
 * The actual rate limits are handled by the API itself (429 errors)
 */
export async function checkRateLimit(): Promise<{ remaining: number; resetAt?: Date }> {
  // Twitter API v2 doesn't expose rate limit info easily without making a request
  // Rate limits are handled via 429 errors from the API
  // This is a placeholder function for future enhancement
  return { remaining: 200 } // Twitter v2 allows 200 tweets per 15 minutes
}

