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
  },
  
  // EURO 2024 Questions (20 questions)
  {
    question: "Who won EURO 2024?",
    correctAnswer: "Spain",
    options: ["England", "Spain", "France", "Germany"],
    category: "EURO 2024",
    difficulty: "easy",
    points: 10
  },
  {
    question: "Which country hosted EURO 2024?",
    correctAnswer: "Germany",
    options: ["France", "Germany", "Italy", "Spain"],
    category: "EURO 2024",
    difficulty: "easy",
    points: 10
  },
  {
    question: "Who was the top scorer of EURO 2024?",
    correctAnswer: "Harry Kane",
    options: ["Kylian Mbappé", "Harry Kane", "Jude Bellingham", "Lamine Yamal"],
    category: "EURO 2024",
    difficulty: "medium",
    points: 10
  },
  {
    question: "Which team did Spain beat in the EURO 2024 final?",
    correctAnswer: "England",
    options: ["France", "England", "Germany", "Portugal"],
    category: "EURO 2024",
    difficulty: "easy",
    points: 10
  },
  {
    question: "Who scored the winning goal in the EURO 2024 final?",
    correctAnswer: "Mikel Oyarzabal",
    options: ["Lamine Yamal", "Mikel Oyarzabal", "Dani Olmo", "Álvaro Morata"],
    category: "EURO 2024",
    difficulty: "medium",
    points: 10
  },
  {
    question: "Which player was named Player of the Tournament at EURO 2024?",
    correctAnswer: "Lamine Yamal",
    options: ["Jude Bellingham", "Lamine Yamal", "Kylian Mbappé", "Harry Kane"],
    category: "EURO 2024",
    difficulty: "medium",
    points: 10
  },
  {
    question: "How many goals did Spain score in EURO 2024?",
    correctAnswer: "13",
    options: ["11", "12", "13", "14"],
    category: "EURO 2024",
    difficulty: "hard",
    points: 10
  },
  {
    question: "Which team was eliminated in the EURO 2024 semi-finals by England?",
    correctAnswer: "Netherlands",
    options: ["France", "Netherlands", "Portugal", "Switzerland"],
    category: "EURO 2024",
    difficulty: "medium",
    points: 10
  },
  {
    question: "Who was the youngest player to score at EURO 2024?",
    correctAnswer: "Lamine Yamal",
    options: ["Jude Bellingham", "Lamine Yamal", "Warren Zaïre-Emery", "Kobbie Mainoo"],
    category: "EURO 2024",
    difficulty: "medium",
    points: 10
  },
  {
    question: "Which goalkeeper kept the most clean sheets at EURO 2024?",
    correctAnswer: "Unai Simón",
    options: ["Jordan Pickford", "Unai Simón", "Manuel Neuer", "Mike Maignan"],
    category: "EURO 2024",
    difficulty: "hard",
    points: 10
  },
  {
    question: "What was the final score in the EURO 2024 final?",
    correctAnswer: "2-1",
    options: ["1-0", "2-1", "3-1", "2-2"],
    category: "EURO 2024",
    difficulty: "medium",
    points: 10
  },
  {
    question: "Which team scored the most goals in EURO 2024 group stage?",
    correctAnswer: "Germany",
    options: ["Spain", "Germany", "France", "England"],
    category: "EURO 2024",
    difficulty: "hard",
    points: 10
  },
  {
    question: "Who was the oldest player at EURO 2024?",
    correctAnswer: "Pepe",
    options: ["Cristiano Ronaldo", "Pepe", "Luka Modrić", "Manuel Neuer"],
    category: "EURO 2024",
    difficulty: "hard",
    points: 10
  },
  {
    question: "Which team was the biggest surprise of EURO 2024?",
    correctAnswer: "Georgia",
    options: ["Albania", "Georgia", "Slovenia", "Slovakia"],
    category: "EURO 2024",
    difficulty: "medium",
    points: 10
  },
  {
    question: "Who scored the fastest goal at EURO 2024?",
    correctAnswer: "Nedim Bajrami",
    options: ["Kylian Mbappé", "Nedim Bajrami", "Lamine Yamal", "Jude Bellingham"],
    category: "EURO 2024",
    difficulty: "hard",
    points: 10
  },
  {
    question: "Which team had the most possession in EURO 2024?",
    correctAnswer: "Spain",
    options: ["Germany", "Spain", "France", "England"],
    category: "EURO 2024",
    difficulty: "medium",
    points: 10
  },
  {
    question: "Who was the most fouled player at EURO 2024?",
    correctAnswer: "Kylian Mbappé",
    options: ["Jude Bellingham", "Kylian Mbappé", "Lamine Yamal", "Harry Kane"],
    category: "EURO 2024",
    difficulty: "hard",
    points: 10
  },
  {
    question: "Which team conceded the fewest goals at EURO 2024?",
    correctAnswer: "Spain",
    options: ["England", "Spain", "France", "Germany"],
    category: "EURO 2024",
    difficulty: "medium",
    points: 10
  },
  {
    question: "Who was the first player to score a hat-trick at EURO 2024?",
    correctAnswer: "No one",
    options: ["Harry Kane", "Kylian Mbappé", "Lamine Yamal", "No one"],
    category: "EURO 2024",
    difficulty: "hard",
    points: 10
  },
  {
    question: "Which stadium hosted the EURO 2024 final?",
    correctAnswer: "Olympiastadion Berlin",
    options: ["Allianz Arena", "Olympiastadion Berlin", "Signal Iduna Park", "Volkswagen Arena"],
    category: "EURO 2024",
    difficulty: "medium",
    points: 10
  },

  // Recent Champions League Questions (10 questions)
  {
    question: "Who won the 2023/24 UEFA Champions League?",
    correctAnswer: "Real Madrid",
    options: ["Manchester City", "Real Madrid", "Bayern Munich", "Arsenal"],
    category: "Champions League",
    difficulty: "easy",
    points: 10
  },
  {
    question: "Who scored the winning goal in the 2024 Champions League final?",
    correctAnswer: "Dani Carvajal",
    options: ["Vinícius Júnior", "Dani Carvajal", "Jude Bellingham", "Toni Kroos"],
    category: "Champions League",
    difficulty: "medium",
    points: 10
  },
  {
    question: "Which team did Real Madrid beat in the 2024 Champions League final?",
    correctAnswer: "Borussia Dortmund",
    options: ["Bayern Munich", "Borussia Dortmund", "PSG", "Manchester City"],
    category: "Champions League",
    difficulty: "easy",
    points: 10
  },
  {
    question: "Who was the top scorer in the 2023/24 Champions League?",
    correctAnswer: "Harry Kane",
    options: ["Erling Haaland", "Harry Kane", "Kylian Mbappé", "Jude Bellingham"],
    category: "Champions League",
    difficulty: "medium",
    points: 10
  },
  {
    question: "Which team was the biggest surprise in the 2023/24 Champions League?",
    correctAnswer: "Borussia Dortmund",
    options: ["Arsenal", "Borussia Dortmund", "Atlético Madrid", "PSG"],
    category: "Champions League",
    difficulty: "medium",
    points: 10
  },
  {
    question: "Who was the youngest player to score in the 2023/24 Champions League?",
    correctAnswer: "Lamine Yamal",
    options: ["Jude Bellingham", "Lamine Yamal", "Warren Zaïre-Emery", "Kobbie Mainoo"],
    category: "Champions League",
    difficulty: "hard",
    points: 10
  },
  {
    question: "Which goalkeeper kept the most clean sheets in the 2023/24 Champions League?",
    correctAnswer: "Andriy Lunin",
    options: ["Ederson", "Andriy Lunin", "Manuel Neuer", "Thibaut Courtois"],
    category: "Champions League",
    difficulty: "hard",
    points: 10
  },
  {
    question: "Who was the Player of the Tournament in the 2023/24 Champions League?",
    correctAnswer: "Jude Bellingham",
    options: ["Vinícius Júnior", "Jude Bellingham", "Erling Haaland", "Kylian Mbappé"],
    category: "Champions League",
    difficulty: "medium",
    points: 10
  },
  {
    question: "Which team scored the most goals in the 2023/24 Champions League?",
    correctAnswer: "Manchester City",
    options: ["Real Madrid", "Manchester City", "Bayern Munich", "PSG"],
    category: "Champions League",
    difficulty: "medium",
    points: 10
  },
  {
    question: "Who was the first player to score a hat-trick in the 2023/24 Champions League?",
    correctAnswer: "Erling Haaland",
    options: ["Harry Kane", "Erling Haaland", "Kylian Mbappé", "Jude Bellingham"],
    category: "Champions League",
    difficulty: "hard",
    points: 10
  },

  // Recent Premier League Questions (10 questions)
  {
    question: "Who won the 2023/24 Premier League Golden Boot?",
    correctAnswer: "Erling Haaland",
    options: ["Harry Kane", "Erling Haaland", "Mohamed Salah", "Ollie Watkins"],
    category: "Premier League",
    difficulty: "easy",
    points: 10
  },
  {
    question: "Which team finished second in the 2023/24 Premier League?",
    correctAnswer: "Arsenal",
    options: ["Liverpool", "Arsenal", "Manchester United", "Aston Villa"],
    category: "Premier League",
    difficulty: "easy",
    points: 10
  },
  {
    question: "Who was the Premier League Player of the Season 2023/24?",
    correctAnswer: "Phil Foden",
    options: ["Erling Haaland", "Phil Foden", "Declan Rice", "Virgil van Dijk"],
    category: "Premier League",
    difficulty: "medium",
    points: 10
  },
  {
    question: "Which goalkeeper kept the most clean sheets in the 2023/24 Premier League?",
    correctAnswer: "David Raya",
    options: ["Ederson", "David Raya", "Alisson", "Emiliano Martínez"],
    category: "Premier League",
    difficulty: "medium",
    points: 10
  },
  {
    question: "Who was the Premier League Young Player of the Season 2023/24?",
    correctAnswer: "Cole Palmer",
    options: ["Bukayo Saka", "Cole Palmer", "Phil Foden", "Erling Haaland"],
    category: "Premier League",
    difficulty: "medium",
    points: 10
  },
  {
    question: "Which team was relegated from the Premier League in 2023/24?",
    correctAnswer: "Luton Town",
    options: ["Burnley", "Sheffield United", "Luton Town", "All of the above"],
    category: "Premier League",
    difficulty: "easy",
    points: 10
  },
  {
    question: "Who scored the fastest Premier League goal in 2023/24?",
    correctAnswer: "Dominic Solanke",
    options: ["Erling Haaland", "Dominic Solanke", "Ollie Watkins", "Mohamed Salah"],
    category: "Premier League",
    difficulty: "hard",
    points: 10
  },
  {
    question: "Which team had the most possession in the 2023/24 Premier League?",
    correctAnswer: "Manchester City",
    options: ["Arsenal", "Manchester City", "Liverpool", "Brighton"],
    category: "Premier League",
    difficulty: "medium",
    points: 10
  },
  {
    question: "Who was the most fouled player in the 2023/24 Premier League?",
    correctAnswer: "Bruno Fernandes",
    options: ["Bukayo Saka", "Bruno Fernandes", "Jack Grealish", "Wilfried Zaha"],
    category: "Premier League",
    difficulty: "hard",
    points: 10
  },
  {
    question: "Which team scored the most goals in the 2023/24 Premier League?",
    correctAnswer: "Manchester City",
    options: ["Arsenal", "Manchester City", "Liverpool", "Aston Villa"],
    category: "Premier League",
    difficulty: "easy",
    points: 10
  },

  // Current Players & Transfers (10 questions)
  {
    question: "Which club did Jude Bellingham join in 2023?",
    correctAnswer: "Real Madrid",
    options: ["Manchester City", "Real Madrid", "Liverpool", "Barcelona"],
    category: "Transfers",
    difficulty: "easy",
    points: 10
  },
  {
    question: "Who is the most expensive transfer of all time?",
    correctAnswer: "Neymar",
    options: ["Kylian Mbappé", "Neymar", "Philippe Coutinho", "João Félix"],
    category: "Transfers",
    difficulty: "medium",
    points: 10
  },
  {
    question: "Which club did Erling Haaland join in 2022?",
    correctAnswer: "Manchester City",
    options: ["Manchester United", "Manchester City", "Liverpool", "Chelsea"],
    category: "Transfers",
    difficulty: "easy",
    points: 10
  },
  {
    question: "Who is known as 'The Norwegian Viking'?",
    correctAnswer: "Erling Haaland",
    options: ["Martin Ødegaard", "Erling Haaland", "Alexander Isak", "Joshua King"],
    category: "Players",
    difficulty: "medium",
    points: 10
  },
  {
    question: "Which player is known as 'The Spider'?",
    correctAnswer: "Emiliano Martínez",
    options: ["Alisson", "Emiliano Martínez", "Ederson", "David de Gea"],
    category: "Players",
    difficulty: "hard",
    points: 10
  },
  {
    question: "Who is the youngest player to score in the Premier League?",
    correctAnswer: "James Vaughan",
    options: ["Wayne Rooney", "James Vaughan", "Michael Owen", "Cesc Fàbregas"],
    category: "Records",
    difficulty: "hard",
    points: 10
  },
  {
    question: "Which player has the most Premier League assists?",
    correctAnswer: "Ryan Giggs",
    options: ["Cesc Fàbregas", "Ryan Giggs", "Frank Lampard", "Steven Gerrard"],
    category: "Records",
    difficulty: "medium",
    points: 10
  },
  {
    question: "Who is the fastest player in the Premier League?",
    correctAnswer: "Kyle Walker",
    options: ["Adama Traoré", "Kyle Walker", "Mohamed Salah", "Raheem Sterling"],
    category: "Records",
    difficulty: "hard",
    points: 10
  },
  {
    question: "Which player has won the most Premier League titles?",
    correctAnswer: "Ryan Giggs",
    options: ["Cristiano Ronaldo", "Ryan Giggs", "Paul Scholes", "Gary Neville"],
    category: "Records",
    difficulty: "medium",
    points: 10
  },
  {
    question: "Who is the oldest player to score in the Premier League?",
    correctAnswer: "Teddy Sheringham",
    options: ["Ryan Giggs", "Teddy Sheringham", "Gareth Barry", "Jussi Jääskeläinen"],
    category: "Records",
    difficulty: "hard",
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