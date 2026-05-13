import type { Metadata } from 'next'
import Link from 'next/link'
import { AdvancedBreadcrumb } from '@/components/advanced-breadcrumb'
import { Card, CardContent } from '@/components/ui/card'
import { Sparkles, Target, Eye, Mail } from 'lucide-react'

export const metadata: Metadata = {
  title: 'About SnapBet AI',
  description:
    "Who we are, what SnapBet does, and how the platform makes AI-driven sports predictions auditable for everyone.",
  alternates: { canonical: '/about' },
}

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        <AdvancedBreadcrumb />
      </div>

      <article className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 space-y-8">
        <header>
          <h1 className="text-3xl sm:text-4xl font-bold text-white flex items-center gap-3">
            <Sparkles className="w-8 h-8 text-emerald-300" />
            About SnapBet AI
          </h1>
          <p className="text-slate-300 mt-3 text-lg leading-relaxed">
            We build AI-driven sports prediction tools — and we publish a transparent record of how those
            predictions actually perform.
          </p>
          <p className="text-xs text-slate-500 mt-2">Last updated: 2026-05-13</p>
        </header>

        {/* ── Mission ─────────────────────────────────────────────── */}
        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <Target className="w-6 h-6 text-blue-300" />
            What we do
          </h2>
          <p className="text-slate-300 leading-relaxed">
            SnapBet AI publishes AI-generated predictions for soccer, basketball, and other major sports.
            Two prediction models (V1 and V3) score every fixture, and a curation layer surfaces a small
            set of <strong>premium-qualified</strong> picks each day where model confidence is highest.
          </p>
          <p className="text-slate-300 leading-relaxed">
            Most prediction sites either show a wall of picks with no track record, or claim wild ROI
            numbers nobody can verify. We do neither. Every premium pick we surface is recorded at publish
            time, settled when the match ends, and visible in the audit on our{' '}
            <Link href="/performance" className="text-blue-300 hover:text-blue-200 underline">Premium Pick Tracker</Link>{' '}
            — wins and losses included.
          </p>
        </section>

        {/* ── Values ──────────────────────────────────────────────── */}
        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <Eye className="w-6 h-6 text-amber-300" />
            How we operate
          </h2>
          <div className="grid sm:grid-cols-2 gap-4">
            <Card className="bg-slate-800/60 border-slate-700">
              <CardContent className="p-5">
                <h3 className="font-semibold text-white mb-2">Auditable, not just trusted</h3>
                <p className="text-sm text-slate-300 leading-relaxed">
                  Our qualification rules and tracker math are documented in our{' '}
                  <Link href="/methodology" className="text-blue-300 hover:text-blue-200 underline">methodology</Link>.
                  Every settled pick — winning or losing — appears in the public audit table.
                </p>
              </CardContent>
            </Card>
            <Card className="bg-slate-800/60 border-slate-700">
              <CardContent className="p-5">
                <h3 className="font-semibold text-white mb-2">No guarantees, no hype</h3>
                <p className="text-sm text-slate-300 leading-relaxed">
                  We never use language like &quot;guaranteed winner&quot; or &quot;risk-free&quot;. Soccer
                  betting is high-variance. We report what the model has done, not what it will do.
                </p>
              </CardContent>
            </Card>
            <Card className="bg-slate-800/60 border-slate-700">
              <CardContent className="p-5">
                <h3 className="font-semibold text-white mb-2">Models you can compare</h3>
                <p className="text-sm text-slate-300 leading-relaxed">
                  V1 and V3 frequently disagree. We surface both so you can see when our system has
                  conviction vs when it&apos;s split. Different leagues favour different models — we
                  show which.
                </p>
              </CardContent>
            </Card>
            <Card className="bg-slate-800/60 border-slate-700">
              <CardContent className="p-5">
                <h3 className="font-semibold text-white mb-2">Built for responsible use</h3>
                <p className="text-sm text-slate-300 leading-relaxed">
                  Our <Link href="/responsible-betting" className="text-blue-300 hover:text-blue-200 underline">responsible betting page</Link>{' '}
                  signposts real safety resources. We don&apos;t want anyone using our predictions to bet
                  beyond their means.
                </p>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* ── Contact ─────────────────────────────────────────────── */}
        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <Mail className="w-6 h-6 text-emerald-300" />
            Get in touch
          </h2>
          <p className="text-slate-300 leading-relaxed">
            Questions, press, partnership ideas, or feedback on a pick: <a href="mailto:support@snapbet.bet" className="text-blue-300 hover:text-blue-200 underline">support@snapbet.bet</a>.
          </p>
          <p className="text-slate-300 leading-relaxed">
            Found something we got wrong? Tell us — we&apos;ll publish a correction.
          </p>
        </section>

        <div className="pt-6 border-t border-slate-700 text-sm text-slate-400">
          See live results at <Link href="/performance" className="text-blue-300 hover:text-blue-200 underline">/performance</Link> · Read the methodology at <Link href="/methodology" className="text-blue-300 hover:text-blue-200 underline">/methodology</Link>.
        </div>
      </article>
    </div>
  )
}
