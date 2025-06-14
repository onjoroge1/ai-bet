"use client"

import { useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Trophy, Star, Target, Users, TrendingUp, Crown } from "lucide-react"

interface Achievement {
  id: string
  name: string
  description: string
  icon: string
  category: string
  progress: number
  isCompleted: boolean
  reward?: {
    type: string
    amount: number
  }
}

export function AchievementsWidget() {
  const [achievements, setAchievements] = useState<Achievement[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Simulate fetching achievements
    const fetchAchievements = async () => {
      const mockAchievements: Achievement[] = [
        {
          id: "1",
          name: "First Win",
          description: "Win your first prediction",
          icon: "trophy",
          category: "milestone",
          progress: 100,
          isCompleted: true,
          reward: { type: "bonus", amount: 100 },
        },
        {
          id: "2",
          name: "5-Win Streak",
          description: "Win 5 predictions in a row",
          icon: "target",
          category: "streak",
          progress: 100,
          isCompleted: true,
          reward: { type: "bonus", amount: 200 },
        },
        {
          id: "3",
          name: "10-Win Streak",
          description: "Win 10 predictions in a row",
          icon: "star",
          category: "streak",
          progress: 50,
          isCompleted: false,
        },
        {
          id: "4",
          name: "Profit Master",
          description: "Earn KES 10,000 in total winnings",
          icon: "trending-up",
          category: "profit",
          progress: 75,
          isCompleted: false,
          reward: { type: "bonus", amount: 500 },
        },
        {
          id: "5",
          name: "Referral Champion",
          description: "Refer 5 friends to the platform",
          icon: "users",
          category: "referral",
          progress: 60,
          isCompleted: false,
          reward: { type: "bonus", amount: 1000 },
        },
        {
          id: "6",
          name: "VIP Elite",
          description: "Maintain VIP status for 6 months",
          icon: "crown",
          category: "milestone",
          progress: 33,
          isCompleted: false,
          reward: { type: "bonus", amount: 2000 },
        },
      ]

      setAchievements(mockAchievements)
      setLoading(false)
    }

    fetchAchievements()
  }, [])

  const getAchievementIcon = (icon: string, isCompleted: boolean) => {
    const iconClass = `w-6 h-6 ${isCompleted ? "text-yellow-400" : "text-slate-400"}`

    switch (icon) {
      case "trophy":
        return <Trophy className={iconClass} />
      case "star":
        return <Star className={iconClass} />
      case "target":
        return <Target className={iconClass} />
      case "users":
        return <Users className={iconClass} />
      case "trending-up":
        return <TrendingUp className={iconClass} />
      case "crown":
        return <Crown className={iconClass} />
      default:
        return <Trophy className={iconClass} />
    }
  }

  const getCategoryColor = (category: string) => {
    switch (category) {
      case "streak":
        return "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
      case "profit":
        return "bg-blue-500/20 text-blue-400 border-blue-500/30"
      case "referral":
        return "bg-purple-500/20 text-purple-400 border-purple-500/30"
      case "milestone":
        return "bg-yellow-500/20 text-yellow-400 border-yellow-500/30"
      default:
        return "bg-slate-500/20 text-slate-400 border-slate-500/30"
    }
  }

  if (loading) {
    return (
      <Card className="bg-slate-800/50 border-slate-700 p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-slate-700 rounded w-1/2"></div>
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 bg-slate-700 rounded"></div>
          ))}
        </div>
      </Card>
    )
  }

  const completedCount = achievements.filter((a) => a.isCompleted).length
  const totalCount = achievements.length

  return (
    <Card className="bg-slate-800/50 border-slate-700 p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-2">
          <Trophy className="w-5 h-5 text-yellow-400" />
          <h3 className="text-lg font-semibold text-white">Achievements</h3>
        </div>
        <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">
          {completedCount}/{totalCount}
        </Badge>
      </div>

      <div className="space-y-4 max-h-80 overflow-y-auto">
        {achievements.map((achievement) => (
          <div
            key={achievement.id}
            className={`p-4 rounded-lg border transition-all ${
              achievement.isCompleted ? "bg-yellow-500/10 border-yellow-500/30" : "bg-slate-700/30 border-slate-600"
            }`}
          >
            <div className="flex items-start space-x-3">
              <div className={`p-2 rounded-lg ${achievement.isCompleted ? "bg-yellow-500/20" : "bg-slate-600/50"}`}>
                {getAchievementIcon(achievement.icon, achievement.isCompleted)}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center space-x-2 mb-1">
                  <h4 className={`text-sm font-medium ${achievement.isCompleted ? "text-yellow-400" : "text-white"}`}>
                    {achievement.name}
                  </h4>
                  <Badge className={getCategoryColor(achievement.category)}>{achievement.category}</Badge>
                  {achievement.isCompleted && <Badge className="bg-emerald-500 text-white">✓</Badge>}
                </div>

                <p className="text-xs text-slate-400 mb-2">{achievement.description}</p>

                {!achievement.isCompleted && (
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-400">Progress</span>
                      <span className="text-slate-300">{achievement.progress}%</span>
                    </div>
                    <Progress value={achievement.progress} className="h-2" />
                  </div>
                )}

                {achievement.reward && (
                  <div className="mt-2 text-xs text-emerald-400">Reward: +KES {achievement.reward.amount}</div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </Card>
  )
}
