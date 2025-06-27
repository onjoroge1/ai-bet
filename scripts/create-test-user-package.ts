import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function createTestUserPackage() {
  try {
    console.log('🧪 Creating test user package...')

    // Get the first user (admin user)
    const user = await prisma.user.findFirst({
      where: { role: 'Admin' }
    })

    if (!user) {
      console.log('❌ No admin user found')
      return
    }

    // Get the first package offer
    const packageOffer = await prisma.packageOffer.findFirst({
      where: { isActive: true }
    })

    if (!packageOffer) {
      console.log('❌ No active package offers found')
      return
    }

    // Get user's country pricing
    const countryPrice = await prisma.packageOfferCountryPrice.findFirst({
      where: {
        packageOfferId: packageOffer.id,
        countryId: user.countryId || undefined
      }
    })

    if (!countryPrice) {
      console.log('❌ No pricing found for user country')
      return
    }

    // Calculate expiration date
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + packageOffer.validityDays)

    // Create user package
    const userPackage = await prisma.userPackage.create({
      data: {
        userId: user.id,
        packageOfferId: packageOffer.id,
        expiresAt,
        tipsRemaining: packageOffer.tipCount === -1 ? 0 : packageOffer.tipCount, // 0 for unlimited
        totalTips: packageOffer.tipCount === -1 ? 0 : packageOffer.tipCount,
        pricePaid: countryPrice.price,
        currencyCode: countryPrice.currencyCode,
        currencySymbol: countryPrice.currencySymbol,
        status: 'active'
      },
      include: {
        packageOffer: true,
        user: {
          select: {
            email: true,
            fullName: true
          }
        }
      }
    })

    console.log('✅ Test user package created successfully!')
    console.log('📦 Package:', userPackage.packageOffer.name)
    console.log('👤 User:', userPackage.user.email)
    console.log('💰 Price:', `${userPackage.currencySymbol}${userPackage.pricePaid}`)
    console.log('🎯 Tips Remaining:', userPackage.tipsRemaining === 0 ? 'Unlimited' : userPackage.tipsRemaining)
    console.log('⏰ Expires:', userPackage.expiresAt.toLocaleDateString())

  } catch (error) {
    console.error('❌ Error creating test user package:', error)
  } finally {
    await prisma.$disconnect()
  }
}

createTestUserPackage() 