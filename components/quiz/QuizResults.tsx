import { Trophy, Star, Percent, Coins, Gift, Lock, Repeat, Users, MessageCircle, User } from "lucide-react"
import { useState } from "react"

interface RegistrationData {
  name: string
  email: string
  phone: string
  consent: boolean
}

interface ReferralInfo {
  referralCode?: string
  friendsInvited: string[]
  pointsEarned: number
}

interface QuizResultsProps {
  registrationData: RegistrationData | null
  experience: string | null
  score: number
  referralInfo: ReferralInfo | null
  onRestart: () => void
  stats: {
    totalPoints: number
    correctAnswers: number
    totalQuestions: number
    accuracy: number
    totalCredits: number
  }
  performance: {
    scorePercent: number
    local: string
    international: string
  }
  rewards: { label: string; credits: number }[]
  onImprove: () => void
  onJoinWhatsApp: () => void
  onJoinTelegram: () => void
  userName: string
}

export default function QuizResults({
  onRestart,
  stats,
  performance,
  rewards,
  onImprove,
  onJoinWhatsApp,
  onJoinTelegram,
  userName,
}: QuizResultsProps) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4">
      <div className="quiz-glass max-w-3xl w-full mx-auto p-8 md:p-12 rounded-2xl shadow-2xl border border-slate-700">
        {/* Top badges */}
        <div className="flex gap-2 mb-4">
          <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-400 text-xs font-semibold">Quiz Complete!</span>
          <span className="px-3 py-1 rounded-full bg-blue-500/20 text-blue-400 text-xs font-semibold">Keep Learning</span>
        </div>
        {/* Heading and subtitle */}
        <div className="text-center mb-6">
          <h1 className="text-3xl md:text-4xl font-extrabold text-white mb-2 flex items-center justify-center gap-2">
            Great Football Knowledge! <span role="img" aria-label="soccer">⚽</span>
          </h1>
          <div className="text-slate-300 text-lg">You've got solid football knowledge! Our expert tips will help you make more confident betting decisions.</div>
        </div>
        {/* Stats row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-slate-800/70 rounded-xl py-6 flex flex-col items-center">
            <Trophy className="w-7 h-7 text-yellow-400 mb-2" />
            <div className="text-2xl font-bold text-white">{stats.totalPoints}</div>
            <div className="text-slate-400 text-xs mt-1">Total Points</div>
          </div>
          <div className="bg-slate-800/70 rounded-xl py-6 flex flex-col items-center">
            <Star className="w-7 h-7 text-emerald-400 mb-2" />
            <div className="text-2xl font-bold text-white">{stats.correctAnswers}/{stats.totalQuestions}</div>
            <div className="text-slate-400 text-xs mt-1">Correct Answers</div>
          </div>
          <div className="bg-slate-800/70 rounded-xl py-6 flex flex-col items-center">
            <Percent className="w-7 h-7 text-blue-400 mb-2" />
            <div className="text-2xl font-bold text-white">{stats.accuracy}%</div>
            <div className="text-slate-400 text-xs mt-1">Accuracy</div>
          </div>
          <div className="bg-slate-800/70 rounded-xl py-6 flex flex-col items-center">
            <Coins className="w-7 h-7 text-purple-400 mb-2" />
            <div className="text-2xl font-bold text-white">{stats.totalCredits}</div>
            <div className="text-slate-400 text-xs mt-1">Total Credits</div>
          </div>
        </div>
        {/* Performance section */}
        <div className="bg-slate-800/70 rounded-xl p-6 mb-8 border border-slate-700">
          <div className="text-white text-lg font-semibold mb-2">Your Performance</div>
          <div className="flex items-center gap-4 mb-2">
            <span className="text-slate-300">Quiz Score</span>
            <div className="flex-1 h-2 bg-slate-700 rounded-full overflow-hidden">
              <div className="h-2 bg-emerald-400 rounded-full" style={{ width: `${performance.scorePercent}%` }} />
            </div>
            <span className="text-slate-300">{performance.scorePercent}%</span>
          </div>
          <div className="flex justify-between text-sm text-slate-300 mt-2">
            <span>Local Football: <span className="text-emerald-400 font-semibold">{performance.local}</span></span>
            <span>International: <span className="text-blue-400 font-semibold">{performance.international}</span></span>
          </div>
        </div>
        {/* Rewards section */}
        <div className="bg-gradient-to-br from-emerald-900 to-emerald-800 rounded-xl p-6 mb-8">
          <div className="flex items-center gap-2 mb-4">
            <Gift className="w-5 h-5 text-emerald-400" />
            <span className="text-lg font-semibold text-emerald-300">Rewards Earned</span>
          </div>
          {rewards.map((reward, i) => (
            <div key={reward.label} className="flex justify-between items-center text-white mb-2 last:mb-0">
              <span>{reward.label}</span>
              <span className="bg-emerald-900/80 text-emerald-400 px-3 py-1 rounded-full text-xs font-semibold">+{reward.credits} Credits</span>
            </div>
          ))}
          <div className="mt-4 p-3 bg-emerald-800/50 rounded-lg border border-emerald-700/50">
            <div className="flex items-center gap-2 text-emerald-200 text-sm">
              <Coins className="w-4 h-4" />
              <span className="font-medium">Dashboard Credits Available!</span>
            </div>
            <p className="text-emerald-100 text-xs mt-1">
              Sign in to your dashboard to claim {Math.floor(stats.totalCredits / 50)} credits and unlock premium predictions.
            </p>
            <div className="text-emerald-200 text-xs mt-2 p-2 bg-emerald-800/30 rounded border border-emerald-700/50">
              <span className="font-medium">Conversion Rate:</span> 50 Quiz Points = 1 Prediction Credit
            </div>
          </div>
        </div>
        {/* Action buttons */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          <button
            onClick={onRestart}
            className="w-full flex flex-col items-center justify-center bg-slate-800/70 text-white font-bold text-lg rounded-lg py-6 shadow-lg hover:bg-slate-700 transition-colors duration-200"
          >
            <Repeat className="w-7 h-7 mb-2" />
            Take Quiz Again
            <span className="text-sm font-normal mt-1">Try to beat your score</span>
          </button>
          <button
            onClick={onImprove}
            className="w-full flex flex-col items-center justify-center bg-gradient-to-r from-emerald-400 to-cyan-400 text-white font-bold text-lg rounded-lg py-6 shadow-lg hover:scale-105 transition-transform duration-200"
          >
            <User className="w-7 h-7 mb-2" />
            Improve Your Betting
            <span className="text-sm font-normal mt-1">Access your dashboard</span>
          </button>
        </div>
        {/* Community section */}
        <div className="bg-slate-800/70 rounded-xl p-6 mb-8 border border-slate-700 text-center">
          <div className="text-white text-lg font-semibold mb-2">Join the SnapBet Community</div>
          <div className="text-slate-300 mb-4">Connect with other football fans, get daily tips, and never miss a winning opportunity!</div>
          <div className="flex flex-col md:flex-row gap-4 justify-center">
            <button
              onClick={onJoinWhatsApp}
              className="flex-1 flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white py-3 rounded text-base font-semibold"
            >
              <MessageCircle className="w-5 h-5" /> WhatsApp Group
            </button>
            <button
              onClick={onJoinTelegram}
              className="flex-1 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white py-3 rounded text-base font-semibold"
            >
              <Users className="w-5 h-5" /> Telegram Channel
            </button>
          </div>
        </div>
        {/* Bottom message */}
        <div className="text-center text-slate-300 text-sm mt-4">
          <span role="img" aria-label="confetti">🎉</span> Congratulations <span className="font-semibold text-white">{userName}</span>! Watch your phone for exclusive offers and tips.
        </div>
      </div>
    </div>
  )
} 