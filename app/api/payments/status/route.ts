import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import prisma from "@/lib/db"
import { authOptions } from "@/lib/auth"
import { stripe } from "@/lib/stripe-server"

// GET /api/payments/status - Check payment status by payment intent ID
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const paymentIntentId = searchParams.get('payment_intent')

    if (!paymentIntentId) {
      return NextResponse.json({ error: "Payment intent ID is required" }, { status: 400 })
    }

    // First, check if payment exists in our database by looking for recent purchases
    const recentPurchases = await prisma.purchase.findMany({
      where: {
        userId: session.user.id,
        createdAt: {
          gte: new Date(Date.now() - 5 * 60 * 1000) // Last 5 minutes
        }
      },
      include: {
        quickPurchase: true
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 1
    })

    // Also check for recently created user packages
    const recentUserPackages = await prisma.userPackage.findMany({
      where: {
        userId: session.user.id,
        createdAt: {
          gte: new Date(Date.now() - 5 * 60 * 1000) // Last 5 minutes
        }
      },
      include: {
        packageOffer: true
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 1
    })

    // Check for recent package purchases
    const recentPackagePurchases = await prisma.packagePurchase.findMany({
      where: {
        userId: session.user.id,
        createdAt: {
          gte: new Date(Date.now() - 5 * 60 * 1000) // Last 5 minutes
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: 1
    })

    // If we have recent purchases or user packages/predictions, consider payment successful
    if (recentPurchases.length > 0 || recentUserPackages.length > 0 || recentPackagePurchases.length > 0) {
      const purchase = recentPurchases[0]
      const userPackage = recentUserPackages[0]
      const userPrediction = recentUserPackages[0]

      return NextResponse.json({
        status: 'succeeded',
        purchaseId: purchase?.id,
        amount: purchase?.amount,
        createdAt: purchase?.createdAt,
        updatedAt: purchase?.updatedAt,
        // Include purchased item details
        itemType: userPackage ? 'package' : 'tip',
        itemDetails: userPackage ? {
          packageName: userPackage.packageOffer.name,
          tipCount: userPackage.packageOffer.tipCount,
          expiresAt: userPackage.expiresAt
        } : userPrediction ? {
          predictionType: userPrediction.prediction.predictionType,
          matchDetails: userPrediction.prediction.matchId
        } : {
          itemName: purchase?.quickPurchase?.name
        }
      })
    }

    // If no recent activity in database, check Stripe directly
    try {
      console.log(`Checking Stripe payment intent: ${paymentIntentId}`)
      const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId)
      
      if (paymentIntent.status === 'succeeded') {
        console.log(`Payment intent ${paymentIntentId} succeeded in Stripe, but no database records found`)
        
        // FALLBACK: Process the payment manually since webhook failed
        console.log('Processing payment manually as fallback...')
        await processPaymentManually(paymentIntent, session.user.id)
        
        return NextResponse.json({
          status: 'succeeded',
          message: 'Payment processed successfully',
          amount: paymentIntent.amount / 100,
          currency: paymentIntent.currency
        })
      } else if (paymentIntent.status === 'processing') {
        return NextResponse.json({ 
          status: 'processing',
          message: 'Payment is being processed...'
        })
      } else if (paymentIntent.status === 'requires_payment_method') {
        return NextResponse.json({ 
          status: 'failed',
          message: 'Payment requires payment method'
        })
      } else {
        return NextResponse.json({ 
          status: 'failed',
          message: `Payment status: ${paymentIntent.status}`
        })
      }
    } catch (stripeError) {
      console.error('Error checking Stripe payment intent:', stripeError)
      return NextResponse.json({ 
        status: 'processing',
        message: 'Unable to verify payment status'
      })
    }

  } catch (error) {
    console.error("Error checking payment status:", error)
    return NextResponse.json({ error: "Failed to check payment status" }, { status: 500 })
  }
}

// Fallback function to process payment manually when webhook fails
async function processPaymentManually(paymentIntent: any, userId: string) {
  try {
    const { metadata } = paymentIntent
    console.log('Processing payment manually with metadata:', metadata)
    
    if (!metadata.userId || !metadata.itemType || !metadata.itemId) {
      console.error('Missing required metadata in payment intent')
      return
    }

    const itemType = metadata.itemType
    const itemId = metadata.itemId

    if (itemType === 'package') {
      console.log('Processing package purchase manually...')
      
      // Check for existing package purchase (idempotency)
      const existingPackagePurchase = await prisma.packagePurchase.findFirst({
        where: {
          userId,
          createdAt: {
            gte: new Date(Date.now() - 5 * 60 * 1000) // Last 5 minutes
          }
        },
      })
      
      if (existingPackagePurchase) {
        console.log(`Package purchase already exists for user ${userId}`)
        return
      }
      
      // Create package purchase record
      console.log('Creating package purchase record...')
      let packagePurchaseData: any = {
        userId,
        amount: new (prisma as any).Decimal(paymentIntent.amount / 100),
        paymentMethod: 'stripe',
        status: 'completed',
        createdAt: new Date(),
        updatedAt: new Date(),
      }
      
      // Parse the itemId to determine if it's a PackageOffer ID or countryId_packageType
      const firstUnderscoreIndex = itemId.indexOf('_')
      if (firstUnderscoreIndex === -1) {
        // It's a PackageOffer ID
        packagePurchaseData.packageOfferId = itemId
        packagePurchaseData.packageType = metadata.packageType || 'unknown'
      } else {
        // It's a countryId_packageType format
        const countryId = itemId.substring(0, firstUnderscoreIndex)
        const packageType = itemId.substring(firstUnderscoreIndex + 1)
        packagePurchaseData.packageType = packageType
        packagePurchaseData.countryId = countryId
      }
      
      const packagePurchase = await prisma.packagePurchase.create({
        data: packagePurchaseData,
      })
      console.log(`Created package purchase record: ${packagePurchase.id}`)
      
      // Create user package and add credits
      await createUserPackageAndCredits(userId, itemId, paymentIntent)
      
    } else if (itemType === 'tip') {
      console.log('Processing tip purchase manually...')
      
      // Check for existing purchase (idempotency)
      const existing = await prisma.purchase.findFirst({
        where: {
          userId,
          quickPurchaseId: itemId,
          createdAt: {
            gte: new Date(Date.now() - 5 * 60 * 1000) // Last 5 minutes
          }
        },
      })
      if (existing) {
        console.log(`Purchase already exists for user ${userId} and item ${itemId}`)
        return
      }
      
      // Create purchase record
      const purchase = await prisma.purchase.create({
        data: {
          userId,
          quickPurchaseId: itemId,
          amount: new (prisma as any).Decimal(paymentIntent.amount / 100),
          paymentMethod: 'stripe',
          status: 'completed',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      })
      console.log(`Created purchase record: ${purchase.id}`)
      
      // Process tip purchase and add credits
      await processTipPurchaseAndCredits(userId, itemId, paymentIntent)
    }
    
    console.log('Manual payment processing completed successfully')
  } catch (error) {
    console.error('Error processing payment manually:', error)
  }
}

// Helper function to create user package and add credits
async function createUserPackageAndCredits(userId: string, itemId: string, paymentIntent: any) {
  try {
    // Parse itemId to get package type
    const firstUnderscoreIndex = itemId.indexOf('_')
    let packageType = 'unknown'
    
    if (firstUnderscoreIndex === -1) {
      // It's a PackageOffer ID, get the package type from metadata
      packageType = paymentIntent.metadata.packageType || 'unknown'
    } else {
      // It's a countryId_packageType format
      packageType = itemId.substring(firstUnderscoreIndex + 1)
    }
    
    // Determine tip count and validity based on package type
    let tipCount = 1
    let validityDays = 1
    
    switch (packageType) {
      case 'prediction':
        tipCount = 1
        validityDays = 1
        break
      case 'weekend_pass':
        tipCount = 5
        validityDays = 3
        break
      case 'weekly_pass':
        tipCount = 8
        validityDays = 7
        break
      case 'monthly_sub':
        tipCount = -1 // Unlimited
        validityDays = 30
        break
      default:
        tipCount = 1
        validityDays = 1
    }
    
    // Create user package
    const userPackage = await prisma.userPackage.create({
      data: {
        userId,
        packageOfferId: firstUnderscoreIndex === -1 ? itemId : null,
        packageType,
        tipsRemaining: tipCount === -1 ? -1 : tipCount,
        totalTips: tipCount === -1 ? -1 : tipCount,
        status: 'active',
        expiresAt: new Date(Date.now() + validityDays * 24 * 60 * 60 * 1000),
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    })
    
    console.log(`Created user package: ${userPackage.id}`)
    
    // Add credits to user
    const currentUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { predictionCredits: true }
    })
    
    const creditsToAdd = tipCount === -1 ? 150 : tipCount
    const newCredits = (currentUser?.predictionCredits || 0) + creditsToAdd
    
    await prisma.user.update({
      where: { id: userId },
      data: { predictionCredits: newCredits }
    })
    
    console.log(`Added ${creditsToAdd} credits to user ${userId}`)
    
    // Send notification
    try {
      const { NotificationService } = await import('@/lib/notification-service')
      await NotificationService.createPaymentSuccessNotification(
        userId,
        paymentIntent.amount / 100,
        'Premium Package',
        packageType,
        creditsToAdd
      )
      console.log('Payment success notification sent')
    } catch (error) {
      console.error('Failed to send payment notification:', error)
    }
    
  } catch (error) {
    console.error('Error creating user package and credits:', error)
  }
}

// Helper function to process tip purchase and add credits
async function processTipPurchaseAndCredits(userId: string, itemId: string, paymentIntent: any) {
  try {
    // Get the quick purchase item
    const quickPurchase = await prisma.quickPurchase.findUnique({
      where: { id: itemId }
    })

    if (!quickPurchase) {
      console.error(`Quick purchase item not found: ${itemId}`)
      return
    }

    // Create a user prediction record for the tip
    if (quickPurchase.matchId) {
      const prediction = await prisma.prediction.findFirst({
        where: { matchId: quickPurchase.matchId }
      })

      if (prediction) {
        await prisma.userPrediction.create({
          data: {
            userId,
            predictionId: prediction.id,
            stakeAmount: new (prisma as any).Decimal(0),
            potentialReturn: new (prisma as any).Decimal(0),
            status: 'pending'
          }
        })
      }
    }
    
    // Add 1 credit for tip purchase
    const currentUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { predictionCredits: true }
    })
    
    const newCredits = (currentUser?.predictionCredits || 0) + 1
    
    await prisma.user.update({
      where: { id: userId },
      data: { predictionCredits: newCredits }
    })
    
    console.log(`Added 1 credit for tip purchase to user ${userId}`)
    
    // Send notification
    try {
      const { NotificationService } = await import('@/lib/notification-service')
      await NotificationService.createPaymentSuccessNotification(
        userId,
        paymentIntent.amount / 100,
        'Tip'
      )
      console.log('Payment success notification sent')
    } catch (error) {
      console.error('Failed to send payment notification:', error)
    }
    
  } catch (error) {
    console.error('Error processing tip purchase and credits:', error)
  }
} 