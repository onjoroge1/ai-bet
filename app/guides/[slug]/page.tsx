import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { AdvancedBreadcrumb } from '@/components/advanced-breadcrumb'
import { NewsArticleSchema } from '@/components/schema-markup'
import { Card, CardContent } from '@/components/ui/card'
import { BookOpen, ChevronRight } from 'lucide-react'
import { GUIDES, getGuideBySlug } from '@/lib/guides/registry'

export const dynamic = 'force-static'
export const revalidate = 3600

interface PageProps {
  params: Promise<{ slug: string }>
}

export async function generateStaticParams() {
  return GUIDES.map(g => ({ slug: g.slug }))
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params
  const guide = getGuideBySlug(slug)
  if (!guide) return { title: 'Guide not found' }
  return {
    title: `${guide.title} | SnapBet AI`,
    description: guide.description,
    alternates: { canonical: `/guides/${guide.slug}` },
    openGraph: {
      title: guide.title,
      description: guide.description,
      url: `/guides/${guide.slug}`,
      type: 'article',
    },
  }
}

export default async function GuidePage({ params }: PageProps) {
  const { slug } = await params
  const guide = getGuideBySlug(slug)
  if (!guide) notFound()

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <NewsArticleSchema
        headline={guide.title}
        description={guide.description}
        datePublished={new Date(guide.publishedAt).toISOString()}
        dateModified={new Date(guide.updatedAt).toISOString()}
        author="SnapBet AI Team"
        publisher="SnapBet AI"
        articleSection="Guides"
        articleBody={guide.body.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 1500)}
      />

      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        <AdvancedBreadcrumb context={{ title: guide.title }} />
      </div>

      <article className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10 space-y-6">
        <header>
          <p className="text-xs text-blue-300 uppercase tracking-widest font-semibold flex items-center gap-2">
            <BookOpen className="w-3.5 h-3.5" />
            Guide
          </p>
          <h1 className="text-3xl sm:text-4xl font-bold text-white mt-2">{guide.title}</h1>
          <p className="text-slate-300 mt-3 leading-relaxed">{guide.description}</p>
          <p className="text-xs text-slate-500 mt-3">
            Last updated {new Date(guide.updatedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </header>

        <Card className="bg-slate-800 border-slate-700">
          <CardContent className="p-6 sm:p-8">
            <div
              className="prose prose-sm sm:prose-base prose-invert max-w-none text-slate-300 leading-relaxed [&_a]:text-blue-300 [&_a]:underline [&_a:hover]:text-blue-200 [&_strong]:text-white"
              dangerouslySetInnerHTML={{ __html: guide.body }}
            />
          </CardContent>
        </Card>

        {guide.relatedLinks && guide.relatedLinks.length > 0 && (
          <Card className="bg-slate-800 border-slate-700">
            <CardContent className="p-5">
              <h2 className="text-sm font-semibold text-white uppercase tracking-wider mb-3">Related</h2>
              <div className="space-y-1">
                {guide.relatedLinks.map(link => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="flex items-center justify-between p-2 rounded hover:bg-slate-700/50 transition-colors group"
                  >
                    <span className="text-sm text-slate-200 group-hover:text-blue-300">{link.label}</span>
                    <ChevronRight className="w-4 h-4 text-slate-500" />
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        <Card className="bg-slate-900/60 border-slate-700">
          <CardContent className="p-5">
            <p className="text-xs text-slate-400 leading-relaxed">
              More guides at{' '}
              <Link href="/guides" className="text-blue-300 hover:text-blue-200 underline">/guides</Link>
              {' · '}
              <Link href="/methodology" className="text-blue-300 hover:text-blue-200 underline">Full methodology</Link>
              {' · '}
              <Link href="/responsible-betting" className="text-blue-300 hover:text-blue-200 underline">Bet responsibly</Link>
            </p>
          </CardContent>
        </Card>
      </article>
    </div>
  )
}
