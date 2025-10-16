import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import prisma from "@/lib/db"
import { Prisma } from "@prisma/client"
import { authOptions } from "@/lib/auth"
import type { PaymentIntent, PrismaDecimal } from "@/types/api"
import Stripe from "stripe"

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2025-05-28.basil",
})

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
      const packagePurchase = recentPackagePurchases[0]

      // If we have a package purchase but no user package, trigger manual processing
      if (packagePurchase && recentUserPackages.length === 0) {
        console.log(`Found package purchase ${packagePurchase.id} but no user package. Triggering manual processing...`)
        
        // Get the payment intent to trigger manual processing
        try {
          const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId)
          if (paymentIntent.status === 'succeeded') {
            await processPaymentManually(paymentIntent, session.user.id)
          }
        } catch (error) {
          console.error('Error triggering manual processing:', error)
        }
      }

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
        } : recentPackagePurchases.length > 0 ? {
          predictionType: 'package_purchase',
          matchDetails: 'Package purchase completed'
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
      
      // Check for existing user package (idempotency) - only check UserPackage, not PackagePurchase
      const existingUserPackage = await prisma.userPackage.findFirst({
        where: {
          userId,
          createdAt: {
            gte: new Date(Date.now() - 5 * 60 * 1000) // Last 5 minutes
          }
        },
      })
      
      if (existingUserPackage) {
        console.log(`User package already exists for user ${userId}`)
        return
      }
      
      // Create package purchase record (if it doesn't exist)
      console.log('Creating package purchase record...')
      const packagePurchaseData = {
        userId,
        amount: paymentIntent.amount / 100,
        paymentMethod: 'stripe',
        status: 'completed',
        createdAt: new Date(),
        updatedAt: new Date(),
      } as Record<string, unknown>
      
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
      
      // Only create PackagePurchase if it doesn't exist
      const existingPackagePurchase = await prisma.packagePurchase.findFirst({
        where: {
          userId,
          createdAt: {
            gte: new Date(Date.now() - 5 * 60 * 1000) // Last 5 minutes
          }
        },
      })
      
      if (!existingPackagePurchase) {
        const packagePurchase = await prisma.packagePurchase.create({
          data: packagePurchaseData as any,
        })
        console.log(`Created package purchase record: ${packagePurchase.id}`)
      } else {
        console.log(`Package purchase already exists, skipping creation`)
      }
      
      // Create user package and add credits
      await createUserPackageAndCredits(userId, itemId, paymentIntent, metadata)
      
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
          amount: new Prisma.Decimal(paymentIntent.amount / 100),
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
async function createUserPackageAndCredits(userId: string, itemId: string, paymentIntent: any, metadata: any) {
  try {
    console.log(`[createUserPackageAndCredits] Starting for userId: ${userId}, itemId: ${itemId}`);
    
    // Parse itemId to get package type
    const firstUnderscoreIndex = itemId.indexOf('_')
    let packageType = 'unknown'
    
    if (firstUnderscoreIndex === -1) {
      // It's a PackageOffer ID, get the package type from metadata
      packageType = metadata.packageType || 'unknown'
    } else {
      // It's a countryId_packageType format
      packageType = itemId.substring(firstUnderscoreIndex + 1)
    }
    
    console.log(`[createUserPackageAndCredits] Package type: ${packageType}`);
    
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
    
    // Get user's country for pricing
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { countryId: true }
    })
    
    if (!user?.countryId) {
      console.error(`[createUserPackageAndCredits] User country not found: ${userId}`);
      return;
    }
    
    // Get country pricing
    const countryPrice = await prisma.packageCountryPrice.findFirst({
      where: {
        countryId: user.countryId,
        packageType: packageType
      },
      include: {
        country: {
          select: {
            currencyCode: true,
            currencySymbol: true
          }
        }
      }
    })
    
    if (!countryPrice) {
      console.error(`[createUserPackageAndCredits] Country price not found for package: ${itemId}`);
      return;
    }
    
    // Calculate expiration date
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + validityDays)
    
    // Create user package with proper structure
    const userPackageData: any = {
      userId,
      expiresAt,
      tipsRemaining: tipCount === -1 ? 0 : tipCount,
      totalTips: tipCount,
      pricePaid: countryPrice.price,
      currencyCode: countryPrice.country.currencyCode || 'USD',
      currencySymbol: countryPrice.country.currencySymbol || '$',
      status: 'active',
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    
    // Only set packageOfferId if it's a valid PackageOffer ID (not countryId_packageType)
    if (firstUnderscoreIndex === -1) {
      userPackageData.packageOfferId = itemId
    } else {
      // For countryId_packageType format, create a virtual PackageOffer first
      console.log(`[createUserPackageAndCredits] Creating virtual PackageOffer for country-based package: ${packageType}`);
      
      const virtualPackageOffer = await prisma.packageOffer.upsert({
        where: { 
          id: itemId // Use the original itemId as the PackageOffer ID
        },
        update: {},
        create: {
          id: itemId,
          name: packageType === 'prediction' ? 'Single Tip' : 
                packageType === 'weekend_pass' ? 'Weekend Package' :
                packageType === 'weekly_pass' ? 'Weekly Package' :
                packageType === 'monthly_sub' ? 'Monthly Subscription' : packageType,
          packageType: packageType,
          description: `Virtual package for ${packageType}`,
          tipCount: tipCount,
          validityDays: validityDays,
          isActive: true,
          displayOrder: 0,
          features: [],
          iconName: 'Gift',
          colorGradientFrom: '#8B5CF6',
          colorGradientTo: '#EC4899'
        }
      });
      
      console.log(`[createUserPackageAndCredits] Created virtual PackageOffer: ${virtualPackageOffer.id}`);
      userPackageData.packageOfferId = itemId;
    }
    // For countryId_packageType format, don't set packageOfferId (it doesn't exist in PackageOffer table)
    
    const userPackage = await prisma.userPackage.create({
      data: userPackageData,
    })
    
    console.log(`[createUserPackageAndCredits] Created user package: ${userPackage.id}`)
    
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
    
    console.log(`[createUserPackageAndCredits] Added ${creditsToAdd} credits to user ${userId}`)
    
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
      console.log('[createUserPackageAndCredits] Payment success notification sent')
    } catch (error) {
      console.error('[createUserPackageAndCredits] Failed to send payment notification:', error)
    }
    
    // Send payment confirmation email
    try {
      const userWithEmail = await prisma.user.findUnique({
        where: { id: userId },
        select: { email: true, fullName: true }
      });
      
      if (userWithEmail && userWithEmail.email) {
        const { EmailService } = await import('@/lib/email-service');
        await EmailService.sendPaymentConfirmation({
          userName: userWithEmail.email, // This should be the email address
          packageName: metadata.packageName || 'Premium Package',
          amount: paymentIntent.amount / 100,
          transactionId: paymentIntent.id,
          tipsCount: metadata.tipsCount ? Number(metadata.tipsCount) : 1
        });
        console.log('[createUserPackageAndCredits] Payment confirmation email sent');
      }
    } catch (emailError) {
      console.error('[createUserPackageAndCredits] Failed to send payment confirmation email:', emailError);
    }
    
  } catch (error) {
    console.error('[createUserPackageAndCredits] Error creating user package and credits:', error)
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
            stakeAmount: new Prisma.Decimal(0),
            potentialReturn: new Prisma.Decimal(0),
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