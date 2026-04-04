/**
 * Late.dev (Zernio) Client — posts to 14+ social platforms via one API.
 *
 * Platforms: X/Twitter, Instagram, Facebook, Threads, TikTok, LinkedIn,
 * YouTube, Pinterest, Reddit, Bluesky, Telegram, Google Business, etc.
 *
 * API Docs: https://docs.zernio.com
 * Base URL: https://zernio.com/api/v1
 *
 * Env: LATE_API_KEY=sk_xxx (same as ZERNIO_API_KEY)
 */

import { logger } from '@/lib/logger'

const BASE_URL = 'https://zernio.com/api/v1'

export type SocialPlatform =
  | 'twitter' | 'instagram' | 'facebook' | 'threads'
  | 'tiktok' | 'linkedin' | 'youtube' | 'pinterest'
  | 'reddit' | 'bluesky' | 'telegram'

interface PlatformTarget {
  platform: SocialPlatform
  accountId: string
  customContent?: string  // Platform-specific text override
}

interface PostResult {
  success: boolean
  postId?: string
  platformPostUrl?: string
  error?: string
}

// Cache connected accounts (refreshed every 10 min)
let accountsCache: Array<{ id: string; platform: string }> | null = null
let accountsCacheTime = 0
const CACHE_TTL = 10 * 60 * 1000

/**
 * Check if Late.dev is configured
 */
export function isLateConfigured(): boolean {
  return !!process.env.LATE_API_KEY
}

function getApiKey(): string {
  const key = process.env.LATE_API_KEY
  if (!key) throw new Error('LATE_API_KEY not configured')
  return key
}

/**
 * Get all connected social accounts
 */
export async function getConnectedAccounts(): Promise<Array<{ id: string; platform: string }>> {
  if (accountsCache && Date.now() - accountsCacheTime < CACHE_TTL) {
    return accountsCache
  }

  try {
    const res = await fetch(`${BASE_URL}/accounts`, {
      headers: { 'Authorization': `Bearer ${getApiKey()}` },
      signal: AbortSignal.timeout(10000),
    })

    if (!res.ok) {
      const err = await res.text().catch(() => '')
      throw new Error(`Failed to list accounts: ${res.status} ${err}`)
    }

    const data = await res.json() as any
    const accounts = (data?.accounts || data?.data || data || []) as Array<{ id: string; platform: string }>

    accountsCache = accounts
    accountsCacheTime = Date.now()

    logger.info('[Late.dev] Fetched connected accounts', {
      tags: ['late', 'accounts'],
      data: { count: accounts.length, platforms: accounts.map((a: any) => a.platform) },
    })

    return accounts
  } catch (error) {
    logger.error('[Late.dev] Failed to fetch accounts', {
      tags: ['late', 'accounts', 'error'],
      error: error instanceof Error ? error : undefined,
    })
    return accountsCache || []
  }
}

/**
 * Get account ID for a specific platform
 */
export async function getAccountId(platform: SocialPlatform): Promise<string | null> {
  const accounts = await getConnectedAccounts()
  const account = accounts.find(a => a.platform.toLowerCase() === platform.toLowerCase())
  return account?.id || null
}

/**
 * Post to one or more social platforms
 *
 * @param content - Main post text
 * @param platforms - Array of platform targets (with optional custom content per platform)
 * @param options - Additional options (publishNow, mediaUrl, etc.)
 */
