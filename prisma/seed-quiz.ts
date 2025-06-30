import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

const quizQuestions = [
  {
    question: "Who won the 2022 FIFA World Cup?",
    correctAnswer: "Argentina",
    options: ["France", "Argentina", "Brazil", "Germany"],
    category: "World Cup",
    difficulty: "medium",
    points: 10
  },
  {
    question: "Which club has won the most UEFA Champions League titles?",
    correctAnswer: "Real Madrid",
    options: ["Barcelona", "Bayern Munich", "Real Madrid", "Liverpool"],
    category: "Champions League",
    difficulty: "medium",
    points: 10
  },
  {
    question: "Who is known as 'The Egyptian King'?",
    correctAnswer: "Salah",
    options: ["Salah", "Mahrez", "Elneny", "Trezeguet"],
    category: "Players",
    difficulty: "easy",
    points: 10
  },
  {
    question: "Which country hosts the Premier League?",
    correctAnswer: "England",
    options: ["Spain", "Italy", "England", "France"],
    category: "Leagues",
    difficulty: "easy",
    points: 10
  },
  {
    question: "Which team is nicknamed 'The Old Lady'?",
    correctAnswer: "Juventus",
    options: ["Juventus", "AC Milan", "Inter Milan", "Roma"],
    category: "Clubs",
    difficulty: "medium",
    points: 10
  },
  {
    question: "Who scored the winning goal in the 2022 World Cup final?",
    correctAnswer: "Lionel Messi",
    options: ["Kylian Mbappé", "Lionel Messi", "Ángel Di María", "Julián Álvarez"],
    category: "World Cup",
    difficulty: "medium",
    points: 10
  },
  {
    question: "Which player has won the most Ballon d'Or awards?",
    correctAnswer: "Lionel Messi",
    options: ["Cristiano Ronaldo", "Lionel Messi", "Pelé", "Diego Maradona"],
    category: "Awards",
    difficulty: "medium",
    points: 10
  },
  {
    question: "What year was the first FIFA World Cup held?",
    correctAnswer: "1930",
    options: ["1926", "1930", "1934", "1938"],
    category: "History",
    difficulty: "hard",
    points: 10
  },
  {
    question: "Which team won the 2023/24 Premier League?",
    correctAnswer: "Manchester City",
    options: ["Arsenal", "Manchester City", "Liverpool", "Manchester United"],
    category: "Premier League",
    difficulty: "easy",
    points: 10
  },
  {
    question: "Who is the all-time top scorer in the Champions League?",
    correctAnswer: "Cristiano Ronaldo",
    options: ["Lionel Messi", "Cristiano Ronaldo", "Robert Lewandowski", "Karim Benzema"],
    category: "Champions League",
    difficulty: "medium",
    points: 10
  }
]

async function seedQuizQuestions() {
  console.log("🌱 Seeding quiz questions...")
  
  try {
    // Clear existing questions
    await prisma.quizAnswer.deleteMany()
    await prisma.quizQuestion.deleteMany()
    
    // Create new questions
    for (const questionData of quizQuestions) {
      await prisma.quizQuestion.create({
        data: questionData
      })
    }
    
    console.log(`✅ Created ${quizQuestions.length} quiz questions`)
  } catch (error) {
    console.error("❌ Error seeding quiz questions:", error)
    throw error
  }
}

async function main() {
  await seedQuizQuestions()
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  }) 