import { PrismaClient } from '@prisma/client'
import countries from 'world-countries'

const prisma = new PrismaClient()

async function main() {
  for (const c of countries) {
    await prisma.country.upsert({
      where: { code: c.cca2.toLowerCase() },
      update: {},
      create: {
        code: c.cca2.toLowerCase(),
        name: c.name.common,
        flagEmoji: c.flag,
        currencyCode: c.currencies ? Object.keys(c.currencies)[0] : '',
        currencySymbol: '', // You can enhance this with a currency-symbol package
        isActive: true,
      },
    })
  }
  console.log('🌍 All countries seeded!')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  }) 