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
  message?: string
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
  const [timeLeft, setTimeLeft] = useState(30) // 30 second timer
  const [timerActive, setTimerActive] = useState(false)

  // Get referral code from URL
  const referralCode = searchParams.get('ref')

  // Debug: Monitor quizSession state changes
  useEffect(() => {
    console.log('Quiz session state changed:', quizSession)
    if (quizSession) {
      console.log('Quiz session ID:', quizSession.id)
      console.log('Quiz session questions count:', quizSession.questions?.length)
    }
  }, [quizSession])

  useEffect(() => {
    // If user is logged in and has a quiz session, skip to quiz
    if (status === 'authenticated' && quizSession?.skipIntro) {
      setCurrentStep(2) // Skip to quiz questions
    }
  }, [status, quizSession])

  // Auto-start quiz for logged-in users
  useEffect(() => {
    if (status === 'authenticated' && !quizSession && currentStep === 0) {
      console.log('Auto-starting quiz for logged-in user')
      startQuiz() // Start quiz without user data for logged-in users
    }
  }, [status, currentStep, quizSession])

  // Timer effect for quiz questions
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null
    
    if (timerActive && timeLeft > 0 && currentStep === 2) {
      interval = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            // Time's up - auto-submit quiz
            submitQuiz()
            return 0
          }
          return prev - 1
        })
      }, 1000)
    }
    
    return () => {
      if (interval) clearInterval(interval)
    }
  }, [timerActive, timeLeft, currentStep])

  // Start timer when quiz begins
  useEffect(() => {
    if (currentStep === 2 && quizSession) {
      setTimerActive(true)
      setTimeLeft(30)
    } else {
      setTimerActive(false)
    }
  }, [currentStep, quizSession])

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
      console.log('Quiz start response:', data)
      
      // Construct the quiz session object with the correct structure
      const quizSessionData = {
        id: data.data.quizSessionId, // This is the key field we need
        questions: data.data.questions,
        skipIntro: data.data.skipIntro,
        referralId: data.data.referralId,
        referrerName: data.data.referrerName
      }
      
      console.log('Constructed quiz session:', quizSessionData)
      console.log('Quiz session ID:', quizSessionData.id)
      
      // Verify we have the required data
      if (!quizSessionData.id) {
        throw new Error('Quiz session ID not received from server')
      }
      
      setQuizSession(quizSessionData)
      
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
    if (!quizSession) {
      console.error('No quiz session available')
      setError('No quiz session available')
      return
    }

    console.log('Current quiz session state:', quizSession)
    console.log('Quiz session ID:', quizSession.id)

    try {
      setLoading(true)
      setError(null)

      // Format answers properly for the API
      const answers = Object.entries(selectedAnswers).map(([questionId, selectedAnswer]) => {
        const question = quizSession.questions.find(q => q.id === questionId)
        if (!question) {
          throw new Error(`Question not found: ${questionId}`)
        }
        return {
          questionId,
          selectedAnswer,
          question: {
            id: question.id,
            correctAnswer: question.correctAnswer,
            points: question.points
          }
        }
      })

      // Ensure we have exactly 5 answers
      if (answers.length !== 5) {
        throw new Error(`Expected 5 answers, got ${answers.length}`)
      }

      // Debug logging
      console.log('Submitting quiz with data:', {
        action: 'submitQuiz',
        quizSessionId: quizSession.id,
        answersCount: answers.length,
        answers: answers
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
        console.error('Quiz submission failed:', errorData)
        throw new Error(errorData.error || 'Failed to submit quiz')
      }

      const data = await response.json()
      console.log('Quiz submission successful:', data)
      
      // Calculate percentage score (each question is worth 20 points, so total is 100)
      const percentageScore = Math.round((data.data.totalScore / 100) * 100)
      setTotalScore(percentageScore)
      setQuizCompleted(true)
      setCurrentStep(3)
    } catch (error) {
      console.error('Quiz submission error:', error)
      setError(error instanceof Error ? error.message : 'Failed to submit quiz')
    } finally {
      setLoading(false)
    }
  }

  const handleAnswerSelect = (questionId: string, answer: string) => {
    // Prevent changing answers once selected
    if (selectedAnswers[questionId]) return
    
    setSelectedAnswers(prev => ({
      ...prev,
      [questionId]: answer
    }))
    
    // Auto-advance to next question after a short delay
    setTimeout(() => {
      if (currentQuestionIndex < 4) {
        setCurrentQuestionIndex(prev => prev + 1)
      } else {
        // Last question - submit quiz
        submitQuiz()
      }
    }, 1000) // 1 second delay to show the answer feedback
  }

  const resetQuiz = () => {
    setCurrentStep(0)
    setQuizSession(null)
    setCurrentQuestionIndex(0)
    setSelectedAnswers({})
    setQuizCompleted(false)
    setTotalScore(0)
    setError(null)
    setTimeLeft(30)
    setTimerActive(false)
  }

  const nextQuestion = () => {
    if (currentQuestionIndex < 4) {
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
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4 relative overflow-hidden">
        {/* Background SVG Silhouette */}
        <div className="absolute inset-0 opacity-5 pointer-events-none">
          <svg viewBox="0 0 400 400" className="w-full h-full">
            {/* Soccer Player Silhouette */}
            <g fill="currentColor" className="text-slate-400">
              {/* Head */}
              <circle cx="200" cy="80" r="15"/>
              {/* Body */}
              <rect x="190" y="95" width="20" height="40" rx="10"/>
              {/* Arms */}
              <rect x="170" y="100" width="8" height="25" rx="4" transform="rotate(-20 170 100)"/>
              <rect x="222" y="105" width="8" height="25" rx="4" transform="rotate(15 222 105)"/>
              {/* Legs */}
              <rect x="185" y="135" width="8" height="35" rx="4" transform="rotate(-15 185 135)"/>
              <rect x="207" y="135" width="8" height="35" rx="4" transform="rotate(25 207 135)"/>
              {/* Soccer Ball */}
              <circle cx="280" cy="200" r="12" fill="none" stroke="currentColor" strokeWidth="2"/>
              <path d="M 275 195 L 285 205 M 275 205 L 285 195" stroke="currentColor" strokeWidth="1"/>
            </g>
          </svg>
        </div>
        
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 border-slate-700 backdrop-blur-sm rounded-2xl shadow-2xl p-8 max-w-md w-full text-center border relative z-10"
        >
          <div className="mb-6">
            <Trophy className="w-16 h-16 text-emerald-400 mx-auto mb-4" />
            <h1 className="text-3xl font-bold text-white mb-2">SnapBet Quiz</h1>
            {status === 'authenticated' ? (
              <>
                <p className="text-slate-300">Welcome back! Starting your quiz...</p>
                <div className="mt-4">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-400 mx-auto"></div>
                </div>
              </>
            ) : (
              <>
                <p className="text-slate-300">Test your sports knowledge in just 5 questions!</p>
                <p className="text-sm text-slate-400 mt-2">30 seconds per question - quick and engaging!</p>
              </>
            )}
          </div>

          {status !== 'authenticated' && referralCode && (
            <div className="mb-6 p-4 bg-emerald-900/30 rounded-lg border border-emerald-700/50">
              <Gift className="w-6 h-6 text-emerald-400 mx-auto mb-2" />
              <p className="text-sm text-emerald-300">
                You were invited with referral code: <span className="font-semibold">{referralCode}</span>
              </p>
            </div>
          )}

          {status !== 'authenticated' && (
            <button
              onClick={() => setCurrentStep(1)}
              className="w-full bg-gradient-to-r from-emerald-600 to-cyan-600 text-white font-semibold py-3 px-6 rounded-lg hover:from-emerald-700 hover:to-cyan-700 transition-all duration-200 transform hover:scale-105"
            >
              Start Quiz
            </button>
          )}
        </motion.div>
      </div>
    )
  }

  // User info collection page
  if (currentStep === 1) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4 relative overflow-hidden">
        {/* Background SVG Silhouette */}
        <div className="absolute inset-0 opacity-5 pointer-events-none">
          <svg viewBox="0 0 400 400" className="w-full h-full">
            <g fill="currentColor" className="text-slate-400">
              <circle cx="200" cy="80" r="15"/>
              <rect x="190" y="95" width="20" height="40" rx="10"/>
              <rect x="170" y="100" width="8" height="25" rx="4" transform="rotate(-20 170 100)"/>
              <rect x="222" y="105" width="8" height="25" rx="4" transform="rotate(15 222 105)"/>
              <rect x="185" y="135" width="8" height="35" rx="4" transform="rotate(-15 185 135)"/>
              <rect x="207" y="135" width="8" height="35" rx="4" transform="rotate(25 207 135)"/>
              <circle cx="280" cy="200" r="12" fill="none" stroke="currentColor" strokeWidth="2"/>
              <path d="M 275 195 L 285 205 M 275 205 L 285 195" stroke="currentColor" strokeWidth="1"/>
            </g>
          </svg>
        </div>
        
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 border-slate-700 backdrop-blur-sm rounded-2xl shadow-2xl p-8 max-w-md w-full border relative z-10"
        >
          <div className="text-center mb-6">
            <Users className="w-16 h-16 text-emerald-400 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-white mb-2">Enter Your Details</h2>
            <p className="text-slate-300">We'll use this to track your quiz results</p>
            <p className="text-sm text-slate-400 mt-2">Only 5 questions - 30 seconds each!</p>
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
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Email *
                </label>
                <input
                  type="email"
                  name="email"
                  required
                  className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-white placeholder-slate-400"
                  placeholder="your@email.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  name="fullName"
                  className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-white placeholder-slate-400"
                  placeholder="Your Full Name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Phone Number
                </label>
                <input
                  type="tel"
                  name="phone"
                  className="w-full px-3 py-2 bg-slate-700/50 border border-slate-600 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:border-transparent text-white placeholder-slate-400"
                  placeholder="+1234567890"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-gradient-to-r from-emerald-600 to-cyan-600 text-white font-semibold py-3 px-6 rounded-lg hover:from-emerald-700 hover:to-cyan-700 transition-all duration-200 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Starting Quiz...' : 'Continue to Quiz'}
              </button>
            </div>
          </form>

          <button
            onClick={() => setCurrentStep(0)}
            className="w-full mt-4 text-slate-400 hover:text-slate-200 transition-colors"
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
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4 relative overflow-hidden">
        {/* Background SVG Silhouette */}
        <div className="absolute inset-0 opacity-5 pointer-events-none">
          <svg viewBox="0 0 400 400" className="w-full h-full">
            <g fill="currentColor" className="text-slate-400">
              <circle cx="200" cy="80" r="15"/>
              <rect x="190" y="95" width="20" height="40" rx="10"/>
              <rect x="170" y="100" width="8" height="25" rx="4" transform="rotate(-20 170 100)"/>
              <rect x="222" y="105" width="8" height="25" rx="4" transform="rotate(15 222 105)"/>
              <rect x="185" y="135" width="8" height="35" rx="4" transform="rotate(-15 185 135)"/>
              <rect x="207" y="135" width="8" height="35" rx="4" transform="rotate(25 207 135)"/>
              <circle cx="280" cy="200" r="12" fill="none" stroke="currentColor" strokeWidth="2"/>
              <path d="M 275 195 L 285 205 M 275 205 L 285 195" stroke="currentColor" strokeWidth="1"/>
            </g>
          </svg>
        </div>
        
        <motion.div
          key={currentQuestionIndex}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 border-slate-700 backdrop-blur-sm rounded-2xl shadow-2xl p-8 max-w-2xl w-full border relative z-10"
        >
          {/* Timer */}
          <div className="mb-6 text-center">
            <div className="text-2xl font-bold text-emerald-400 mb-2">
              {timeLeft}s
            </div>
            <div className="w-full bg-slate-700 rounded-full h-3">
              <div
                className={`h-3 rounded-full transition-all duration-1000 ${
                  timeLeft > 20 ? 'bg-emerald-500' : timeLeft > 10 ? 'bg-yellow-500' : 'bg-red-500'
                }`}
                style={{ width: `${(timeLeft / 30) * 100}%` }}
              />
            </div>
          </div>

          {/* Progress bar */}
          <div className="mb-6">
            <div className="flex justify-between text-sm text-slate-400 mb-2">
              <span>Question {currentQuestionIndex + 1} of 5</span>
              <span>{Math.round(((currentQuestionIndex + 1) / 5) * 100)}%</span>
            </div>
            <div className="w-full bg-slate-700 rounded-full h-2">
              <div
                className="bg-gradient-to-r from-emerald-600 to-cyan-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${((currentQuestionIndex + 1) / 5) * 100}%` }}
              />
            </div>
          </div>

          {/* Question */}
          <div className="mb-8">
            <h2 className="text-xl font-semibold text-white mb-4">
              {currentQuestion.question}
            </h2>

            <div className="space-y-3">
              {currentQuestion.options.map((option, index) => {
                const isSelected = selectedAnswers[currentQuestion.id] === option
                const isCorrect = option === currentQuestion.correctAnswer
                const showFeedback = isSelected
                
                return (
                  <button
                    key={index}
                    onClick={() => handleAnswerSelect(currentQuestion.id, option)}
                    disabled={isSelected} // Disable button once selected
                    className={`w-full text-left p-4 rounded-lg border-2 transition-all duration-200 ${
                      isSelected
                        ? isCorrect
                          ? 'border-emerald-500 bg-emerald-900/30 text-emerald-100'
                          : 'border-red-500 bg-red-900/30 text-red-100'
                        : 'border-slate-600 hover:border-slate-500 bg-slate-700/50 text-slate-200'
                    } ${isSelected ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{option}</span>
                      {showFeedback && (
                        <div className="flex items-center space-x-2">
                          {isCorrect ? (
                            <CheckCircle className="w-5 h-5 text-emerald-400" />
                          ) : (
                            <XCircle className="w-5 h-5 text-red-400" />
                          )}
                          <span className="text-sm font-medium">
                            {isCorrect ? 'Correct!' : 'Incorrect'}
                          </span>
                        </div>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Auto-advance message */}
          <div className="text-center text-slate-400 text-sm">
            {selectedAnswers[currentQuestion.id] ? (
              <div className="flex items-center justify-center space-x-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-emerald-400"></div>
                <span>Moving to next question...</span>
              </div>
            ) : (
              <span>Select an answer to continue</span>
            )}
          </div>

          {error && (
            <div className="mt-4 p-3 bg-red-900/30 border border-red-700/50 rounded-lg text-red-300 text-sm">
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
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4 relative overflow-hidden">
        {/* Background SVG Silhouette */}
        <div className="absolute inset-0 opacity-5 pointer-events-none">
          <svg viewBox="0 0 400 400" className="w-full h-full">
            <g fill="currentColor" className="text-slate-400">
              <circle cx="200" cy="80" r="15"/>
              <rect x="190" y="95" width="20" height="40" rx="10"/>
              <rect x="170" y="100" width="8" height="25" rx="4" transform="rotate(-20 170 100)"/>
              <rect x="222" y="105" width="8" height="25" rx="4" transform="rotate(15 222 105)"/>
              <rect x="185" y="135" width="8" height="35" rx="4" transform="rotate(-15 185 135)"/>
              <rect x="207" y="135" width="8" height="35" rx="4" transform="rotate(25 207 135)"/>
              <circle cx="280" cy="200" r="12" fill="none" stroke="currentColor" strokeWidth="2"/>
              <path d="M 275 195 L 285 205 M 275 205 L 285 195" stroke="currentColor" strokeWidth="1"/>
            </g>
          </svg>
        </div>
        
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-gradient-to-br from-slate-800/50 to-slate-900/50 border-slate-700 backdrop-blur-sm rounded-2xl shadow-2xl p-8 max-w-md w-full text-center border relative z-10"
        >
          <div className="mb-6">
            {totalScore >= 70 ? (
              <CheckCircle className="w-16 h-16 text-emerald-400 mx-auto mb-4" />
            ) : (
              <XCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
            )}
            <h2 className="text-2xl font-bold text-white mb-2">
              {totalScore >= 70 ? 'Congratulations!' : 'Quiz Completed'}
            </h2>
            <p className="text-slate-300 mb-4">
              Your score: <span className="font-bold text-xl text-emerald-400">{totalScore}%</span> ({Math.round(totalScore / 20)}/5 correct)
            </p>
            <p className="text-sm text-slate-400">
              {totalScore >= 80 ? 'Excellent! You really know your sports!' :
               totalScore >= 60 ? 'Good job! You have solid sports knowledge!' :
               'Keep learning! Sports knowledge takes time to build!'}
            </p>
          </div>

          {quizSession?.referralId && (
            <div className="mb-6 p-4 bg-emerald-900/30 rounded-lg border border-emerald-700/50">
              <Gift className="w-6 h-6 text-emerald-400 mx-auto mb-2" />
              <p className="text-sm text-emerald-300">
                Referral bonus applied! You'll receive extra rewards.
              </p>
            </div>
          )}

          <div className="space-y-3">
            <button
              onClick={resetQuiz}
              className="w-full bg-gradient-to-r from-emerald-600 to-cyan-600 text-white font-semibold py-3 px-6 rounded-lg hover:from-emerald-700 hover:to-cyan-700 transition-all duration-200 transform hover:scale-105"
            >
              Try Again
            </button>

            {!session && (
              <button
                onClick={() => router.push('/signin')}
                className="w-full bg-slate-600 text-white font-semibold py-3 px-6 rounded-lg hover:bg-slate-700 transition-all duration-200"
              >
                Sign In to Save Progress
              </button>
            )}

            <button
              onClick={() => router.push('/')}
              className="w-full text-slate-400 hover:text-slate-200 transition-colors"
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