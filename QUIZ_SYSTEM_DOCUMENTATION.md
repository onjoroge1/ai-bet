# 🎯 SnapBet Quiz System - Comprehensive Documentation

## 📋 **Table of Contents**

1. [System Overview](#system-overview)
2. [Architecture & Components](#architecture--components)
3. [Database Schema](#database-schema)
4. [API Endpoints](#api-endpoints)
5. [Frontend Implementation](#frontend-implementation)
6. [Quiz Flow & User Experience](#quiz-flow--user-experience)
7. [Scoring & Rewards](#scoring--rewards)
8. [Timer & Auto-Advance](#timer--auto-advance)
9. [Styling & UI Components](#styling--ui-components)
10. [Configuration & Customization](#configuration--customization)
11. [Testing & Debugging](#testing--debugging)
12. [Deployment & Maintenance](#deployment--maintenance)

---

## 🏗️ **System Overview**

The SnapBet Quiz System is a comprehensive, interactive sports knowledge assessment platform designed to engage users while providing educational value about sports betting and prediction analytics.

### **Key Features**
- ✅ **5-Question Format** - Quick, engaging quiz experience
- ✅ **30-Second Timer** - Creates urgency and engagement
- ✅ **Real-Time Grading** - Immediate feedback on answers
- ✅ **Auto-Advance** - Seamless question progression
- ✅ **Credit Rewards** - Earn prediction credits for performance
- ✅ **Responsive Design** - Works on all devices
- ✅ **Sports Theme** - Soccer player SVG backgrounds
- ✅ **Referral Integration** - Bonus rewards for referrals

### **Target Audience**
- Sports enthusiasts
- Betting beginners
- Platform users seeking credits
- Referral program participants

---

## 🏛️ **Architecture & Components**

### **Technology Stack**
```
Frontend: Next.js 14 + React 18 + TypeScript
Styling: Tailwind CSS + Framer Motion
Backend: Next.js API Routes + Prisma ORM
Database: PostgreSQL
Authentication: NextAuth.js
State Management: React Hooks + Context
```

### **Component Structure**
```
app/snapbet-quiz/
├── page.tsx                 # Main quiz component
├── components/
│   ├── quiz-section.tsx     # Homepage quiz promotion
│   └── ui/                  # Reusable UI components
├── api/quiz/
│   └── route.ts            # Quiz API endpoints
└── prisma/
    └── seed-quiz.ts        # Quiz questions seeding
```

---

## 🗄️ **Database Schema**

### **Core Models**

#### **QuizSession**
```prisma
model QuizSession {
  id                    String   @id @default(cuid())
  userId                String?  // For logged-in users
  email                 String?  // For non-logged-in users
  fullName              String?
  phone                 String?
  status                String   @default("in_progress")
  startTime             DateTime @default(now())
  endTime               DateTime?
  currentQuestionIndex  Int      @default(0)
  totalScore            Int      @default(0)
  answers               Json[]   // Array of answer objects
  referralCode          String?
  referralId            String?
  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt
}
```

#### **QuizQuestion**
```prisma
model QuizQuestion {
  id            String       @id @default(cuid())
  question      String       // The question text
  correctAnswer String       // Correct answer
  options       String[]     // Array of answer choices
  category      String       // Question category
  difficulty    String       @default("medium")
  points        Int          @default(10)
  isActive      Boolean      @default(true)
  weekNumber    Int?         // For weekly rotations
  createdAt     DateTime     @default(now())
}
```

#### **QuizParticipation**
```prisma
model QuizParticipation {
  id                String   @id @default(cuid())
  userId            String?  // For logged-in users
  email             String
  fullName          String?
  bettingExperience String   @default("beginner")
  totalScore        Int
  questionsAnswered Int
  correctAnswers    Int
  isCompleted       Boolean  @default(false)
  referralCode      String?
  participatedAt    DateTime @default(now())
}
```

---

## 🔌 **API Endpoints**

### **POST /api/quiz**

#### **Start Quiz**
```typescript
// Request
{
  "action": "startQuiz",
  "referralCode": "string?",
  "email": "string?",
  "fullName": "string?",
  "phone": "string?"
}

// Response
{
  "success": true,
  "data": {
    "quizSessionId": "string",
    "questions": [
      {
        "id": "string",
        "question": "string",
        "options": ["string"],
        "correctAnswer": "string",
        "points": 10
      }
    ],
    "skipIntro": boolean,
    "referralId": "string?",
    "referrerName": "string?"
  }
}
```

#### **Submit Quiz**
```typescript
// Request
{
  "action": "submitQuiz",
  "quizSessionId": "string",
  "answers": [
    {
      "questionId": "string",
      "selectedAnswer": "string",
      "question": {
        "id": "string",
        "correctAnswer": "string",
        "points": 10
      }
    }
  ],
  "totalTime": "number"
}

// Response
{
  "success": true,
  "data": {
    "totalScore": 50,
    "correctAnswers": 5,
    "totalQuestions": 5,
    "message": "Quiz completed successfully"
  }
}
```

### **GET /api/quiz**
```typescript
// Response
{
  "success": true,
  "data": {
    "questions": [...],
    "skipIntro": true
  }
}
```

---

## 🎨 **Frontend Implementation**

### **Main Quiz Component Structure**

```typescript
function QuizContent() {
  // State Management
  const [currentStep, setCurrentStep] = useState(0)
  const [quizSession, setQuizSession] = useState<QuizSession | null>(null)
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, string>>({})
  const [timeLeft, setTimeLeft] = useState(30)
  const [timerActive, setTimerActive] = useState(false)

  // Quiz Flow Steps
  // Step 0: Intro page
  // Step 1: User info collection (non-logged-in users)
  // Step 2: Quiz questions
  // Step 3: Results page
}
```

### **State Management**
- **currentStep**: Controls which page is displayed
- **quizSession**: Stores quiz data and questions
- **selectedAnswers**: Tracks user's answer selections
- **timeLeft**: Countdown timer for questions
- **timerActive**: Controls timer state

---

## 🔄 **Quiz Flow & User Experience**

### **User Journey**

#### **Logged-In Users**
1. **Auto-start**: Quiz automatically begins when page loads
2. **Skip intro**: Directly to questions (step 2)
3. **Answer questions**: 30-second timer per question
4. **Auto-advance**: Next question after 1 second
5. **Results**: Score display and next steps

#### **Non-Logged-In Users**
1. **Intro page**: Welcome message and start button
2. **User info**: Collect email, name, phone
3. **Quiz questions**: Same experience as logged-in users
4. **Results**: Score display with sign-up prompts

### **Question Flow**
```
Question 1 → Answer Selection → 1s Delay → Question 2
    ↓              ↓              ↓           ↓
Timer starts   Feedback shown   Auto-advance  Timer resets
```

---

## ⏱️ **Timer & Auto-Advance**

### **Timer Implementation**
```typescript
// Timer effect for quiz questions
useEffect(() => {
  let interval: NodeJS.Timeout | null = null
  
  if (timerActive && timeLeft > 0 && currentStep === 2) {
    interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          submitQuiz() // Auto-submit when time runs out
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
```

### **Auto-Advance Logic**
```typescript
const handleAnswerSelect = (questionId: string, answer: string) => {
  // Prevent changing answers once selected
  if (selectedAnswers[questionId]) return
  
  setSelectedAnswers(prev => ({
    ...prev,
    [questionId]: answer
  }))
  
  // Auto-advance to next question after 1 second
  setTimeout(() => {
    if (currentQuestionIndex < 4) {
      setCurrentQuestionIndex(prev => prev + 1)
    } else {
      submitQuiz() // Last question - submit quiz
    }
  }, 1000)
}
```

---

## 🏆 **Scoring & Rewards**

### **Scoring System**
- **Points per question**: 10 points
- **Total possible score**: 50 points
- **Percentage calculation**: `(totalScore / 50) * 100`

### **Credit Rewards**
```typescript
// Credit calculation based on performance
const creditRewards = {
  "5/5 correct": "50 credits",
  "4/5 correct": "25 credits", 
  "3/5 correct": "10 credits",
  "2/5 or less": "5 credits"
}
```

### **Performance Feedback**
```typescript
const getPerformanceMessage = (score: number) => {
  if (score >= 80) return "Excellent! You really know your sports!"
  if (score >= 60) return "Good job! You have solid sports knowledge!"
  return "Keep learning! Sports knowledge takes time to build!"
}
```

---

## 🎨 **Styling & UI Components**

### **Design System**
- **Color Scheme**: Slate-based with emerald/cyan accents
- **Typography**: Clear hierarchy with proper contrast
- **Spacing**: Consistent 4px grid system
- **Animations**: Framer Motion for smooth transitions

### **Background SVG**
```typescript
// Soccer player silhouette background
<div className="absolute inset-0 opacity-5 pointer-events-none">
  <svg viewBox="0 0 400 400" className="w-full h-full">
    <g fill="currentColor" className="text-slate-400">
      {/* Head, body, arms, legs, soccer ball */}
    </g>
  </svg>
</div>
```

### **Responsive Design**
- **Mobile-first**: Optimized for small screens
- **Breakpoints**: Tailwind CSS responsive classes
- **Touch-friendly**: Large buttons and proper spacing
- **Cross-device**: Consistent experience across platforms

---

## ⚙️ **Configuration & Customization**

### **Environment Variables**
```env
# Database
DATABASE_URL="postgresql://..."

# Authentication
NEXTAUTH_SECRET="your-secret"
NEXTAUTH_URL="http://localhost:3000"

# Quiz Settings
QUIZ_TIMER_SECONDS=30
QUIZ_QUESTIONS_COUNT=5
QUIZ_POINTS_PER_QUESTION=10
```

### **Quiz Questions Configuration**
```typescript
// prisma/seed-quiz.ts
const quizQuestions = [
  {
    question: "What does a 'confidence score' of 85% mean?",
    correctAnswer: "The AI is 85% confident this prediction will be correct",
    options: [...],
    category: "Prediction Analytics",
    difficulty: "medium",
    points: 10
  }
  // ... more questions
]
```

### **Customization Options**
- **Timer duration**: Adjustable per question
- **Question count**: Configurable number of questions
- **Scoring system**: Customizable point values
- **Categories**: Add/remove question categories
- **Difficulty levels**: Easy, medium, hard questions

---

## 🧪 **Testing & Debugging**

### **Debug Logging**
```typescript
// Frontend debugging
console.log('Quiz session state changed:', quizSession)
console.log('Submitting quiz with data:', { action, quizSessionId, answers })

// API debugging
console.log('startQuiz called with:', { isLoggedIn, data, sessionUserId })
console.log('submitQuiz received data:', { quizSessionId, answersType, answersLength })
```

### **Error Handling**
```typescript
try {
  const response = await fetch('/api/quiz', { ... })
  if (!response.ok) {
    const errorData = await response.json()
    throw new Error(errorData.error || 'Failed to submit quiz')
  }
} catch (error) {
  console.error('Quiz submission error:', error)
  setError(error instanceof Error ? error.message : 'Failed to submit quiz')
}
```

### **Common Issues & Solutions**

#### **Quiz Session ID Missing**
- **Issue**: `quizSessionId` is undefined in API
- **Solution**: Check quiz session construction in frontend
- **Debug**: Verify API response structure

#### **Timer Not Working**
- **Issue**: Timer doesn't count down
- **Solution**: Check `timerActive` state and useEffect dependencies
- **Debug**: Verify currentStep === 2 condition

#### **Auto-Advance Not Working**
- **Issue**: Questions don't advance automatically
- **Solution**: Check `handleAnswerSelect` function and setTimeout
- **Debug**: Verify `currentQuestionIndex` state updates

---

## 🚀 **Deployment & Maintenance**

### **Deployment Checklist**
- [ ] Database migrations applied
- [ ] Quiz questions seeded
- [ ] Environment variables configured
- [ ] API endpoints tested
- [ ] Frontend components built
- [ ] Performance monitoring enabled

### **Database Maintenance**
```sql
-- Clean up old quiz sessions
DELETE FROM "QuizSession" 
WHERE "createdAt" < NOW() - INTERVAL '30 days';

-- Archive completed participations
INSERT INTO "QuizParticipationArchive" 
SELECT * FROM "QuizParticipation" 
WHERE "isCompleted" = true AND "participatedAt" < NOW() - INTERVAL '90 days';
```

### **Performance Optimization**
- **Caching**: Redis for frequently accessed data
- **Database**: Indexes on quiz session and participation tables
- **API**: Rate limiting for quiz submissions
- **Frontend**: Lazy loading and code splitting

### **Monitoring & Analytics**
```typescript
// Track quiz performance metrics
const quizMetrics = {
  completionRate: completedQuizzes / startedQuizzes,
  averageScore: totalScores / completedQuizzes,
  averageTime: totalTime / completedQuizzes,
  popularCategories: mostAnsweredCategories
}
```

---

## 📚 **Additional Resources**

### **Related Documentation**
- [Email System Implementation](./EMAIL_SYSTEM_IMPLEMENTATION_SUMMARY.md)
- [Referral System Roadmap](./REFERRAL_SYSTEM_ROADMAP.md)
- [Payment System Status](./PAYMENT_SYSTEM_STATUS.md)

### **API Reference**
- [Quiz API Routes](./app/api/quiz/route.ts)
- [Database Schema](./prisma/schema.prisma)
- [Component Library](./components/)

### **Development Tools**
- **Prisma Studio**: Database management interface
- **Next.js DevTools**: Development debugging
- **React DevTools**: Component inspection
- **Network Tab**: API request monitoring

---

## 🎯 **Conclusion**

The SnapBet Quiz System provides a robust, engaging platform for user interaction and education. With its 30-second timer, auto-advance functionality, and comprehensive scoring system, it creates an exciting user experience while maintaining technical excellence.

### **Key Benefits**
- **User Engagement**: Quick, timed format keeps users interested
- **Educational Value**: Teaches sports betting concepts
- **Credit Rewards**: Incentivizes participation and learning
- **Technical Quality**: Robust error handling and performance
- **Scalability**: Easy to add questions and customize

### **Future Enhancements**
- **Question Categories**: Sports-specific question sets
- **Difficulty Levels**: Adaptive difficulty based on performance
- **Leaderboards**: Competitive element with rankings
- **Achievements**: Badges and milestones for users
- **Social Features**: Share results and challenge friends

---

**Last Updated**: August 11, 2025  
**Version**: 1.0.0  
**Maintainer**: Development Team  
**Status**: Production Ready ✅ 