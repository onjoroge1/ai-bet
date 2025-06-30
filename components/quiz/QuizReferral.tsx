import { useState } from "react"
import { Copy, Send, UserPlus, Link2, Gift, Users } from "lucide-react"

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

interface QuizReferralProps {
  registrationData: RegistrationData | null
  score: number
  onNext: (refInfo: ReferralInfo) => void
  onBack: () => void
}

export default function QuizReferral({ score, onNext, onBack }: QuizReferralProps) {
  const [referralCode] = useState(
    Math.random().toString(36).substr(2, 8).toUpperCase()
  )
  const [friendPhones, setFriendPhones] = useState<string[]>([])
  const [phoneTextarea, setPhoneTextarea] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [copied, setCopied] = useState(false)

  const referralLink = `https://snapbet.bet/snapbet-quiz?ref=${referralCode}`

  // Stats (replace with real data if available)
  const stats = [
    { label: "Quiz Points", value: score },
    { label: "Links Shared", value: 1 },
    { label: "Numbers Added", value: friendPhones.length },
    { label: "Bonus Points", value: 0 },
  ]

  const handleCopy = () => {
    navigator.clipboard.writeText(referralLink)
    setCopied(true)
    setTimeout(() => setCopied(false), 1200)
  }

  const handleShare = (platform: string) => {
    const message = `Take the SnapBet Football Quiz and win! ${referralLink}`
    if (platform === "whatsapp") {
      window.open(`https://wa.me/?text=${encodeURIComponent(message)}`)
    } else if (platform === "telegram") {
      window.open(`https://t.me/share/url?url=${encodeURIComponent(referralLink)}&text=${encodeURIComponent(message)}`)
    }
  }

  const handlePhoneTextarea = (val: string) => {
    setPhoneTextarea(val)
    const numbers = val
      .split("\n")
      .map((n) => n.trim())
      .filter((n) => n.length > 0)
    setFriendPhones(numbers)
  }

  const handleSubmit = () => {
    setIsSubmitting(true)
    setTimeout(() => {
      onNext({ referralCode, friendsInvited: friendPhones, pointsEarned: score + friendPhones.length * 5 })
    }, 1000)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 w-full pt-4 animate-fadeIn">
      <div className="flex items-center justify-center w-full pb-4">
        <div className="quiz-glass max-w-3xl w-full mx-auto p-10 rounded-2xl shadow-2xl border border-slate-700">
          {/* Step Indicator & Bonus */}
          <div className="flex items-center justify-center gap-3 mb-6">
            <span className="px-3 py-1 rounded-full bg-emerald-900/60 text-emerald-300 text-xs font-semibold">Step 3 of 4</span>
            <span className="px-3 py-1 rounded-full bg-yellow-400/20 text-yellow-400 text-xs font-semibold flex items-center gap-1">
              <Gift className="w-4 h-4" /> Bonus Round!
            </span>
          </div>
          {/* Title & Subtitle */}
          <div className="text-center mb-8">
            <h1 className="text-2xl md:text-3xl font-extrabold text-white mb-2">Invite Friends for More Rewards!</h1>
            <div className="text-slate-400 mb-2">Share your quiz link or add friend numbers to earn bonus points</div>
          </div>
          {/* Stats Row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {stats.map((stat) => (
              <div key={stat.label} className="bg-slate-800/70 rounded-xl py-4 flex flex-col items-center">
                <div className="text-2xl font-bold text-emerald-300">{stat.value}</div>
                <div className="text-slate-400 text-xs mt-1">{stat.label}</div>
              </div>
            ))}
          </div>
          {/* Share Referral Link */}
          <div className="bg-slate-800/70 rounded-xl p-6 mb-8 border border-slate-700">
            <div className="flex items-center mb-2 gap-2">
              <Link2 className="w-5 h-5 text-emerald-400" />
              <span className="text-lg font-semibold text-white">Share Your Referral Link</span>
            </div>
            <div className="text-slate-400 text-sm mb-3">Get 10 points for each friend who completes the quiz</div>
            <div className="flex items-center gap-2 mb-3">
              <input
                type="text"
                value={referralLink}
                readOnly
                className="flex-1 bg-slate-900 border border-slate-700 rounded px-3 py-2 text-sm font-mono text-slate-300 truncate outline-none"
              />
              <button
                type="button"
                onClick={handleCopy}
                className={`flex items-center gap-1 px-3 py-2 rounded bg-slate-700 text-slate-200 hover:bg-slate-600 text-sm font-medium ${copied ? 'ring-2 ring-emerald-400' : ''}`}
              >
                <Copy className="w-4 h-4" /> {copied ? "Copied!" : "Copy"}
              </button>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => handleShare("whatsapp")}
                className="flex-1 flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white py-2 rounded text-sm font-semibold"
              >
                <UserPlus className="w-4 h-4" /> Share on WhatsApp
              </button>
              <button
                type="button"
                onClick={() => handleShare("telegram")}
                className="flex-1 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded text-sm font-semibold"
              >
                <Send className="w-4 h-4" /> Share on Telegram
              </button>
            </div>
          </div>
          {/* Add Friend Numbers */}
          <div className="bg-slate-800/70 rounded-xl p-6 mb-8 border border-slate-700">
            <div className="flex items-center mb-2 gap-2">
              <Users className="w-5 h-5 text-emerald-400" />
              <span className="text-lg font-semibold text-white">Add Friend Numbers</span>
            </div>
            <div className="text-slate-400 text-sm mb-3">5 points per number added + 10 points when they complete the quiz</div>
            <label className="text-white text-sm font-semibold mb-1 block">Friend Phone Numbers (one per line)</label>
            <textarea
              rows={4}
              value={phoneTextarea}
              onChange={e => handlePhoneTextarea(e.target.value)}
              placeholder={'+254712345678\n+254723456789\n+254734567890'}
              className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-sm text-slate-300 font-mono outline-none resize-none mb-4"
            />
            <button
              type="button"
              disabled={friendPhones.length === 0}
              className="w-full flex items-center justify-center gap-2 py-2 rounded bg-gradient-to-r from-fuchsia-600 to-purple-500 text-white font-semibold text-sm disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <Send className="w-4 h-4" /> Send SMS Invitations
            </button>
          </div>
          {/* Referral Code Card */}
          <div className="rounded-xl p-8 mb-8 text-center" style={{ background: "linear-gradient(135deg, #134e4a 0%, #0e7490 100%)" }}>
            <div className="text-lg font-semibold text-emerald-300 mb-2">Your Referral Code</div>
            <div className="text-3xl font-extrabold text-emerald-400 tracking-widest mb-2">{referralCode}</div>
            <div className="text-slate-200 text-sm">Friends can use this code when they sign up</div>
          </div>
          {/* Navigation */}
          <div className="flex justify-between mt-6">
            <button
              type="button"
              onClick={onBack}
              className="px-5 py-2 rounded-lg bg-slate-700 text-white font-medium hover:bg-slate-600"
            >
              Back
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="px-8 py-2 rounded-lg bg-gradient-to-r from-emerald-500 to-cyan-400 text-white font-semibold hover:from-emerald-600 hover:to-cyan-500 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isSubmitting ? "Processing..." : "Continue to Results"}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
} 