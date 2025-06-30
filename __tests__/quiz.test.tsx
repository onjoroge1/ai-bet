import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import QuizExperience from '@/components/quiz/QuizExperience'
import { QuizQuestions } from '@/components/quiz/QuizQuestions'

// Mock the quiz questions data
const mockQuestions = [
  {
    id: "q1",
    question: "Who won the 2022 FIFA World Cup?",
    options: ["France", "Argentina", "Brazil", "Germany"],
    correctAnswer: "Argentina",
    points: 10,
    category: "World Cup",
  }
]

const mockUser = {
  id: "1",
  name: "Test User",
  email: "test@example.com",
  phone: "+1234567890",
  bettingExperience: "regular",
  score: 0,
  referralCode: "",
  referralCount: 0,
  totalCredits: 0,
}

describe('Quiz Components', () => {
  describe('QuizExperience', () => {
    it('renders experience options', () => {
      const mockOnNext = jest.fn()
      const mockOnBack = jest.fn()
      
      render(<QuizExperience onNext={mockOnNext} onBack={mockOnBack} />)
      
      expect(screen.getByText('Quick Question')).toBeInTheDocument()
      expect(screen.getByText('Have you ever placed a sports bet before?')).toBeInTheDocument()
      expect(screen.getByText('Yes, I bet regularly')).toBeInTheDocument()
      expect(screen.getByText('No, just here for the quiz')).toBeInTheDocument()
    })

    it('handles option selection and submission', async () => {
      const mockOnNext = jest.fn()
      const mockOnBack = jest.fn()
      
      render(<QuizExperience onNext={mockOnNext} onBack={mockOnBack} />)
      
      // Select an option
      fireEvent.click(screen.getByText('Yes, I bet regularly'))
      
      // Submit
      fireEvent.click(screen.getByText('Next'))
      
      await waitFor(() => {
        expect(mockOnNext).toHaveBeenCalledWith('regular')
      })
    })

    it('shows error when no option is selected', async () => {
      const mockOnNext = jest.fn()
      const mockOnBack = jest.fn()
      
      render(<QuizExperience onNext={mockOnNext} onBack={mockOnBack} />)
      
      // Try to submit without selection
      fireEvent.click(screen.getByText('Next'))
      
      await waitFor(() => {
        expect(screen.getByText('Please select an option.')).toBeInTheDocument()
      })
      
      expect(mockOnNext).not.toHaveBeenCalled()
    })
  })

  describe('QuizQuestions', () => {
    it('renders question and options', () => {
      const mockOnAnswerSubmit = jest.fn()
      
      render(
        <QuizQuestions
          questions={mockQuestions}
          currentQuestionIndex={0}
          onAnswerSubmit={mockOnAnswerSubmit}
          totalScore={0}
          user={mockUser}
        />
      )
      
      expect(screen.getByText('Question 1 of 1')).toBeInTheDocument()
      expect(screen.getByText('Who won the 2022 FIFA World Cup?')).toBeInTheDocument()
      expect(screen.getByText('France')).toBeInTheDocument()
      expect(screen.getByText('Argentina')).toBeInTheDocument()
      expect(screen.getByText('Brazil')).toBeInTheDocument()
      expect(screen.getByText('Germany')).toBeInTheDocument()
    })

    it('handles answer selection', () => {
      const mockOnAnswerSubmit = jest.fn()
      
      render(
        <QuizQuestions
          questions={mockQuestions}
          currentQuestionIndex={0}
          onAnswerSubmit={mockOnAnswerSubmit}
          totalScore={0}
          user={mockUser}
        />
      )
      
      // Select an answer
      fireEvent.click(screen.getByText('Argentina'))
      
      // Submit button should be enabled
      expect(screen.getByText('Submit Answer')).not.toBeDisabled()
    })

    it('shows feedback after submitting answer', async () => {
      const mockOnAnswerSubmit = jest.fn()
      
      render(
        <QuizQuestions
          questions={mockQuestions}
          currentQuestionIndex={0}
          onAnswerSubmit={mockOnAnswerSubmit}
          totalScore={0}
          user={mockUser}
        />
      )
      
      // Select correct answer
      fireEvent.click(screen.getByText('Argentina'))
      fireEvent.click(screen.getByText('Submit Answer'))
      
      await waitFor(() => {
        expect(screen.getByText('🎉 Correct!')).toBeInTheDocument()
        expect(screen.getByText('You earned 10 points!')).toBeInTheDocument()
      })
    })
  })
}) 