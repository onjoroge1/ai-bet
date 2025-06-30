"use client"

import { useState, useEffect } from "react"
import { QuizRegistration } from "@/components/quiz/QuizRegistration"
import QuizExperience from "@/components/quiz/QuizExperience"
import { QuizQuestions } from "@/components/quiz/QuizQuestions"
import QuizReferral from "@/components/quiz/QuizReferral"
import QuizResults from "@/components/quiz/QuizResults"
import { Users, Award, Target, Trophy } from "lucide-react"

interface RegistrationData {
  name: string
  email: string
  phone: string
  consent: boolean
}

interface QuizAnswer {
  questionId: string
  selectedAnswer: string
  isCorrect: boolean
  pointsEarned: number
}

interface ReferralInfo {
  referralCode?: string
  friendsInvited: string[]
  pointsEarned: number
}

interface QuizQuestion {
  id: string
  question: string
  options: string[]
  correctAnswer: string
  points: number
  category: string
}

export default function SnapBetQuizPage() {
  const [step, setStep] = useState(0)
  const [registration, setRegistration] = useState<RegistrationData | null>(null)
  const [experience, setExperience] = useState<string>("")
  const [answers, setAnswers] = useState<QuizAnswer[]>([])
  const [referral, setReferral] = useState<ReferralInfo | null>(null)
  const [questions, setQuestions] = useState<QuizQuestion[]>([])
  const [participationId, setParticipationId] = useState<string>("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Load questions from API
  useEffect(() => {
    const loadQuestions = async () => {
      try {
        setIsLoading(true)
        setError(null)
        const response = await fetch("/api/quiz?action=questions")
        if (!response.ok) {
          throw new Error("Failed to load questions")
        }
        const data = await response.json()
        if (data.questions) {
          setQuestions(data.questions)
        }
      } catch (error) {
        console.error("Failed to load questions:", error)
        setError("Failed to load quiz questions. Please refresh the page.")
      } finally {
        setIsLoading(false)
      }
    }
    loadQuestions()
  }, [])

  // Calculate score from answers
  const score = answers.reduce((acc, a) => acc + a.pointsEarned, 0)

  // Show loading state
  if (isLoading && questions.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-400 mx-auto mb-4"></div>
          <p className="text-white text-lg">Loading quiz questions...</p>
        </div>
      </div>
    )
  }

  // Show error state
  if (error && questions.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto p-6">
          <div className="text-red-400 text-4xl mb-4">⚠️</div>
          <h2 className="text-white text-xl font-semibold mb-2">Something went wrong</h2>
          <p className="text-slate-300 mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600"
          >
            Try Again
          </button>
        </div>
      </div>
    )
  }

  // Landing/Intro Step
  if (step === 0) {
    return (
      <div className="min-h-screen quiz-gradient-bg flex flex-col items-center justify-center px-4 py-8">
        <div className="mb-4 flex items-center justify-center">
          <span className="bg-emerald-900/80 text-emerald-300 px-4 py-1 rounded-full text-sm font-medium flex items-center gap-2 shadow quiz-glass animate-fadeIn">
            <Trophy className="w-4 h-4 text-amber-400" />
            Weekly Football Quiz Challenge
          </span>
        </div>
        <h1 className="text-5xl md:text-6xl font-extrabold text-center text-white mb-2 animate-fadeIn">
          SnapBet Football <span className="quiz-text-gradient">Quiz Challenge</span>
        </h1>
        <p className="text-lg md:text-xl text-slate-300 text-center mb-8 animate-fadeIn">
          Test your football knowledge, win free tips, and invite friends for bonus rewards!
        </p>
        <div className="flex flex-col md:flex-row items-center justify-center gap-8 mb-10 animate-fadeIn">
          <div className="flex flex-col items-center">
            <span className="text-2xl md:text-3xl font-bold text-emerald-400">2,500+</span>
            <span className="text-slate-300 text-sm">Players This Week</span>
          </div>
          <div className="flex flex-col items-center">
            <span className="text-2xl md:text-3xl font-bold text-cyan-300">₹50K</span>
            <span className="text-slate-300 text-sm">Total Prizes</span>
          </div>
          <div className="flex flex-col items-center">
            <span className="text-2xl md:text-3xl font-bold text-amber-300">10</span>
            <span className="text-slate-300 text-sm">Points Per Question</span>
          </div>
          <div className="flex flex-col items-center">
            <span className="text-2xl md:text-3xl font-bold text-purple-400">5</span>
            <span className="text-slate-300 text-sm">Questions</span>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-5xl mb-10 animate-fadeIn">
          <div className="quiz-glass rounded-xl p-6 flex flex-col items-center shadow-lg">
            <Target className="w-10 h-10 text-emerald-400 mb-2" />
            <span className="font-semibold text-white text-lg mb-1">Answer Questions</span>
            <span className="text-slate-300 text-center text-sm">5 football questions, 10 points each for correct answers</span>
          </div>
          <div className="quiz-glass rounded-xl p-6 flex flex-col items-center shadow-lg">
            <Users className="w-10 h-10 text-cyan-400 mb-2" />
            <span className="font-semibold text-white text-lg mb-1">Invite Friends</span>
            <span className="text-slate-300 text-center text-sm">Get 10 points per friend who completes the quiz</span>
          </div>
          <div className="quiz-glass rounded-xl p-6 flex flex-col items-center shadow-lg">
            <Award className="w-10 h-10 text-amber-400 mb-2" />
            <span className="font-semibold text-white text-lg mb-1">Win Prizes</span>
            <span className="text-slate-300 text-center text-sm">Top scorers get free tips and exclusive offers</span>
          </div>
        </div>
        <button
          className="mt-2 px-8 py-3 rounded-lg bg-gradient-to-r from-emerald-400 to-cyan-400 text-white font-bold text-lg shadow-lg hover:scale-105 transition-transform duration-200 focus:outline-none focus:ring-2 focus:ring-emerald-400 animate-fadeIn"
          onClick={() => setStep(1)}
        >
          <span className="flex items-center gap-2">
            <span className="text-xl">⚡</span> Start Quiz Challenge
          </span>
        </button>
      </div>
    )
  }

  // Registration Step
  if (step === 1) {
    return (
      <QuizRegistration
        onComplete={async (data) => {
          setRegistration({
            name: data.name,
            email: data.email,
            phone: data.phone,
            consent: true,
          })
          setStep(2)
        }}
        countryData={null}
      />
    )
  }

  // Experience Step
  if (step === 2) {
    return (
      <QuizExperience
        onNext={async (exp: string) => {
          setExperience(exp)
          
          // Start quiz in database
          if (registration) {
            setIsLoading(true)
            try {
              const response = await fetch("/api/quiz", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  action: "start",
                  email: registration.email,
                  phone: registration.phone,
                  fullName: registration.name,
                  bettingExperience: exp
                })
              })
              
              if (!response.ok) {
                const errorData = await response.json()
                if (response.status === 429) {
                  // Weekly limit reached
                  setError(`Weekly limit reached: ${errorData.error}`)
                  return
                }
                throw new Error("Failed to start quiz")
              }
              
              const data = await response.json()
              if (data.participationId) {
                setParticipationId(data.participationId)
              }
            } catch (error) {
              console.error("Failed to start quiz:", error)
              setError("Failed to start quiz. Please try again.")
            } finally {
              setIsLoading(false)
            }
          }
          
          setStep(3)
        }}
        onBack={() => setStep(1)}
      />
    )
  }

  // Quiz Questions Step
  if (step === 3) {
    return (
      <QuizQuestions
        questions={questions}
        currentQuestionIndex={answers.length}
        onAnswerSubmit={async (answerIndex: number) => {
          const q = questions[answers.length]
          const selectedAnswer = q.options[answerIndex]
          
          // Submit answer to API
          if (participationId) {
            try {
              const response = await fetch("/api/quiz", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  action: "submit-answer",
                  participationId,
                  questionId: q.id,
                  selectedAnswer
                })
              })
              
              if (!response.ok) {
                throw new Error("Failed to submit answer")
              }
              
              const data = await response.json()
              setAnswers([
                ...answers,
                {
                  questionId: q.id,
                  selectedAnswer,
                  isCorrect: data.isCorrect,
                  pointsEarned: data.pointsEarned,
                },
              ])
              
              if (answers.length + 1 === questions.length) {
                // Complete quiz
                try {
                  const completeResponse = await fetch("/api/quiz", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      action: "complete",
                      participationId
                    })
                  })
                  
                  if (!completeResponse.ok) {
                    console.error("Failed to complete quiz")
                  }
                } catch (error) {
                  console.error("Failed to complete quiz:", error)
                }
                
                setTimeout(() => setStep(4), 500)
              }
            } catch (error) {
              console.error("Failed to submit answer:", error)
              setError("Failed to submit answer. Please try again.")
            }
          }
        }}
        totalScore={score}
        user={{
          id: "1",
          name: registration?.name || "User",
          email: registration?.email || "",
          phone: registration?.phone || "",
          bettingExperience: experience,
          score,
          referralCode: "",
          referralCount: 0,
          totalCredits: 0,
        }}
      />
    )
  }

  // Referral Step
  if (step === 4) {
    return (
      <QuizReferral
        registrationData={registration}
        score={score}
        onNext={async (refInfo: ReferralInfo) => {
          setReferral(refInfo)
          
          // Process referrals in API
          if (participationId) {
            try {
              const response = await fetch("/api/quiz", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  action: "referral",
                  participationId,
                  friendsInvited: refInfo.friendsInvited,
                  referralCode: refInfo.referralCode || ""
                })
              })
              
              if (!response.ok) {
                console.error("Failed to process referrals")
              }
            } catch (error) {
              console.error("Failed to process referrals:", error)
            }
          }
          
          setStep(5)
        }}
        onBack={() => setStep(3)}
      />
    )
  }

  // Results Step
  if (step === 5) {
    // Calculate stats
    const totalQuestions = questions.length;
    const correctAnswers = answers.filter(a => a.isCorrect).length;
    const accuracy = totalQuestions > 0 ? Math.round((correctAnswers / totalQuestions) * 100) : 0;
    const totalCredits = (referral?.pointsEarned || 0);
    const stats = {
      totalPoints: score,
      correctAnswers,
      totalQuestions,
      accuracy,
      totalCredits,
    };
    // Performance (dummy values for local/international)
    const performance = {
      scorePercent: totalQuestions > 0 ? Math.round((score / (totalQuestions * 10)) * 100) : 0,
      local: "Strong",
      international: "Good",
    };
    // Rewards (dummy logic)
    const rewards = [
      { label: "Quiz Completion Bonus", credits: 50 },
      { label: "Performance Bonus", credits: Math.max(0, score - 50) },
    ];
    return (
      <QuizResults
        registrationData={registration}
        experience={experience}
        score={score}
        referralInfo={referral}
        onRestart={() => {
          setStep(0)
          setRegistration(null)
          setExperience("")
          setAnswers([])
          setReferral(null)
          setParticipationId("")
          setError(null)
        }}
        stats={stats}
        performance={performance}
        rewards={rewards}
        onImprove={() => window.open("/dashboard", "_blank")}
        onJoinWhatsApp={() => window.open("https://wa.me/1234567890?text=I%20want%20to%20join%20SnapBet%20community", "_blank")}
        onJoinTelegram={() => window.open("https://t.me/snapbetcommunity", "_blank")}
        userName={registration?.name || "User"}
      />
    )
  }

  return null
} 