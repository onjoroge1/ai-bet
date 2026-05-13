import type { Metadata } from 'next'
import { AdvancedBreadcrumb } from '@/components/advanced-breadcrumb'
import { Card, CardContent } from '@/components/ui/card'
import { Heart, Phone, ExternalLink, AlertTriangle, ShieldCheck } from 'lucide-react'

export const metadata: Metadata = {
  title: 'Responsible Betting — Get Help',
  description:
    'Real signposting and self-help resources for people whose betting has stopped being fun. Hotlines, self-assessment, self-exclusion guidance, and an unsubscribe path.',
  alternates: { canonical: '/responsible-betting' },
}

interface Helpline {
  region: string
  name: string
  phone?: string
  url: string
  notes?: string
}

const HELPLINES: Helpline[] = [
  { region: 'UK', name: 'BeGambleAware', url: 'https://www.begambleaware.org/', phone: '0808 8020 133', notes: 'Free, confidential, 24/7' },
  { region: 'UK', name: 'GamCare', url: 'https://www.gamcare.org.uk/', phone: '0808 8020 133' },
  { region: 'US', name: 'National Council on Problem Gambling', url: 'https://www.ncpgambling.org/', phone: '1-800-GAMBLER', notes: 'Confidential, 24/7' },
  { region: 'Australia', name: 'Gambling Help Online', url: 'https://www.gamblinghelponline.org.au/', phone: '1800 858 858' },
  { region: 'Canada', name: 'ConnexOntario', url: 'https://www.connexontario.ca/', phone: '1-866-531-2600' },
  { region: 'Kenya', name: 'BCLB consumer helpline', url: 'https://bclb.go.ke/', notes: 'Betting Control and Licensing Board' },
  { region: 'Nigeria', name: 'Gam-Anon Nigeria', url: 'https://www.gam-anon.org/' },
  { region: 'South Africa', name: 'NRGP Problem Gambling Helpline', url: 'https://responsiblegambling.org.za/', phone: '0800 006 008' },
  { region: 'International', name: 'Gam-Anon (for affected family/friends)', url: 'https://www.gam-anon.org/' },
]

const SELF_ASSESSMENT = [
  'Have you ever felt the need to bet more and more money to feel the same excitement?',
  'Have you tried to stop or cut back on betting but found you couldn’t?',
  'Have you lied to anyone about how much you bet, or how much you lost?',
  'Have you bet money you needed for rent, bills, food, or family obligations?',
  'Have you continued to bet to try to win back losses?',
  'Have you felt restless or irritable when trying to cut back?',
  'Has betting affected your sleep, relationships, work, or mood?',
]

