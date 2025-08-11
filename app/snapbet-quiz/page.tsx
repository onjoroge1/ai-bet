'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSession } from 'next-auth/react'
import { useSearchParams, useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { CheckCircle, XCircle, ArrowRight, ArrowLeft, Trophy, Users, Gift } from 'lucide-react'

interface Question {
  id: string
  question: string
  options: string[]
  correctAnswer: string
  points: number
  order: number
}

interface QuizSession {
  id: string
  questions: Question[]
  skipIntro: boolean
  referralId?: string
  referrerName?: string
}

function QuizContent() {
  const { data: session, status } = useSession()
  const searchParams = useSearchParams()
  const router = useRouter()
  
  const [currentStep, setCurrentStep] = useState(0)
  const [quizSession, setQuizSession] = useState<QuizSession | null>(null)
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, string>>({})
  const [quizCompleted, setQuizCompleted] = useState(false)
  const [totalScore, setTotalScore] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Get referral code from URL
  const referralCode = searchParams.get('ref')

  useEffect(() => {
    // If user is logged in and has a quiz session, skip to quiz
    if (status === 'authenticated' && quizSession?.skipIntro) {
      setCurrentStep(2) // Skip to quiz questions
    }
  }, [status, quizSession])

  const startQuiz = async (userData?: { email: string; fullName?: string; phone?: string }) => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch('/api/quiz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'startQuiz',
          referralCode,
          ...userData
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to start quiz')
      }

      const data = await response.json()
      setQuizSession(data.data)
      
      // If user is logged in, skip intro pages
      if (data.data.skipIntro) {
        setCurrentStep(2)
      } else {
        setCurrentStep(1)
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to start quiz')
    } finally {
      setLoading(false)
    }
  }

  const submitQuiz = async () => {
    if (!quizSession) return

    try {
      setLoading(true)
      setError(null)

      const answers = Object.entries(selectedAnswers).map(([questionId, selectedAnswer]) => {
        const question = quizSession.questions.find(q => q.id === questionId)
        return {
          questionId,
          selectedAnswer,
          question
        }
      })

      const response = await fetch('/api/quiz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'submitQuiz',
          quizSessionId: quizSession.id,
          answers,
          totalTime: Date.now() - Date.now() // You can implement actual time tracking
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to submit quiz')
      }

      const data = await response.json()
      setTotalScore(data.data.totalScore)
      setQuizCompleted(true)
      setCurrentStep(3)
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Failed to submit quiz')
    } finally {
      setLoading(false)
    }
  }

  const handleAnswerSelect = (questionId: string, answer: string) => {
    setSelectedAnswers(prev => ({
      ...prev,
      [questionId]: answer
    }))
  }

  const resetQuiz = () => {
    setCurrentStep(0)
    setQuizSession(null)
    setCurrentQuestionIndex(0)
    setSelectedAnswers({})
    setQuizCompleted(false)
    setTotalScore(0)
    setError(null)
  }

  const nextQuestion = () => {
    if (currentQuestionIndex < quizSession!.questions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1)
    }
  }

  const previousQuestion = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(prev => prev - 1)
    }
  }

  const currentQuestion = quizSession?.questions[currentQuestionIndex]

  // Intro page for non-logged-in users
  if (currentStep === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-900 via-purple-900 to-indigo-900 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full text-center"
        >
          <div className="mb-6">
            <Trophy className="w-16 h-16 text-yellow-500 mx-auto mb-4" />
            <h1 className="text-3xl font-bold text-gray-800 mb-2">SnapBet Quiz</h1>
            <p className="text-gray-600">Test your sports knowledge and win rewards!</p>
          </div>

          {referralCode && (
            <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
              <Gift className="w-6 h-6 text-blue-500 mx-auto mb-2" />
              <p className="text-sm text-blue-700">
                You were invited with referral code: <span className="font-semibold">{referralCode}</span>
              </p>
            </div>
          )}

          <button
            onClick={() => setCurrentStep(1)}
            className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold py-3 px-6 rounded-lg hover:from-blue-700 hover:to-purple-700 transition-all duration-200 transform hover:scale-105"
          >
            Start Quiz
          </button>
        </motion.div>
      </div>
    )
  }

  // User info collection page
  if (currentStep === 1) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-900 via-purple-900 to-indigo-900 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full"
        >
          <div className="text-center mb-6">
            <Users className="w-16 h-16 text-blue-500 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-800 mb-2">Enter Your Details</h2>
            <p className="text-gray-600">We'll use this to track your quiz results</p>
          </div>

          <form onSubmit={(e) => {
            e.preventDefault()
            const formData = new FormData(e.currentTarget)
            startQuiz({
              email: formData.get('email') as string,
              fullName: formData.get('fullName') as string,
              phone: formData.get('phone') as string
            })
          }}>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email *
                </label>
                <input
                  type="email"
                  name="email"
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="your@email.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  name="fullName"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Your Full Name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Phone Number
                </label>
                <input
                  type="tel"
                  name="phone"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="+1234567890"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold py-3 px-6 rounded-lg hover:from-blue-700 hover:to-purple-700 transition-all duration-200 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Starting Quiz...' : 'Continue to Quiz'}
              </button>
            </div>
          </form>

          <button
            onClick={() => setCurrentStep(0)}
            className="w-full mt-4 text-gray-600 hover:text-gray-800 transition-colors"
          >
            ← Back
          </button>
        </motion.div>
      </div>
    )
  }

  // Quiz questions
  if (currentStep === 2 && quizSession && currentQuestion) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-900 via-purple-900 to-indigo-900 flex items-center justify-center p-4">
        <motion.div
          key={currentQuestionIndex}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          className="bg-white rounded-2xl shadow-2xl p-8 max-w-2xl w-full"
        >
          {/* Progress bar */}
          <div className="mb-6">
            <div className="flex justify-between text-sm text-gray-600 mb-2">
              <span>Question {currentQuestionIndex + 1} of {quizSession.questions.length}</span>
              <span>{Math.round(((currentQuestionIndex + 1) / quizSession.questions.length) * 100)}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-gradient-to-r from-blue-600 to-purple-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${((currentQuestionIndex + 1) / quizSession.questions.length) * 100}%` }}
              />
            </div>
          </div>

          {/* Question */}
          <div className="mb-8">
            <h2 className="text-xl font-semibold text-gray-800 mb-4">
              {currentQuestion.question}
            </h2>

            <div className="space-y-3">
              {currentQuestion.options.map((option, index) => (
                <button
                  key={index}
                  onClick={() => handleAnswerSelect(currentQuestion.id, option)}
                  className={`w-full text-left p-4 rounded-lg border-2 transition-all duration-200 ${
                    selectedAnswers[currentQuestion.id] === option
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <span className="font-medium text-gray-800">{option}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Navigation */}
          <div className="flex justify-between items-center">
            <button
              onClick={previousQuestion}
              disabled={currentQuestionIndex === 0}
              className="flex items-center px-4 py-2 text-gray-600 hover:text-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Previous
            </button>

            {currentQuestionIndex === quizSession.questions.length - 1 ? (
              <button
                onClick={submitQuiz}
                disabled={loading || Object.keys(selectedAnswers).length < quizSession.questions.length}
                className="bg-gradient-to-r from-green-600 to-blue-600 text-white font-semibold py-3 px-6 rounded-lg hover:from-green-700 hover:to-blue-700 transition-all duration-200 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Submitting...' : 'Submit Quiz'}
              </button>
            ) : (
              <button
                onClick={nextQuestion}
                disabled={!selectedAnswers[currentQuestion.id]}
                className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Next
                <ArrowRight className="w-4 h-4 ml-2" />
              </button>
            )}
          </div>

          {error && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}
        </motion.div>
      </div>
    )
  }

  // Results page
  if (currentStep === 3) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-900 via-purple-900 to-indigo-900 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full text-center"
        >
          <div className="mb-6">
            {totalScore >= 70 ? (
              <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
            ) : (
              <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
            )}
            <h2 className="text-2xl font-bold text-gray-800 mb-2">
              {totalScore >= 70 ? 'Congratulations!' : 'Quiz Completed'}
            </h2>
            <p className="text-gray-600 mb-4">
              Your total score: <span className="font-bold text-xl text-blue-600">{totalScore}</span>
            </p>
          </div>

          {quizSession?.referralId && (
            <div className="mb-6 p-4 bg-green-50 rounded-lg border border-green-200">
              <Gift className="w-6 h-6 text-green-500 mx-auto mb-2" />
              <p className="text-sm text-green-700">
                Referral bonus applied! You'll receive extra rewards.
              </p>
            </div>
          )}

          <div className="space-y-3">
            <button
              onClick={resetQuiz}
              className="w-full bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold py-3 px-6 rounded-lg hover:from-blue-700 hover:to-purple-700 transition-all duration-200 transform hover:scale-105"
            >
              Try Again
            </button>

            {!session && (
              <button
                onClick={() => router.push('/auth/signin')}
                className="w-full bg-gray-600 text-white font-semibold py-3 px-6 rounded-lg hover:bg-gray-700 transition-all duration-200"
              >
                Sign In to Save Progress
              </button>
            )}

            <button
              onClick={() => router.push('/')}
              className="w-full text-gray-600 hover:text-gray-800 transition-colors"
            >
              Back to Home
            </button>
          </div>
        </motion.div>
      </div>
    )
  }

  return null
}

export default function SnapbetQuiz() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <QuizContent />
    </Suspense>
  )
} 