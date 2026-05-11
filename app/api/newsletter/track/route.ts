import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'

export const dynamic = 'force-dynamic'

/**
 * POST /api/newsletter/track
 *
 * Lightweight funnel event recorder for the newsletter widgets on blog pages.
 * Designed to be fire-and-forget — clients call it via navigator.sendBeacon
 * or a non-awaited fetch, so we never block the user. The endpoint always
 * returns quickly and swallows errors so a tracker failure can't break UX.
 *
 * Body shape:
 *   {
 *     type: 'impression' | 'dismiss' | 'subscribe',
 *     source: 'static_widget' | 'popup',
 *     blogId?: string,
 *     email?: string,  // only on 'subscribe' (de-dupe + funnel join)
 *   }
 *
 * Public endpoint — no auth. Spam protection is minimal because the writes
 * are append-only and small-impact (a row per event).
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null) as
      | { type?: string; source?: string; blogId?: string; email?: string }
      | null

    if (!body) {
      return NextResponse.json({ success: false, error: 'Invalid body' }, { status: 400 })
    }

    const { type, source, blogId, email } = body
    const validTypes = new Set(['impression', 'dismiss', 'subscribe'])
    const validSources = new Set(['static_widget', 'popup'])

    if (!type || !validTypes.has(type)) {
      return NextResponse.json({ success: false, error: 'Invalid type' }, { status: 400 })
    }
    if (!source || !validSources.has(source)) {
      return NextResponse.json({ success: false, error: 'Invalid source' }, { status: 400 })
    }

    await prisma.newsletterEvent.create({
      data: {
        type,
        source,
        blogId: typeof blogId === 'string' && blogId.length > 0 ? blogId : null,
        email: typeof email === 'string' && email.includes('@') ? email : null,
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[Newsletter Track] Error:', error)
    // Always return 200-ish on tracker failure so the client doesn't retry
    return NextResponse.json({ success: false }, { status: 200 })
  }
}
