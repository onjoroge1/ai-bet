"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Trophy, Gift, Target, CheckCircle, AlertCircle, Loader2 } from "lucide-react"
import { toast } from "sonner"

interface QuizParticipation {
  id: string
  totalScore: number
  correctAnswers: number
  questionsAnswered: number
  participatedAt: string
  isCompleted: boolean
  referralCode: string | null
  bettingExperience: string
  creditsClaimed: boolean
  claimedAt: string | null
}

/**
 * QuizCreditClaim - Server-Side First Authentication
 * 
 * 🔥 NEW ARCHITECTURE: Uses /api/auth/session for user ID
 * - Gets user ID from server-side session (no waiting for useSession() sync)
 * - Fast and reliable user data access
 */
export default function QuizCreditClaim() {
  const [userId, setUserId] = useState<string | null>(null)
  const [participations, setParticipations] = useState<QuizParticipation[]>([])
  const [loading, setLoading] = useState(true)
  const [claiming, setClaiming] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [lastClaimDate, setLastClaimDate] = useState<Date | null>(null)

  // 🔥 NEW: Get user ID from server-side session
  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const res = await fetch('/api/auth/session', {
          cache: 'no-store',
          credentials: 'include',
        })
        const session = await res.json()
        if (session?.user?.id) {
          setUserId(session.user.id)
        }
      } catch (error) {
        console.error('[QuizCreditClaim] Error fetching user data:', error)
      }
    }
    fetchUserData()
  }, [])

  useEffect(() => {
    if (userId) {
      fetchQuizParticipations()
      checkLastClaimDate()
    }
  }, [userId])

  const fetchQuizParticipations = async () => {
    if (!userId) return
    
    try {
      setLoading(true)
      const response = await fetch(`/api/quiz/participations?userId=${userId}`)
      if (!response.ok) throw new Error("Failed to fetch quiz participations")
      
      const data = await response.json()
      setParticipations(data.participations || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load quiz data")
    } finally {
      setLoading(false)
    }
  }

  const checkLastClaimDate = async () => {
    if (!userId) return
    
    try {
      const response = await fetch(`/api/quiz/participations?userId=${userId}&checkLastClaim=true`)
      if (response.ok) {
        const data = await response.json()
        if (data.lastClaimDate) {
          setLastClaimDate(new Date(data.lastClaimDate))
        }
      }
    } catch (error) {
      console.error("Failed to check last claim date:", error)
    }
  }

  const getDaysUntilNextClaim = () => {
    if (!lastClaimDate) return 0
    const oneWeekAgo = new Date()
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7)
    const daysSinceClaim = Math.floor((Date.now() - lastClaimDate.getTime()) / (1000 * 60 * 60 * 24))
    return Math.max(0, 7 - daysSinceClaim)
  }

  const isOnCooldown = () => {
    return getDaysUntilNextClaim() > 0
  }

  const handleClaimCredits = async (participationId: string) => {
    try {
      setClaiming(participationId)
      setError(null)
      
      // Call the credits API to claim quiz credits
      const response = await fetch("/api/credits/claim-quiz", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          participationId,
          userId: userId
        })
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        if (response.status === 429) {
          // Weekly limit reached
          throw new Error(`Weekly limit reached: ${errorData.error}`)
        }
        throw new Error(errorData.error || "Failed to claim credits")
      }
      
      const result = await response.json()
      
      // Update the local state - mark as claimed
      setParticipations(prev => 
        prev.map(p => 
          p.id === participationId 
            ? { ...p, creditsClaimed: true, claimedAt: new Date().toISOString() }
            : p
        )
      )
      
      // Show success message with toast instead of alert
      toast.success(`Successfully claimed ${result.creditsAdded || result.credits} credits!`, {
        description: "Your prediction credits have been added to your account.",
        duration: 5000,
      })
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to claim credits"
      setError(errorMessage)
      toast.error("Failed to claim credits", {
        description: errorMessage,
        duration: 5000,
      })
    } finally {
      setClaiming(null)
    }
  }

  const calculateAccuracy = (correct: number, total: number) => {
    return total > 0 ? Math.round((correct / total) * 100) : 0
  }

  const getAccuracyColor = (accuracy: number) => {
    if (accuracy >= 90) return "text-emerald-400"
    if (accuracy >= 80) return "text-blue-400"
    if (accuracy >= 70) return "text-yellow-400"
    return "text-red-400"
  }

  const getAccuracyBadge = (accuracy: number) => {
    if (accuracy >= 90) return <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">Excellent</Badge>
    if (accuracy >= 80) return <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">Great</Badge>
    if (accuracy >= 70) return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">Good</Badge>
    return <Badge className="bg-red-500/20 text-red-400 border-red-500/30">Needs Improvement</Badge>
  }

  const calculateCreditsFromPoints = (points: number) => {
    return Math.floor(points / 50)
  }

  const getCreditsDisplay = (points: number) => {
    const credits = calculateCreditsFromPoints(points)
    const remainingPoints = points % 50
    return {
      credits,
      remainingPoints,
      canClaim: credits > 0
    }
  }

  if (loading) {
    return (
      <Card className="bg-slate-800/50 border-slate-700">
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-emerald-500" />
            <span className="ml-2 text-slate-300">Loading quiz data...</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card className="bg-slate-800/50 border-slate-700">
        <CardContent className="p-6">
          <div className="flex items-center text-red-400">
            <AlertCircle className="w-5 h-5 mr-2" />
            <span>{error}</span>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (participations.length === 0) {
    return (
      <Card className="bg-slate-800/50 border-slate-700">
        <CardContent className="p-6 text-center">
          <Trophy className="w-12 h-12 text-slate-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-white mb-2">No Quiz Completions</h3>
          <p className="text-slate-400 mb-4">
            Complete the SnapBet Quiz to earn credits for your dashboard account.
          </p>
          <Button asChild>
            <a href="/snapbet-quiz" className="bg-emerald-600 hover:bg-emerald-700">
              Take the Quiz
            </a>
          </Button>
        </CardContent>
      </Card>
    )
  }

  const unclaimedParticipations = participations.filter(p => p.isCompleted && !p.creditsClaimed)
  const claimedParticipations = participations.filter(p => p.isCompleted && p.creditsClaimed)
  const totalCreditsEarned = participations.reduce((sum, p) => sum + calculateCreditsFromPoints(p.totalScore), 0)
  const totalPointsEarned = participations.reduce((sum, p) => sum + p.totalScore, 0)
  const availableCreditsToClaim = unclaimedParticipations.reduce((sum, p) => sum + calculateCreditsFromPoints(p.totalScore), 0)

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Trophy className="w-5 h-5 text-emerald-400" />
              <div>
                <p className="text-slate-400 text-sm">Total Points Earned</p>
                <p className="text-white text-xl font-bold">{totalPointsEarned}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Gift className="w-5 h-5 text-blue-400" />
              <div>
                <p className="text-slate-400 text-sm">Available to Claim</p>
                <p className="text-white text-xl font-bold">
                  {availableCreditsToClaim}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Target className="w-5 h-5 text-purple-400" />
              <div>
                <p className="text-slate-400 text-sm">Quizzes Completed</p>
                <p className="text-white text-xl font-bold">{participations.filter(p => p.isCompleted).length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-slate-800/50 border-slate-700">
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <CheckCircle className="w-5 h-5 text-cyan-400" />
              <div>
                <p className="text-slate-400 text-sm">Conversion Rate</p>
                <p className="text-white text-xl font-bold">50:1</p>
                <p className="text-xs text-slate-500">Points:Credits</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Cooldown Warning */}
      {isOnCooldown() && (
        <Card className="bg-yellow-900/20 border-yellow-700/50">
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <AlertCircle className="w-5 h-5 text-yellow-400" />
              <div>
                <p className="text-yellow-300 text-sm font-medium">Weekly Cooldown Active</p>
                <p className="text-yellow-200 text-xs">
                  You can claim quiz credits again in {getDaysUntilNextClaim()} days
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Available Credits to Claim */}
      {unclaimedParticipations.length > 0 && (
        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white flex items-center space-x-2">
              <Gift className="w-5 h-5 text-emerald-400" />
              <span>Available Credits to Claim</span>
            </CardTitle>
            <div className="text-slate-400 text-sm mt-2">
              <span className="text-emerald-400 font-medium">50 Quiz Points = 1 Prediction Credit</span>
              <br />
              <span className="text-xs">Complete questions correctly and invite friends to earn more points!</span>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {unclaimedParticipations.map((participation) => {
              const accuracy = calculateAccuracy(participation.correctAnswers, participation.questionsAnswered)
              const creditsInfo = getCreditsDisplay(participation.totalScore)
              return (
                <div key={participation.id} className="bg-slate-700/30 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center space-x-3">
                      <div className="text-center">
                        <div className="text-2xl font-bold text-emerald-400">{creditsInfo.credits}</div>
                        <div className="text-xs text-slate-400">Credits</div>
                      </div>
                      <div className="text-center">
                        <div className="text-lg font-semibold text-blue-400">{participation.totalScore}</div>
                        <div className="text-xs text-slate-400">Points</div>
                      </div>
                      <div className="text-center">
                        <div className={`text-lg font-semibold ${getAccuracyColor(accuracy)}`}>
                          {accuracy}%
                        </div>
                        <div className="text-xs text-slate-400">Accuracy</div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      {getAccuracyBadge(accuracy)}
                      <Button
                        onClick={() => handleClaimCredits(participation.id)}
                        disabled={claiming === participation.id || isOnCooldown() || !creditsInfo.canClaim}
                        className="bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-600 disabled:cursor-not-allowed"
                      >
                        {claiming === participation.id ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Claiming...
                          </>
                        ) : isOnCooldown() ? (
                          <>
                            <AlertCircle className="w-4 h-4 mr-2" />
                            On Cooldown
                          </>
                        ) : !creditsInfo.canClaim ? (
                          <>
                            <AlertCircle className="w-4 h-4 mr-2" />
                            Need {50 - participation.totalScore} More Points
                          </>
                        ) : (
                          <>
                            <CheckCircle className="w-4 h-4 mr-2" />
                            Claim {creditsInfo.credits} Credit{creditsInfo.credits !== 1 ? 's' : ''}
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                  
                  {!creditsInfo.canClaim && (
                    <div className="mb-3 p-3 bg-yellow-900/20 border border-yellow-700/30 rounded-lg">
                      <div className="flex items-center space-x-2">
                        <AlertCircle className="w-4 h-4 text-yellow-400" />
                        <div className="text-yellow-200 text-sm">
                          <span className="font-medium">Minimum 50 points required</span>
                          <br />
                          <span className="text-xs">You need {50 - participation.totalScore} more points to claim credits</span>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <span className="text-slate-400">Correct Answers:</span>
                      <div className="text-white font-medium">{participation.correctAnswers}/{participation.questionsAnswered}</div>
                    </div>
                    <div>
                      <span className="text-slate-400">Total Points:</span>
                      <div className="text-emerald-400 font-medium">{participation.totalScore}</div>
                    </div>
                    <div>
                      <span className="text-slate-400">Experience:</span>
                      <div className="text-blue-400 font-medium">{participation.bettingExperience}</div>
                    </div>
                    <div>
                      <span className="text-slate-400">Date:</span>
                      <div className="text-slate-300 font-mono text-xs">
                        {new Date(participation.participatedAt).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                  
                  <Progress value={accuracy} className="mt-3" />
                </div>
              )
            })}
          </CardContent>
        </Card>
      )}

      {/* Claimed Credits History */}
      {claimedParticipations.length > 0 && (
        <Card className="bg-slate-800/50 border-slate-700">
          <CardHeader>
            <CardTitle className="text-white flex items-center space-x-2">
              <CheckCircle className="w-5 h-5 text-green-400" />
              <span>Claimed Credits History</span>
            </CardTitle>
            <div className="text-slate-400 text-sm mt-2">
              <span className="text-green-400 font-medium">Credits already claimed and added to your account</span>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {claimedParticipations.map((participation) => {
              const accuracy = calculateAccuracy(participation.correctAnswers, participation.questionsAnswered)
              const creditsInfo = getCreditsDisplay(participation.totalScore)
              return (
                <div key={participation.id} className="bg-slate-700/30 rounded-lg p-4 opacity-75">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center space-x-3">
                      <div className="text-center">
                        <div className="text-2xl font-bold text-green-400">{creditsInfo.credits}</div>
                        <div className="text-xs text-slate-400">Credits</div>
                      </div>
                      <div className="text-center">
                        <div className="text-lg font-semibold text-blue-400">{participation.totalScore}</div>
                        <div className="text-xs text-slate-400">Points</div>
                      </div>
                      <div className="text-center">
                        <div className={`text-lg font-semibold ${getAccuracyColor(accuracy)}`}>
                          {accuracy}%
                        </div>
                        <div className="text-xs text-slate-400">Accuracy</div>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      {getAccuracyBadge(accuracy)}
                      <div className="flex items-center space-x-2 text-green-400">
                        <CheckCircle className="w-4 h-4" />
                        <span className="text-sm font-medium">Claimed</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <span className="text-slate-400">Correct Answers:</span>
                      <div className="text-white font-medium">{participation.correctAnswers}/{participation.questionsAnswered}</div>
                    </div>
                    <div>
                      <span className="text-slate-400">Total Points:</span>
                      <div className="text-emerald-400 font-medium">{participation.totalScore}</div>
                    </div>
                    <div>
                      <span className="text-slate-400">Claimed Date:</span>
                      <div className="text-green-400 font-mono text-xs">
                        {participation.claimedAt ? new Date(participation.claimedAt).toLocaleDateString() : 'N/A'}
                      </div>
                    </div>
                    <div>
                      <span className="text-slate-400">Quiz Date:</span>
                      <div className="text-slate-300 font-mono text-xs">
                        {new Date(participation.participatedAt).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                  
                  <Progress value={accuracy} className="mt-3" />
                </div>
              )
            })}
          </CardContent>
        </Card>
      )}
    </div>
  )
} 