export default function ResponsibleBettingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        <AdvancedBreadcrumb />
      </div>

      <article className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 space-y-8">
        <header>
          <h1 className="text-3xl sm:text-4xl font-bold text-white flex items-center gap-3">
            <Heart className="w-8 h-8 text-rose-300" />
            Responsible betting
          </h1>
          <p className="text-slate-300 mt-3 text-lg leading-relaxed">
            Betting should be entertainment. If it&apos;s stopped being fun, costing more than you can
            afford to lose, or interfering with the rest of your life — please use the resources below.
          </p>
          <p className="text-xs text-slate-500 mt-2">Last updated: 2026-05-13</p>
        </header>

        {/* ── Crisis banner ────────────────────────────────────────── */}
        <Card className="bg-rose-950/40 border-rose-500/40">
          <CardContent className="p-6 flex items-start gap-4">
            <Phone className="w-6 h-6 text-rose-300 flex-shrink-0 mt-1" />
            <div>
              <p className="text-base font-semibold text-white">In immediate distress?</p>
              <p className="text-sm text-rose-100 mt-1 leading-relaxed">
                If you or someone you know is in crisis — financial, mental, or otherwise — please call a
                helpline below. They are free, confidential, and trained for this. You don&apos;t have to
                figure it out alone.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* ── Helplines ────────────────────────────────────────────── */}
        <section className="space-y-3">
          <h2 className="text-2xl font-bold text-white">Help lines &amp; support</h2>
          <p className="text-sm text-slate-400">
            All resources below are independent organisations — they have no relationship with SnapBet.
            They exist to help.
          </p>
          <div className="grid sm:grid-cols-2 gap-3">
            {HELPLINES.map(h => (
              <Card key={`${h.region}-${h.name}`} className="bg-slate-800/60 border-slate-700">
                <CardContent className="p-4 space-y-1">
                  <p className="text-[10px] text-slate-500 uppercase tracking-widest">{h.region}</p>
                  <a
                    href={h.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-semibold text-white hover:text-blue-300 inline-flex items-center gap-1.5"
                  >
                    {h.name}
                    <ExternalLink className="w-3 h-3" />
                  </a>
                  {h.phone && <p className="text-sm text-emerald-300 font-mono">{h.phone}</p>}
                  {h.notes && <p className="text-xs text-slate-400">{h.notes}</p>}
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* ── Self-assessment ──────────────────────────────────────── */}
        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <AlertTriangle className="w-6 h-6 text-amber-300" />
            Quick self-assessment
          </h2>
          <p className="text-slate-300 leading-relaxed">
            If you answer <strong>yes</strong> to any of these, please consider talking to someone. These
            questions are adapted from problem-gambling screening tools.
          </p>
          <Card className="bg-slate-800/60 border-slate-700">
            <CardContent className="p-6">
              <ol className="text-sm text-slate-300 space-y-2.5 leading-relaxed list-decimal list-inside">
                {SELF_ASSESSMENT.map(q => <li key={q}>{q}</li>)}
              </ol>
            </CardContent>
          </Card>
        </section>

        {/* ── Self-exclusion ───────────────────────────────────────── */}
        <section className="space-y-4">
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-emerald-300" />
            Self-exclusion
          </h2>
          <p className="text-slate-300 leading-relaxed">
            Most regulated bookmakers and many countries offer formal self-exclusion programmes. They lock
            you out of betting accounts (sometimes industry-wide) for a period you choose.
          </p>
          <ul className="text-sm text-slate-300 space-y-2 leading-relaxed">
            <li>• <strong>UK:</strong> <a href="https://www.gamstop.co.uk/" target="_blank" rel="noopener noreferrer" className="text-blue-300 hover:text-blue-200 underline inline-flex items-center gap-1">GAMSTOP <ExternalLink className="w-3 h-3" /></a> — covers all UK-licensed betting sites</li>
            <li>• <strong>US (multi-state):</strong> Check your state gaming commission for a Voluntary Exclusion Program</li>
            <li>• <strong>Australia:</strong> <a href="https://www.betstop.gov.au/" target="_blank" rel="noopener noreferrer" className="text-blue-300 hover:text-blue-200 underline inline-flex items-center gap-1">BetStop <ExternalLink className="w-3 h-3" /></a> — national self-exclusion register</li>
            <li>• <strong>Single bookmaker:</strong> Every regulated operator must offer cooling-off periods and self-exclusion through their account settings</li>
          </ul>
        </section>

        {/* ── Unsubscribe ──────────────────────────────────────────── */}
        <section className="space-y-3">
          <h2 className="text-2xl font-bold text-white">Stop receiving picks from us</h2>
          <p className="text-slate-300 leading-relaxed">
            If you&apos;ve subscribed to our newsletter and want to stop receiving daily picks, click the
            unsubscribe link in any email we&apos;ve sent — it takes one click. If you can&apos;t find an
            email or the link isn&apos;t working, reach us at <a href="mailto:support@snapbet.bet" className="text-blue-300 hover:text-blue-200 underline">support@snapbet.bet</a> and we&apos;ll remove you immediately.
          </p>
          <p className="text-slate-300 leading-relaxed">
            If you&apos;d like us to permanently flag your email so the system never sends to it again
            (even if you re-sign-up), say so in your message.
          </p>
        </section>

        {/* ── About this page ──────────────────────────────────────── */}
        <section className="pt-6 border-t border-slate-700 text-sm text-slate-400 leading-relaxed">
          <p>
            SnapBet AI is for entertainment and informational purposes. We do not accept bets and we do not
            handle wagering. We are not a substitute for professional help. If you are 18 or under, our
            service is not for you — please leave this site.
          </p>
        </section>
      </article>
    </div>
  )
}
