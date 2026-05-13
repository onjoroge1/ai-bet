import type { Metadata } from 'next'
import Link from 'next/link'
import { AdvancedBreadcrumb } from '@/components/advanced-breadcrumb'
import { Card, CardContent } from '@/components/ui/card'
import { Brain, Trophy, Target, Scale, ShieldCheck, ListChecks } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Methodology — How SnapBet AI Picks Are Made',
  description:
    "Full technical explanation of how SnapBet's prediction models, premium qualification thresholds, and Premium Pick Tracker work. Auditable, transparent, no marketing fluff.",
  alternates: { canonical: '/methodology' },
}

export default function MethodologyPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        <AdvancedBreadcrumb />
      </div>

      <article className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 space-y-8">
        <header>
          <h1 className="text-3xl sm:text-4xl font-bold text-white flex items-center gap-3">
            <Brain className="w-8 h-8 text-blue-300" />
            Methodology
          </h1>
          <p className="text-slate-300 mt-3 text-lg leading-relaxed">
            How our prediction models work, how premium picks qualify, and exactly how
            the <Link href="/performance" className="text-blue-300 hover:text-blue-200 underline">Premium Pick Tracker</Link> records performance. Designed to be audited, not just trusted.
          </p>
          <p className="text-xs text-slate-500 mt-2">Last updated: 2026-05-13</p>
        </header>

        {/* ── TOC ─────────────────────────────────────────────────── */}
        <nav className="rounded-lg border border-slate-700 bg-slate-800/50 p-4 text-sm">
          <p className="text-xs text-slate-400 uppercase tracking-wider mb-2">On this page</p>
          <ul className="space-y-1 text-slate-300">
            <li><a href="#models" className="hover:text-blue-300">1. Two prediction models — V1 and V3</a></li>
            <li><a href="#premium" className="hover:text-blue-300">2. What qualifies as a Premium Pick</a></li>
            <li><a href="#tracker" className="hover:text-blue-300">3. How the Premium Pick Tracker works</a></li>
            <li><a href="#odds" className="hover:text-blue-300">4. Odds resolution</a></li>
            <li><a href="#backfill" className="hover:text-blue-300">5. Historical backfill — what it is and why</a></li>
            <li><a href="#limits" className="hover:text-blue-300">6. Limitations &amp; what we do not promise</a></li>
          </ul>
        </nav>

        {/* ── Section 1: Models ────────────────────────────────────── */}
        <section id="models" className="space-y-4">
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <Brain className="w-6 h-6 text-blue-300" />
            1. Two prediction models — V1 and V3
          </h2>
          <p className="text-slate-300 leading-relaxed">
            For every soccer fixture we generate predictions from two independent models. Both produce a
            home/draw/away probability and a confidence score. They use different feature inputs and
            different training data so they fail in different ways.
          </p>
          <div className="grid md:grid-cols-2 gap-4">
            <Card className="bg-slate-800/60 border-slate-700">
              <CardContent className="p-5">
                <h3 className="font-semibold text-white mb-2">V1 model</h3>
                <p className="text-sm text-slate-300 leading-relaxed">
                  Long-tenured ensemble trained on multi-season data. Strong on traditional leagues with
                  long histories (Scottish Premiership, Swiss Super League, Championship). Tends to track
                  the market line — useful as a sanity check.
                </p>
              </CardContent>
            </Card>
            <Card className="bg-slate-800/60 border-slate-700">
              <CardContent className="p-5">
                <h3 className="font-semibold text-white mb-2">V3 (Sharp Intelligence) model</h3>
                <p className="text-sm text-slate-300 leading-relaxed">
                  Newer model with stronger empirical performance on top-tier leagues (Bundesliga, La Liga,
                  J1 League). Identifies divergence from market consensus where the model sees a different
                  most-likely outcome than the bookmakers.
                </p>
              </CardContent>
            </Card>
          </div>
          <p className="text-slate-300 leading-relaxed">
            Per league we track which model has been historically more accurate. Where one dominates, our
            premium picks weight that model more heavily. For team-level views we surface both numbers
            side-by-side so you can compare.
          </p>
        </section>

        {/* ── Section 2: Premium qualification ─────────────────────── */}
        <section id="premium" className="space-y-4">
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <Trophy className="w-6 h-6 text-amber-300" />
            2. What qualifies as a Premium Pick
          </h2>
          <p className="text-slate-300 leading-relaxed">
            A soccer fixture qualifies as <strong>premium</strong> when V3 confidence is at least 60% for
            the favoured side. Qualification is deterministic — the rules live in code at{' '}
            <code className="text-xs bg-slate-900/60 border border-slate-700 rounded px-1.5 py-0.5">lib/premium-tracker/capture-helpers.ts</code>{' '}
            and are applied identically to every match.
          </p>
          <div className="rounded-lg border border-slate-700 bg-slate-900/40 p-5">
            <h3 className="font-semibold text-white mb-3 flex items-center gap-2">
              <ListChecks className="w-5 h-5 text-emerald-300" />
              Qualification rules
            </h3>
            <ul className="text-sm text-slate-300 space-y-2 leading-relaxed">
              <li>
                <strong className="text-amber-300">Premium tier</strong> — V3 confidence ≥ 60% on the favoured
                outcome. Strongest historical accuracy band.
              </li>
              <li>
                <strong className="text-blue-300">Strong tier</strong> — V3 confidence ≥ 50% in a strong-league
                context, OR a calibrated premium score ≥ 60. Mid-band picks.
              </li>
              <li>
                <strong className="text-slate-300">Not tracked</strong> — V1/V3 below thresholds, or matches
                without a usable consensus odds value.
              </li>
            </ul>
          </div>
          <p className="text-slate-300 leading-relaxed">
            We surface the <strong>premium tier</strong> as the public tracker headline because the strong
            tier dilutes ROI. The strong tier is still visible in the filtered view on the audit page.
          </p>
        </section>

        {/* ── Section 3: How tracker works ─────────────────────────── */}
        <section id="tracker" className="space-y-4">
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <Target className="w-6 h-6 text-emerald-300" />
            3. How the Premium Pick Tracker works
          </h2>
          <p className="text-slate-300 leading-relaxed">
            The tracker simulates a virtual <strong>$100 flat stake</strong> on every qualifying pick at the
            consensus odds available when the pick was surfaced.
          </p>
          <div className="rounded-lg border border-slate-700 bg-slate-900/40 p-5 space-y-3 text-sm font-mono text-slate-300">
            <div>Win:   net = stake × (oddsAtPublish − 1)</div>
            <div>Loss:  net = −stake</div>
            <div>Push:  net = 0</div>
            <div>Void:  net = 0</div>
            <div className="pt-2 border-t border-slate-700">ROI = sum(net) / sum(stake on settled W/L) × 100</div>
          </div>
          <ul className="text-sm text-slate-300 space-y-2 leading-relaxed">
            <li>• Every captured row has <code className="text-xs bg-slate-900/60 px-1.5 py-0.5 rounded">oddsAtPublish</code> locked at publication. We never overwrite it later.</li>
            <li>• Settled rows are <strong>append-only</strong>: once a result lands we record it and move on. No retroactive edits.</li>
            <li>• Pushes and voids never enter the ROI denominator — they aren&apos;t losses, but they aren&apos;t wins either.</li>
            <li>• Parlays and player props are <strong>excluded</strong> from this tracker — they distort ROI and need their own surfaces.</li>
          </ul>
        </section>

        {/* ── Section 4: Odds resolution ───────────────────────────── */}
        <section id="odds" className="space-y-4">
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <Scale className="w-6 h-6 text-blue-300" />
            4. Odds resolution
          </h2>
          <p className="text-slate-300 leading-relaxed">
            We use the <strong>consensus implied probability</strong> across all tracked bookmakers as the
            source of odds-at-publish. The decimal odds we use are computed as <code className="text-xs bg-slate-900/60 px-1.5 py-0.5 rounded">1 / consensus_probability</code>.
            This includes the natural bookmaker margin (vig), so the simulated payouts match what a flat
            bettor would actually have received.
          </p>
          <p className="text-slate-300 leading-relaxed">
            Picks where consensus odds are unavailable at capture time are <strong>skipped</strong> — the
            same exclusion rule applies to live capture and to any historical reconstruction. We never
            substitute, estimate, or interpolate an odds value.
          </p>
        </section>

        {/* ── Section 5: Backfill ─────────────────────────────────── */}
        <section id="backfill" className="space-y-4">
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-amber-300" />
            5. Historical backfill — what it is and why
          </h2>
          <p className="text-slate-300 leading-relaxed">
            The forward capture cron runs every two hours and locks in every premium-qualified pick as it
            surfaces. To make the tracker useful from day one, we ran a <strong>one-shot backfill</strong> over
            the last 90 days. The backfill applies the same qualification code path, the same odds-resolution
            logic, and the same outcome derivation as live capture. Every backfilled row is labelled <span className="uppercase tracking-wide text-slate-500 border border-slate-700 rounded px-1 text-xs">backfill</span> in the audit table.
          </p>
          <p className="text-slate-300 leading-relaxed">
            What backfill is <strong>not</strong>: a cherry-picked selection. The script walks every finished
            soccer match in the window with sufficient data, applies the rules uniformly, and writes both
            winners and losers. The same exclusion (no usable odds → skip) was applied in both directions.
          </p>
          <p className="text-slate-300 leading-relaxed">
            What backfill <strong>is</strong>: a deterministic reconstruction. Given the same model state and
            consensus odds, the script will produce the same result every time. The code is in the repo.
          </p>
        </section>

        {/* ── Section 6: Limits ────────────────────────────────────── */}
        <section id="limits" className="space-y-4">
          <h2 className="text-2xl font-bold text-white">6. Limitations &amp; what we do not promise</h2>
          <ul className="text-sm text-slate-300 space-y-2 leading-relaxed">
            <li>• <strong>Past performance does not predict future results.</strong> Soccer is high-variance. Even a model with positive expected value loses streaks.</li>
            <li>• <strong>We do not guarantee profit.</strong> The tracker shows a simulation, not a recommendation to bet.</li>
            <li>• <strong>Real-world betting differs from simulation</strong> — bookmaker limits, liquidity, line movement, and your own slippage will all affect actual returns.</li>
            <li>• <strong>The model is not infallible.</strong> Strong-tier picks have run negative ROI over our 90-day window. We disclose this rather than hide it.</li>
            <li>• <strong>This is not financial advice.</strong> Betting involves risk of total loss. Please see <Link href="/responsible-betting" className="text-blue-300 hover:text-blue-200 underline">responsible betting</Link> if any of this feels like it&apos;s becoming a problem.</li>
          </ul>
        </section>

        <div className="pt-6 border-t border-slate-700 text-sm text-slate-400">
          See the tracker live at <Link href="/performance" className="text-blue-300 hover:text-blue-200 underline">/performance</Link> · Read about us at <Link href="/about" className="text-blue-300 hover:text-blue-200 underline">/about</Link> · Bet responsibly at <Link href="/responsible-betting" className="text-blue-300 hover:text-blue-200 underline">/responsible-betting</Link>.
        </div>
      </article>
    </div>
  )
}
