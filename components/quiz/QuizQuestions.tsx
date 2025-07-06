"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Clock, Trophy, Target } from "lucide-react"

interface QuizQuestion {
  id: string
  question: string
  options: string[]
  correctAnswer: string
  points: number
  category: string
}

interface QuizUser {
  id: string
  name: string
  email: string
  phone: string
  bettingExperience: string
  score: number
  referralCode: string
  referredBy?: string
  referralCount: number
  totalCredits: number
  completedAt?: Date
}

interface QuizQuestionsProps {
  questions: QuizQuestion[]
  currentQuestionIndex: number
  onAnswerSubmit: (answerIndex: number) => void
  totalScore: number
  user: QuizUser
  onTimeUp: () => void // New prop to handle quiz ending
}

export function QuizQuestions({
  questions,
  currentQuestionIndex,
  onAnswerSubmit,
  totalScore,
  user,
  onTimeUp,
}: QuizQuestionsProps) {
  // Move all hooks to the top before any conditional returns
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null)
  const [timeLeft, setTimeLeft] = useState(30) // 30 seconds for entire quiz
  const [showFeedback, setShowFeedback] = useState(false)

  // Timer effect for entire quiz
  useEffect(() => {
    if (showFeedback) return // Don't count down during feedback

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          // Time's up - end the entire quiz immediately
          clearInterval(timer)
          setShowFeedback(true)
          setTimeout(() => {
            // Submit current answer (if any) and end quiz
            const finalAnswerIndex = selectedAnswer !== null ? selectedAnswer : -1
            onAnswerSubmit(finalAnswerIndex)
            onTimeUp() // Signal that quiz should end
          }, 1000)
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [showFeedback, onAnswerSubmit, onTimeUp, selectedAnswer])

  // Guard: If index is out of bounds, render nothing
  if (currentQuestionIndex < 0 || currentQuestionIndex >= questions.length) {
    return null;
  }

  const currentQuestion = questions[currentQuestionIndex]
  const progress = ((currentQuestionIndex + 1) / questions.length) * 100

  const handleAnswerSelect = (answerIndex: number) => {
    if (showFeedback) return
    setSelectedAnswer(answerIndex)
  }

  const handleSubmitAnswer = () => {
    if (selectedAnswer === null) return

    setShowFeedback(true)

    // Show feedback for 2 seconds then move to next question
    setTimeout(() => {
      onAnswerSubmit(selectedAnswer)
      setSelectedAnswer(null)
      setShowFeedback(false)
      // Don't reset timer - it continues for the entire quiz
    }, 2000)
  }

  const isCorrect = selectedAnswer !== null && currentQuestion.options[selectedAnswer] === currentQuestion.correctAnswer

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <Card className="w-full max-w-4xl bg-slate-800/50 border-slate-700">
        <CardHeader>
          <div className="flex items-center justify-between mb-4">
            <Badge className="bg-emerald-500/20 text-emerald-400">
              Question {currentQuestionIndex + 1} of {questions.length}
            </Badge>
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2 text-slate-300">
                <Trophy className="w-4 h-4" />
                <span className="font-semibold">{totalScore} pts</span>
              </div>
              <div className="flex items-center space-x-2 text-slate-300">
                <Clock className="w-4 h-4" />
                <span className={timeLeft <= 10 ? "text-red-400 font-bold" : ""}>{timeLeft}s</span>
              </div>
            </div>
          </div>

          <Progress value={progress} className="mb-6" />

          <div className="text-center space-y-2">
            <Badge variant="outline" className="border-slate-600 text-slate-300">
              {currentQuestion.category}
            </Badge>
            <CardTitle className="text-2xl text-white leading-relaxed">{currentQuestion.question}</CardTitle>
            <div className="flex items-center justify-center space-x-2 text-slate-400">
              <Target className="w-4 h-4" />
              <span>{currentQuestion.points} points</span>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          <div className="grid gap-4">
            {currentQuestion.options.map((option, index) => {
              let buttonClass = "bg-slate-700/50 border-slate-600 text-white hover:bg-slate-600/50 p-6 h-auto text-left"

              if (showFeedback) {
                if (option === currentQuestion.correctAnswer) {
                  buttonClass = "bg-emerald-500/20 border-emerald-500 text-emerald-400 p-6 h-auto text-left"
                } else if (index === selectedAnswer && selectedAnswer !== null && currentQuestion.options[selectedAnswer] !== currentQuestion.correctAnswer) {
                  buttonClass = "bg-red-500/20 border-red-500 text-red-400 p-6 h-auto text-left"
                }
              } else if (selectedAnswer === index) {
                buttonClass = "bg-emerald-500/20 border-emerald-500 text-emerald-400 p-6 h-auto text-left"
              }

              return (
                <Button
                  key={index}
                  variant="outline"
                  className={buttonClass}
                  onClick={() => handleAnswerSelect(index)}
                  disabled={showFeedback}
                >
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 rounded-full bg-slate-600 flex items-center justify-center text-sm font-semibold">
                      {String.fromCharCode(65 + index)}
                    </div>
                    <span className="text-lg">{option}</span>
                  </div>
                </Button>
              )
            })}
          </div>

          {showFeedback && (
            <div className="text-center space-y-4">
              {isCorrect ? (
                <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-4">
                  <p className="text-emerald-400 font-semibold text-lg">🎉 Correct!</p>
                  <p className="text-emerald-300">You earned {currentQuestion.points} points!</p>
                </div>
              ) : (
                <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
                  <p className="text-red-400 font-semibold text-lg">❌ Incorrect</p>
                  <p className="text-red-300">
                    The correct answer was: {currentQuestion.correctAnswer}
                  </p>
                </div>
              )}
            </div>
          )}

          {!showFeedback && (
            <div className="text-center">
              <Button
                onClick={handleSubmitAnswer}
                disabled={selectedAnswer === null}
                className="bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-600 hover:to-cyan-600 text-white px-8 py-3"
              >
                Submit Answer
              </Button>
            </div>
          )}

          <div className="text-center text-slate-400 text-sm">Hi {user.name}! Keep going - you&apos;re doing great! 🚀</div>
        </CardContent>
      </Card>
    </div>
  )
} 