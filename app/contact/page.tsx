import type { Metadata } from 'next'
import Link from 'next/link'
import { AdvancedBreadcrumb } from '@/components/advanced-breadcrumb'
import { Card, CardContent } from '@/components/ui/card'
import { Mail, MessageSquare, AlertCircle, Heart } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Contact SnapBet AI',
  description: 'How to reach the SnapBet AI team — support, press, partnerships, corrections, and responsible-betting requests.',
  alternates: { canonical: '/contact' },
}

export default function ContactPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        <AdvancedBreadcrumb />
      </div>

      <article className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 space-y-8">
        <header>
          <h1 className="text-3xl sm:text-4xl font-bold text-white flex items-center gap-3">
            <Mail className="w-8 h-8 text-emerald-300" />
            Contact us
          </h1>
          <p className="text-slate-300 mt-3 text-lg leading-relaxed">
            One inbox, all channels. We read everything.
          </p>
          <p className="text-xs text-slate-500 mt-2">Last updated: 2026-05-13</p>
        </header>

        <Card className="bg-gradient-to-br from-emerald-950/30 via-slate-900 to-slate-900 border-emerald-500/30">
          <CardContent className="p-6">
            <p className="text-xs text-emerald-300 uppercase tracking-widest font-semibold">Primary contact</p>
            <a href="mailto:support@snapbet.bet" className="text-2xl sm:text-3xl font-bold text-white hover:text-emerald-200 mt-2 inline-block">
              support@snapbet.bet
            </a>
            <p className="text-sm text-slate-300 mt-2">
              We aim to respond within one business day.
            </p>
          </CardContent>
        </Card>

        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-white">What to send where</h2>
          <div className="space-y-3">
            <Card className="bg-slate-800/60 border-slate-700">
              <CardContent className="p-5">
                <h3 className="font-semibold text-white flex items-center gap-2">
                  <MessageSquare className="w-5 h-5 text-blue-300" />
                  Support &amp; questions
                </h3>
                <p className="text-sm text-slate-300 mt-2 leading-relaxed">
                  Issues with an account, a missing pick, a billing question, or anything we&apos;ve gotten
                  wrong. Email us at <a href="mailto:support@snapbet.bet" className="text-blue-300 hover:text-blue-200 underline">support@snapbet.bet</a>.
                </p>
              </CardContent>
            </Card>

            <Card className="bg-slate-800/60 border-slate-700">
              <CardContent className="p-5">
                <h3 className="font-semibold text-white flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-amber-300" />
                  Corrections &amp; press
                </h3>
                <p className="text-sm text-slate-300 mt-2 leading-relaxed">
                  Spotted a stat that&apos;s wrong? A pick mislabelled? Press inquiry, partnership idea, or
                  data-licensing question? Same address — <a href="mailto:support@snapbet.bet" className="text-blue-300 hover:text-blue-200 underline">support@snapbet.bet</a> —
                  prefix the subject with <code className="text-xs bg-slate-900/60 px-1.5 py-0.5 rounded">[Correction]</code> or <code className="text-xs bg-slate-900/60 px-1.5 py-0.5 rounded">[Press]</code> so we route it fast.
                </p>
              </CardContent>
            </Card>

            <Card className="bg-rose-950/30 border-rose-500/30">
              <CardContent className="p-5">
                <h3 className="font-semibold text-white flex items-center gap-2">
                  <Heart className="w-5 h-5 text-rose-300" />
                  Newsletter unsubscribe / responsible betting
                </h3>
                <p className="text-sm text-slate-300 mt-2 leading-relaxed">
                  Want to stop receiving picks, or need help with problem betting? Reach out and we&apos;ll
                  remove you immediately — no questions, no upsell. See our{' '}
                  <Link href="/responsible-betting" className="text-blue-300 hover:text-blue-200 underline">
                    responsible betting page
                  </Link>{' '}
                  for hotlines and self-exclusion resources.
                </p>
              </CardContent>
            </Card>
          </div>
        </section>

        <div className="pt-6 border-t border-slate-700 text-sm text-slate-400">
          <Link href="/about" className="text-blue-300 hover:text-blue-200 underline">About us</Link> · <Link href="/methodology" className="text-blue-300 hover:text-blue-200 underline">Methodology</Link> · <Link href="/performance" className="text-blue-300 hover:text-blue-200 underline">Tracker</Link>
        </div>
      </article>
    </div>
  )
}