export async function postToSocial(
  content: string,
  platforms: PlatformTarget[],
  options?: {
    publishNow?: boolean
    scheduledFor?: string  // ISO 8601
    mediaUrl?: string      // Public URL for image/video
  }
): Promise<PostResult[]> {
  const results: PostResult[] = []

  try {
    const body: any = {
      content,
      platforms: platforms.map(p => ({
        platform: p.platform,
        accountId: p.accountId,
        ...(p.customContent ? { customContent: p.customContent } : {}),
      })),
    }

    if (options?.publishNow) {
      body.publishNow = true
    }
    if (options?.scheduledFor) {
      body.scheduledFor = options.scheduledFor
    }
    if (options?.mediaUrl) {
      body.media = [{ url: options.mediaUrl }]
    }

    logger.info('[Late.dev] Posting to social platforms', {
      tags: ['late', 'post'],
      data: {
        platforms: platforms.map(p => p.platform),
        contentLength: content.length,
        publishNow: options?.publishNow,
        hasMedia: !!options?.mediaUrl,
      },
    })

    const res = await fetch(`${BASE_URL}/posts`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${getApiKey()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30000),
    })

    if (!res.ok) {
      const errText = await res.text().catch(() => '')
      throw new Error(`Late.dev API error: ${res.status} ${errText}`)
    }

    const data = await res.json() as any
    const postId = data?.id || data?.postId || `late-${Date.now()}`

    // Extract per-platform results if available
    for (const p of platforms) {
      results.push({
        success: true,
        postId: String(postId),
        platformPostUrl: data?.platformPostUrl || data?.url,
      })
    }

    logger.info('[Late.dev] Post published successfully', {
      tags: ['late', 'post', 'success'],
      data: { postId, platforms: platforms.map(p => p.platform) },
    })
  } catch (error) {
    logger.error('[Late.dev] Failed to post', {
      tags: ['late', 'post', 'error'],
      error: error instanceof Error ? error : undefined,
    })

    for (const p of platforms) {
      results.push({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      })
    }
  }

  return results
}

/**
 * Post to X/Twitter via Late.dev
 * Drop-in replacement for OpenTweet/Twitter API
 */
export async function postTweetViaLate(text: string): Promise<string> {
  const accountId = await getAccountId('twitter')
  if (!accountId) {
    throw new Error('No Twitter/X account connected in Late.dev')
  }

  const results = await postToSocial(text, [
    { platform: 'twitter', accountId },
  ], { publishNow: true })

  if (results[0]?.success) {
    return results[0].postId || `late-${Date.now()}`
  }
  throw new Error(results[0]?.error || 'Failed to post to Twitter via Late.dev')
}

/**
 * Post to ALL connected platforms at once
 * Automatically formats content per platform
 */
export async function postToAllPlatforms(
  content: string,
  options?: {
    twitterText?: string     // Short version for X (280 chars)
    instagramCaption?: string // Longer version with hashtags
    linkedinText?: string    // Professional version
    mediaUrl?: string        // Image URL for visual platforms
    publishNow?: boolean
  }
): Promise<{ posted: string[]; failed: string[] }> {
  const accounts = await getConnectedAccounts()
  if (accounts.length === 0) {
    throw new Error('No social accounts connected in Late.dev')
  }

  const platforms: PlatformTarget[] = []

  for (const account of accounts) {
    const platform = account.platform.toLowerCase() as SocialPlatform
    let customContent: string | undefined

    switch (platform) {
      case 'twitter':
        customContent = options?.twitterText || (content.length > 280 ? content.substring(0, 277) + '...' : undefined)
        break
      case 'instagram':
        customContent = options?.instagramCaption
        break
      case 'linkedin':
        customContent = options?.linkedinText
        break
      case 'threads':
        customContent = content.length > 500 ? content.substring(0, 497) + '...' : undefined
        break
    }

    platforms.push({
      platform,
      accountId: account.id,
      ...(customContent ? { customContent } : {}),
    })
  }

  const results = await postToSocial(content, platforms, {
    publishNow: options?.publishNow ?? true,
    mediaUrl: options?.mediaUrl,
  })

  const posted: string[] = []
  const failed: string[] = []

  results.forEach((r, i) => {
    const platform = platforms[i]?.platform || 'unknown'
    if (r.success) posted.push(platform)
    else failed.push(`${platform}: ${r.error}`)
  })

  return { posted, failed }
}
