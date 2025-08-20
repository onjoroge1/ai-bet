import { Card } from "@/components/ui/card"
import { Shield, Zap, Globe, CreditCard, Users, Award, Brain, Target, BarChart3, CheckCircle } from "lucide-react"

export function TrustBadges() {
  const badges = [
    {
      icon: Brain,
      title: "AI-Powered Analysis",
      description: "Advanced machine learning algorithms that find value the sportsbooks hide",
    },
    {
      icon: Target,
      title: "Margin-Free Probabilities",
      description: "True probabilities, not inflated odds with hidden margins",
    },
    {
      icon: BarChart3,
      title: "Market Consensus",
      description: "Multi-book aggregation with market dispersion analysis",
    },
    {
      icon: Shield,
      title: "Transparent & Trusted",
      description: "Full method disclosure and verification reports",
    },
    {
      icon: Globe,
      title: "Global Coverage",
      description: "25+ countries, 15+ languages, local payment methods",
    },
    {
      icon: CheckCircle,
      title: "No Betting Risk",
      description: "We don't take bets, we make your bets better",
    },
  ]

  return (
    <section className="py-16 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-2xl md:text-3xl font-bold text-white mb-4">Why SnapBet Beats Regular Odds Sites</h2>
          <p className="text-slate-300">Built for smart bettors who want more than just odds listings</p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {badges.map((badge, index) => (
            <Card
              key={index}
              className="bg-slate-800/30 border-slate-700 p-4 text-center hover:bg-slate-800/50 transition-colors"
            >
              <div className="w-10 h-10 bg-emerald-500/20 rounded-lg flex items-center justify-center mx-auto mb-3">
                <badge.icon className="w-5 h-5 text-emerald-400" />
              </div>
              <div className="text-white font-medium text-sm mb-1">{badge.title}</div>
              <div className="text-slate-400 text-xs">{badge.description}</div>
            </Card>
          ))}
        </div>
      </div>
    </section>
  )
}
