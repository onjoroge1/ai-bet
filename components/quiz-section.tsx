"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { 
  Brain, 
  Clock, 
  Target, 
  Users, 
  Zap, 
  Trophy, 
  Star, 
  Play,
  Award,
  TrendingUp,
  Sparkles,
  ArrowRight,
  CheckCircle,
  Timer,
  Gift,
  Crown,
  Medal,
  RefreshCw,
  Loader2
} from "lucide-react"
import Link from "next/link"
import { useQuizLeaderboard } from "@/hooks/use-quiz-leaderboard"

export function QuizSection() {
  const [currentTime, setCurrentTime] = useState(new Date())
  const [isHovered, setIsHovered] = useState(false)
  
  // Fetch real leaderboard data
  const { 
    data: leaderboardData, 
    loading: leaderboardLoading, 
    error: leaderboardError, 
    refresh: refreshLeaderboard,
    currentUserEntry,
    topPerformers,
    otherEntries,
    totalParticipants,
    averageScore,
    averageCorrect
  } = useQuizLeaderboard(10, true)

  // Update time every second for live countdown
  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(interval)
  }, [])

  // Calculate time until next quiz reset (assuming daily reset at midnight)
  const getTimeUntilReset = () => {
    const now = new Date()
    const tomorrow = new Date(now)
    tomorrow.setDate(tomorrow.getDate() + 1)
    tomorrow.setHours(0, 0, 0, 0)
    
    const diff = tomorrow.getTime() - now.getTime()
    const hours = Math.floor(diff / (1000 * 60 * 60))
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
    const seconds = Math.floor((diff % (1000 * 60)) / 1000)
    
    return { hours, minutes, seconds }
  }

  const timeUntilReset = getTimeUntilReset()

  const features = [
    {
      icon: Brain,
      title: "Test Your Knowledge",
      description: "5 challenging sports questions in 2.5 minutes",
      color: "from-emerald-500 to-teal-600"
    },
    {
      icon: Trophy,
      title: "Win Real Credits",
      description: "Earn up to 50 credits for perfect scores",
      color: "from-yellow-500 to-orange-600"
    },
    {
      icon: TrendingUp,
      title: "Daily Leaderboard",
      description: "Compete with other sports enthusiasts",
      color: "from-purple-500 to-pink-600"
    },
    {
      icon: Gift,
      title: "Referral Bonuses",
      description: "Invite friends for extra rewards",
      color: "from-blue-500 to-indigo-600"
    }
  ]

  const rewardStructure = [
    { score: "5/5", credits: 50, badge: "🏆", color: "from-yellow-400 to-orange-500", description: "Perfect Score" },
    { score: "4/5", credits: 25, badge: "🥈", color: "from-gray-400 to-gray-500", description: "Excellent" },
    { score: "3/5", credits: 10, badge: "🥉", color: "from-amber-600 to-orange-600", description: "Good Job" },
    { score: "2/5", credits: 5, badge: "⭐", color: "from-blue-500 to-indigo-500", description: "Keep Trying" }
  ]

  // Render leaderboard entry with proper styling
  const renderLeaderboardEntry = (entry: any, index: number) => {
    const isTop3 = entry.rank <= 3
    const isCurrentUser = entry.isCurrentUser
    
  return (
      <div 
        key={entry.id} 
        className={`flex items-center justify-between p-3 rounded-lg transition-all duration-200 ${
          isCurrentUser 
            ? 'bg-emerald-900/30 border border-emerald-700/50 shadow-lg' 
            : isTop3
            ? 'bg-slate-700/70 border border-slate-600/50'
            : 'bg-slate-700/50'
        } ${isCurrentUser ? 'ring-2 ring-emerald-500/50' : ''}`}
      >
        <div className="flex items-center space-x-3">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
            entry.rank === 1 ? 'bg-yellow-500 text-yellow-900' :
            entry.rank === 2 ? 'bg-gray-400 text-gray-900' :
            entry.rank === 3 ? 'bg-amber-600 text-amber-900' :
            'bg-slate-600 text-slate-300'
          }`}>
            {entry.rank}
          </div>
          <div>
            <div className={`font-medium ${isCurrentUser ? 'text-emerald-400' : 'text-white'}`}>
              {entry.name}
              {isCurrentUser && <span className="ml-2 text-xs text-emerald-400">(You)</span>}
          </div>
            <div className="text-xs text-slate-400">
              {entry.score} • {entry.time}
        </div>
                    </div>
                    </div>
        <div className="text-right">
          <div className="text-sm font-semibold text-emerald-400">{entry.credits} credits</div>
          {isCurrentUser && (
            <Badge className="bg-emerald-500/20 text-emerald-400 text-xs">You</Badge>
          )}
                    </div>
                  </div>
    )
  }

  return (
    <section className="py-20 px-4 relative overflow-hidden">
      {/* Background Elements */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-900">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_80%,rgba(16,185,129,0.1),transparent_50%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,rgba(6,182,212,0.1),transparent_50%)]" />
      </div>

      <div className="relative max-w-7xl mx-auto z-10">
        {/* Hero Section */}
        <div className="text-center mb-16">
          <Badge variant="secondary" className="mb-6 bg-yellow-500/20 text-yellow-400 border-yellow-500/30">
            <Trophy className="w-4 h-4 mr-2" />
            Daily Challenge • Free Credits
          </Badge>
          
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-6">
            Think You Know Sports?
          </h2>
          
          <p className="text-xl md:text-2xl text-slate-300 mb-8 max-w-4xl mx-auto leading-relaxed">
            Test your knowledge in our <span className="text-yellow-400 font-semibold">daily sports quiz</span> and win 
            <span className="text-emerald-400 font-semibold"> real credits</span> to use on AI predictions. 
            <span className="text-white font-semibold"> Only 2.5 minutes, no registration required!</span>
          </p>

          {/* Live Countdown */}
          <div className="bg-slate-800/50 backdrop-blur-sm border border-slate-700 rounded-2xl p-6 max-w-md mx-auto mb-8">
            <div className="flex items-center justify-center space-x-2 mb-3">
              <Timer className="w-5 h-5 text-red-400 animate-pulse" />
              <span className="text-slate-300 font-medium">Next Quiz Reset In:</span>
            </div>
            <div className="flex items-center justify-center space-x-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-red-400">{timeUntilReset.hours.toString().padStart(2, '0')}</div>
                <div className="text-xs text-slate-400">Hours</div>
                      </div>
              <div className="text-2xl text-slate-400">:</div>
              <div className="text-center">
                <div className="text-2xl font-bold text-red-400">{timeUntilReset.minutes.toString().padStart(2, '0')}</div>
                <div className="text-xs text-slate-400">Minutes</div>
                      </div>
              <div className="text-2xl text-slate-400">:</div>
              <div className="text-center">
                <div className="text-2xl font-bold text-red-400">{timeUntilReset.seconds.toString().padStart(2, '0')}</div>
                <div className="text-xs text-slate-400">Seconds</div>
                      </div>
                    </div>
                  </div>

          {/* CTA Button */}
                  <Button 
                    size="lg" 
            className="bg-gradient-to-r from-yellow-500 to-orange-600 hover:from-yellow-600 hover:to-orange-700 text-white px-12 py-6 text-xl group transform hover:scale-105 transition-all duration-300"
                    asChild
                  >
                    <Link href="/snapbet-quiz">
              <Play className="w-6 h-6 mr-3 group-hover:animate-bounce" />
              Start Quiz Now - It's Free!
              <ArrowRight className="w-6 h-6 ml-3 group-hover:translate-x-1 transition-transform" />
                    </Link>
                  </Button>
                </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
          {features.map((feature, index) => (
            <Card key={index} className="bg-slate-800/50 border-slate-700 hover:bg-slate-800/70 transition-all duration-300 hover:scale-105 group">
              <CardContent className="p-6 text-center">
                <div className={`w-16 h-16 bg-gradient-to-r ${feature.color} rounded-2xl flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform duration-300`}>
                  <feature.icon className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-white font-semibold text-lg mb-2">{feature.title}</h3>
                <p className="text-slate-400 text-sm leading-relaxed">{feature.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-16">
          {/* Left Side - Quiz Experience */}
                <div className="space-y-6">
            <Card className="bg-slate-800/50 border-slate-700">
              <CardContent className="p-6">
                <div className="flex items-center justify-center space-x-3 mb-4">
                  <div className="w-12 h-12 bg-gradient-to-r from-emerald-500 to-cyan-600 rounded-xl flex items-center justify-center">
                    <Brain className="w-6 h-6 text-white" />
                      </div>
                  <div>
                    <h3 className="text-xl font-semibold text-white">Quiz Experience</h3>
                    <p className="text-slate-400 text-sm">Fast, fun, and rewarding</p>
                    </div>
                  </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 bg-slate-700/50 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <Clock className="w-5 h-5 text-emerald-400" />
                      <span className="text-slate-300">Time Limit</span>
                    </div>
                    <Badge variant="secondary" className="bg-emerald-500/20 text-emerald-400">30s per question</Badge>
                  </div>
                  
                  <div className="flex items-center justify-between p-3 bg-slate-700/50 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <Target className="w-5 h-5 text-blue-400" />
                      <span className="text-slate-300">Questions</span>
                    </div>
                    <Badge variant="secondary" className="bg-blue-500/20 text-blue-400">5 questions</Badge>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-slate-700/50 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <Trophy className="w-5 h-5 text-yellow-400" />
                      <span className="text-slate-300">Total Time</span>
                      </div>
                    <Badge variant="secondary" className="bg-yellow-500/20 text-yellow-400">2.5 minutes</Badge>
                      </div>
                  
                  <div className="flex items-center justify-between p-3 bg-slate-700/50 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <Gift className="w-5 h-5 text-purple-400" />
                      <span className="text-slate-300">Registration</span>
                      </div>
                    <Badge variant="secondary" className="bg-purple-500/20 text-purple-400">Not required</Badge>
                      </div>
                    </div>
              </CardContent>
            </Card>

            {/* What You'll Learn */}
            <Card className="bg-slate-800/50 border-slate-700">
              <CardContent className="p-6">
                <h3 className="text-xl font-semibold text-white mb-4 flex items-center">
                  <Sparkles className="w-5 h-5 text-yellow-400 mr-2" />
                  What You'll Learn
                </h3>
                <div className="space-y-3">
                  <div className="flex items-center space-x-3">
                    <CheckCircle className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                    <span className="text-slate-300 text-sm">Understanding confidence scores and prediction analytics</span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <CheckCircle className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                    <span className="text-slate-300 text-sm">Value betting strategies and risk assessment</span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <CheckCircle className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                    <span className="text-slate-300 text-sm">How to interpret AI-powered sports insights</span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <CheckCircle className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                    <span className="text-slate-300 text-sm">Bankroll management and disciplined betting</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

          {/* Right Side - Leaderboard & Rewards */}
          <div className="space-y-6">
            {/* Daily Leaderboard */}
            <Card className="bg-slate-800/50 border-slate-700">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xl font-semibold text-white flex items-center">
                    <Crown className="w-5 h-5 text-yellow-400 mr-2" />
                    Today's Leaderboard
                  </h3>
            <div className="flex items-center space-x-2">
                    <Badge variant="secondary" className="bg-yellow-500/20 text-yellow-400">Live</Badge>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={refreshLeaderboard}
                      disabled={leaderboardLoading}
                      className="p-1 h-8 w-8 text-slate-400 hover:text-white"
                    >
                      {leaderboardLoading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <RefreshCw className="w-4 h-4" />
                      )}
                    </Button>
                  </div>
                </div>
                
                {leaderboardLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="w-8 h-8 animate-spin text-emerald-400" />
                  </div>
                ) : leaderboardError ? (
                  <div className="text-center py-8">
                    <div className="text-red-400 mb-2">Failed to load leaderboard</div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={refreshLeaderboard}
                      className="text-slate-400 hover:text-white"
                    >
                      Try Again
                    </Button>
                  </div>
                ) : leaderboardData?.leaderboard && leaderboardData.leaderboard.length > 0 ? (
                  <div className="space-y-3">
                    {leaderboardData.leaderboard.map((entry, index) => 
                      renderLeaderboardEntry(entry, index)
                    )}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Trophy className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                    <div className="text-slate-400 text-sm">No quiz completions today</div>
                    <div className="text-slate-500 text-xs mt-1">Be the first to complete the quiz!</div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Reward Structure */}
            <Card className="bg-slate-800/50 border-slate-700">
              <CardContent className="p-6">
                <h3 className="text-xl font-semibold text-white mb-4 flex items-center">
                  <Award className="w-5 h-5 text-yellow-400 mr-2" />
                  Reward Structure
                </h3>
                
                <div className="space-y-3">
                  {rewardStructure.map((reward, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-slate-700/50 rounded-lg">
                      <div className="flex items-center space-x-3">
                        <span className="text-2xl">{reward.badge}</span>
                        <div>
                          <div className="text-white font-medium">{reward.score}</div>
                          <div className="text-xs text-slate-400">{reward.description}</div>
                        </div>
                      </div>
                      <Badge 
                        variant="secondary" 
                        className={`bg-gradient-to-r ${reward.color} text-white border-0`}
                      >
                        {reward.credits} credits
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Social Proof & Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-16">
          <Card className="bg-slate-800/50 border-slate-700 text-center">
            <CardContent className="p-6">
              <div className="flex items-center justify-center space-x-2 mb-2">
                <Users className="w-6 h-6 text-emerald-400" />
                <span className="text-3xl font-bold text-white">
                  {leaderboardLoading ? '...' : totalParticipants}
                </span>
              </div>
              <p className="text-slate-300">Users completed today</p>
              <p className="text-xs text-slate-400 mt-1">
                {leaderboardLoading ? 'Loading...' : 'Live data'}
              </p>
            </CardContent>
          </Card>
          
          <Card className="bg-slate-800/50 border-slate-700 text-center">
            <CardContent className="p-6">
              <div className="flex items-center justify-center space-x-2 mb-2">
                <Trophy className="w-6 h-6 text-yellow-400" />
                <span className="text-3xl font-bold text-yellow-400">
                  {leaderboardLoading ? '...' : averageScore}
                </span>
              </div>
              <p className="text-slate-300">Average score</p>
              <p className="text-xs text-slate-400 mt-1">
                {leaderboardLoading ? 'Loading...' : `${averageCorrect}/5 correct`}
              </p>
            </CardContent>
          </Card>
          
          <Card className="bg-slate-800/50 border-slate-700 text-center">
            <CardContent className="p-6">
              <div className="flex items-center justify-center space-x-2 mb-2">
                <Gift className="w-6 h-6 text-purple-400" />
                <span className="text-3xl font-bold text-purple-400">
                  {leaderboardLoading ? '...' : (totalParticipants * 15).toLocaleString()}
                </span>
            </div>
              <p className="text-slate-300">Credits awarded today</p>
              <p className="text-xs text-slate-400 mt-1">
                {leaderboardLoading ? 'Loading...' : 'Estimated total'}
              </p>
            </CardContent>
          </Card>
            </div>

        {/* Bottom CTA */}
        <div className="text-center">
          <h3 className="text-2xl font-bold text-white mb-4">Ready to Test Your Sports Knowledge?</h3>
          <p className="text-slate-300 mb-6 max-w-2xl mx-auto">
            Join thousands of sports enthusiasts who take our daily quiz. 
            It's free, fun, and you could win credits for AI predictions!
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button 
              size="lg" 
              className="bg-gradient-to-r from-yellow-500 to-orange-600 hover:from-yellow-600 hover:to-orange-700 text-white px-8 py-4 text-lg group"
              asChild
            >
              <Link href="/snapbet-quiz">
                <Play className="w-5 h-5 mr-2 group-hover:animate-bounce" />
                Start Quiz Now
              </Link>
            </Button>
            <Button 
              size="lg" 
              variant="outline" 
              className="border-slate-600 text-slate-300 hover:bg-slate-800 px-8 py-4 text-lg"
              asChild
            >
              <Link href="/daily-tips">
                <Target className="w-5 h-5 mr-2" />
                See Today's Predictions
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  )
} 