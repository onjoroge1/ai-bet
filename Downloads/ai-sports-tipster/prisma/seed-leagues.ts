import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🌱 Seeding leagues...')

  // Sample leagues with data collection settings
  const leagues = [
    {
      name: 'Premier League',
      countryCode: 'EN',
      sport: 'football',
      isActive: true,
      logoUrl: 'https://example.com/premier-league.png',
      externalLeagueId: '39',
      isDataCollectionEnabled: true,
      dataCollectionPriority: 10,
      syncFrequency: 'daily',
      matchLimit: 20,
      isPredictionEnabled: true
    },
    {
      name: 'La Liga',
      countryCode: 'ES',
      sport: 'football',
      isActive: true,
      logoUrl: 'https://example.com/la-liga.png',
      externalLeagueId: '140',
      isDataCollectionEnabled: true,
      dataCollectionPriority: 9,
      syncFrequency: 'daily',
      matchLimit: 15,
      isPredictionEnabled: true
    },
    {
      name: 'Bundesliga',
      countryCode: 'DE',
      sport: 'football',
      isActive: true,
      logoUrl: 'https://example.com/bundesliga.png',
      externalLeagueId: '78',
      isDataCollectionEnabled: true,
      dataCollectionPriority: 8,
      syncFrequency: 'daily',
      matchLimit: 15,
      isPredictionEnabled: true
    },
    {
      name: 'Serie A',
      countryCode: 'IT',
      sport: 'football',
      isActive: true,
      logoUrl: 'https://example.com/serie-a.png',
      externalLeagueId: '135',
      isDataCollectionEnabled: true,
      dataCollectionPriority: 7,
      syncFrequency: 'daily',
      matchLimit: 15,
      isPredictionEnabled: true
    },
    {
      name: 'Ligue 1',
      countryCode: 'FR',
      sport: 'football',
      isActive: true,
      logoUrl: 'https://example.com/ligue-1.png',
      externalLeagueId: '61',
      isDataCollectionEnabled: true,
      dataCollectionPriority: 6,
      syncFrequency: 'daily',
      matchLimit: 10,
      isPredictionEnabled: true
    },
    {
      name: 'Championship',
      countryCode: 'EN',
      sport: 'football',
      isActive: true,
      logoUrl: 'https://example.com/championship.png',
      externalLeagueId: '40',
      isDataCollectionEnabled: false,
      dataCollectionPriority: 3,
      syncFrequency: 'weekly',
      matchLimit: 10,
      isPredictionEnabled: false
    },
    {
      name: 'NBA',
      countryCode: 'US',
      sport: 'basketball',
      isActive: true,
      logoUrl: 'https://example.com/nba.png',
      externalLeagueId: '12',
      isDataCollectionEnabled: true,
      dataCollectionPriority: 5,
      syncFrequency: 'daily',
      matchLimit: 15,
      isPredictionEnabled: true
    },
    {
      name: 'Test League (Inactive)',
      countryCode: 'XX',
      sport: 'football',
      isActive: false,
      logoUrl: 'https://example.com/test.png',
      externalLeagueId: '999',
      isDataCollectionEnabled: false,
      dataCollectionPriority: 0,
      syncFrequency: 'weekly',
      matchLimit: 5,
      isPredictionEnabled: false
    }
  ]

  for (const leagueData of leagues) {
    try {
      const league = await prisma.league.upsert({
        where: { name: leagueData.name },
        update: leagueData,
        create: leagueData
      })
      console.log(`✅ League "${league.name}" seeded`)
    } catch (error) {
      console.error(`❌ Failed to seed league "${leagueData.name}":`, error)
    }
  }

  console.log('🎉 League seeding completed!')
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  }) 