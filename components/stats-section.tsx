import { Card } from "@/components/ui/card"
import { TrendingUp, Users, Trophy, Globe } from "lucide-react"

export function StatsSection() {
  const stats = [
    {
      icon: TrendingUp,
      value: "87%",
      label: "Win Rate",
      description: "Average success rate across all predictions",
    },
    {
      icon: Users,
      value: "50K+",
      label: "Active Users",
      description: "Bettors trust our AI predictions daily",
    },
    {
      icon: Trophy,
      value: "€2M+",
      label: "Winnings Generated",
      description: "Total profits for our community",
    },
    {
      icon: Globe,
      value: "25+",
      label: "Countries",
      description: "Global reach with local payment methods",
    },
  ]

  return (
    <section className="py-16 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">Trusted by Bettors Worldwide</h2>
          <p className="text-slate-300 text-lg">
            Our AI-powered predictions deliver consistent results across global markets
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {stats.map((stat, index) => (
            <Card
              key={index}
              className="bg-slate-800/50 border-slate-700 p-6 text-center hover:bg-slate-800/70 transition-colors"
            >
              <div className="w-12 h-12 bg-emerald-500/20 rounded-lg flex items-center justify-center mx-auto mb-4">
                <stat.icon className="w-6 h-6 text-emerald-400" />
              </div>
              <div className="text-3xl font-bold text-white mb-2">{stat.value}</div>
              <div className="text-emerald-400 font-semibold mb-2">{stat.label}</div>
              <div className="text-slate-400 text-sm">{stat.description}</div>
            </Card>
          ))}
        </div>
      </div>
    </section>
  )
}
