import { redirect, notFound } from 'next/navigation'
import prisma from '@/lib/db'

interface PageProps {
  params: Promise<{ slug: string }>
}

/**
 * Bare /team/[slug] route — 308 permanent redirect to the canonical
 * /team/[slug]/predictions URL. The /predictions suffix is the SEO
 * query-match (e.g. "arsenal predictions"), so we keep it as the
 * canonical surface. This route exists purely so users typing the
 * shorter URL don't hit a 404.
 *
 * If the slug isn't a live team, return 404 so Google doesn't get
 * an infinite redirect chain.
 */
export default async function TeamSlugRedirect({ params }: PageProps) {
  const { slug } = await params
  const team = await prisma.teamStats.findUnique({
    where: { slug },
    select: { slug: true, isActive: true },
  })
  if (!team || !team.isActive) notFound()
  redirect(`/team/${team.slug}/predictions`)
}
