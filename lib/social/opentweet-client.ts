/**
 * OpenTweet Client — posts tweets via OpenTweet API ($5.99/mo or free trial)
 * instead of Twitter's expensive API.
 *
 * API: POST https://opentweet.io/api/v1/posts
 * Auth: Bearer token (OPENTWEET_API_KEY)
 * Supports: text posts, scheduled posts, threads, bulk posting
 *
 * Env: OPENTWEET_API_KEY=ot_your_key_here
 */

import { logger } from '@/lib/logger'

const BASE_URL = 'https://opentweet.io/api/v1'

/**
 * Check if OpenTweet is configured
 */
export function isOpenTweetConfigured(): boolean {
  return !!process.env.OPENTWEET_API_KEY
}

/**
 * Post a tweet via OpenTweet API
 *
 * @param text - Tweet text (max 280 characters)
 * @returns The post ID from OpenTweet
 */
export async function postViaOpenTweet(text: string): Promise<string> {
  const apiKey = process.env.OPENTWEET_API_KEY
  if (!apiKey) {
    throw new Error('OPENTWEET_API_KEY not configured')
  }

  if (text.length > 280) {
    throw new Error(`Tweet text exceeds 280 character limit (${text.length} characters)`)
  }

  try {
    logger.info('[OpenTweet] Posting tweet', {
      tags: ['opentweet', 'post'],
      data: { textLength: text.length },
    })

    const response = await fetch(`${BASE_URL}/posts`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        posts: [{ text }],
      }),
      signal: AbortSignal.timeout(15000),
    })

    if (!response.ok) {
      const errorText = await response.text().catch(() => '')
      throw new Error(`OpenTweet API error: ${response.status} ${response.statusText} - ${errorText}`)
    }

    const data = await response.json()
    const postId = data?.posts?.[0]?.id || data?.id || `ot-${Date.now()}`

    logger.info('[OpenTweet] Tweet posted successfully', {
      tags: ['opentweet', 'post', 'success'],
      data: { postId, textLength: text.length },
    })

    return String(postId)
  } catch (error) {
    logger.error('[OpenTweet] Failed to post tweet', {
      tags: ['opentweet', 'post', 'error'],
      error: error instanceof Error ? error : undefined,
      data: { textLength: text.length },
    })
    throw error
  }
}

/**
 * Post a scheduled tweet via OpenTweet API
 *
 * @param text - Tweet text
 * @param scheduledDate - ISO 8601 date string for when to post
 * @returns The post ID from OpenTweet
 */
export async function scheduleViaOpenTweet(text: string, scheduledDate: string): Promise<string> {
  const apiKey = process.env.OPENTWEET_API_KEY
  if (!apiKey) {
    throw new Error('OPENTWEET_API_KEY not configured')
  }

  try {
    const response = await fetch(`${BASE_URL}/posts`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        posts: [{ text, scheduled_date: scheduledDate }],
      }),
      signal: AbortSignal.timeout(15000),
    })

    if (!response.ok) {
      const errorText = await response.text().catch(() => '')
      throw new Error(`OpenTweet schedule error: ${response.status} - ${errorText}`)
    }

    const data = await response.json()
    return String(data?.posts?.[0]?.id || data?.id || `ot-${Date.now()}`)
  } catch (error) {
    logger.error('[OpenTweet] Failed to schedule tweet', {
      tags: ['opentweet', 'schedule', 'error'],
      error: error instanceof Error ? error : undefined,
    })
    throw error
  }
}

/**
 * Post a thread via OpenTweet API
 *
 * @param tweets - Array of tweet texts (each max 280 chars)
 * @returns Array of post IDs
 */
export async function postThreadViaOpenTweet(tweets: string[]): Promise<string[]> {
  const apiKey = process.env.OPENTWEET_API_KEY
  if (!apiKey) {
    throw new Error('OPENTWEET_API_KEY not configured')
  }

  try {
    const response = await fetch(`${BASE_URL}/posts`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        posts: tweets.map(text => ({ text })),
      }),
      signal: AbortSignal.timeout(20000),
    })

    if (!response.ok) {
      const errorText = await response.text().catch(() => '')
      throw new Error(`OpenTweet thread error: ${response.status} - ${errorText}`)
    }

    const data = await response.json()
    const posts = data?.posts || []
    return posts.map((p: any) => String(p?.id || `ot-${Date.now()}`))
  } catch (error) {
    logger.error('[OpenTweet] Failed to post thread', {
      tags: ['opentweet', 'thread', 'error'],
      error: error instanceof Error ? error : undefined,
    })
    throw error
  }
}
