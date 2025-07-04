import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import prisma from '@/lib/db';
import { Prisma } from '@prisma/client';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-05-28.basil',
});
const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET!;

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const sig = req.headers.get('stripe-signature') ?? '';
  const buf = Buffer.from(await req.arrayBuffer());

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(buf, sig, endpointSecret);
  } catch (err) {
    console.error('⚠️  Signature verify failed:', err);
    return new NextResponse('Sig error', { status: 400 });
  }

  try {
    switch (event.type) {
      case 'payment_intent.succeeded':
        await handlePaymentSuccess(event.data.object as Stripe.PaymentIntent);
        break;
      case 'payment_intent.payment_failed':
        await handlePaymentFailure(event.data.object as Stripe.PaymentIntent);
        break;
      // Add more event types as needed
      default:
        console.log('Unhandled event:', event.type);
    }
    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Error processing webhook:', error);
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}

async function handlePaymentSuccess(paymentIntent: Stripe.PaymentIntent) {
  const { metadata } = paymentIntent;
  if (!metadata.userId || !metadata.itemType || !metadata.itemId) {
    console.error('Missing required metadata in payment intent');
    return;
  }
  const userId = metadata.userId;
  const itemType = metadata.itemType;
  const itemId = metadata.itemId;
  try {
    // Idempotent: Check for recent purchases for this user and item
    const existing = await prisma.purchase.findFirst({
      where: {
        userId,
        quickPurchaseId: itemId,
        createdAt: {
          gte: new Date(Date.now() - 5 * 60 * 1000) // Last 5 minutes
        }
      },
    });
    if (existing) {
      console.log(`Purchase already exists for user ${userId} and item ${itemId}`);
      return;
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
    });
    console.log(`Created purchase record: ${purchase.id} for intent: ${paymentIntent.id}`);
    if (itemType === 'package') {
      await createUserPackage(userId, itemId, paymentIntent);
    } else if (itemType === 'tip') {
      await processTipPurchase(userId, itemId, paymentIntent);
    }
    // Send notification
    try {
      const { NotificationService } = await import('@/lib/notification-service');
      await NotificationService.createPaymentSuccessNotification(
        userId,
        paymentIntent.amount / 100,
        itemType === 'package' ? 'Package' : 'Tip'
      );
    } catch (error) {
      console.error('Failed to send payment notification:', error);
    }
  } catch (error) {
    console.error('Error handling payment success:', error);
  }
}

async function handlePaymentFailure(paymentIntent: Stripe.PaymentIntent) {
  console.log(`Payment failed for intent: ${paymentIntent.id}`);
  // Optionally notify user
}

async function createUserPackage(userId: string, packageOfferId: string, paymentIntent: Stripe.PaymentIntent) {
  try {
    // First try to find a PackageOffer with this ID
    let packageOffer = await prisma.packageOffer.findUnique({
      where: { id: packageOfferId }
    })

    let tipCount: number
    let validityDays: number
    let packageName: string
    let packageType: string

    // If not found, try to parse as PackageCountryPrice ID (format: countryId_packageType)
    if (!packageOffer) {
      const parts = packageOfferId.split('_')
      if (parts.length === 2) {
        const [countryId, pkgType] = parts
        
        // Set package details based on package type
        switch (pkgType) {
          case 'prediction':
            tipCount = 1
            validityDays = 1
            packageName = 'Single Tip'
            packageType = 'prediction'
            break
          case 'weekend_pass':
            tipCount = 5
            validityDays = 3
            packageName = 'Weekend Package'
            packageType = 'weekend_pass'
            break
          case 'weekly_pass':
            tipCount = 8
            validityDays = 7
            packageName = 'Weekly Package'
            packageType = 'weekly_pass'
            break
          case 'monthly_sub':
            tipCount = -1 // Unlimited
            validityDays = 30
            packageName = 'Monthly Subscription'
            packageType = 'monthly_sub'
            break
          default:
            tipCount = 1
            validityDays = 1
            packageName = pkgType
            packageType = pkgType
        }

        // Get user's country pricing
        const user = await prisma.user.findUnique({
          where: { id: userId },
          select: { countryId: true }
        })

        if (!user?.countryId) {
          console.error(`User country not found: ${userId}`)
          return
        }

        const countryPrice = await prisma.packageCountryPrice.findFirst({
          where: {
            countryId: user.countryId,
            packageType: pkgType
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
          console.error(`Country price not found for package: ${packageOfferId}`)
          return
        }

        // Calculate expiration date
        const expiresAt = new Date()
        expiresAt.setDate(expiresAt.getDate() + validityDays)

        // Create user package with virtual package offer
        const userPackage = await prisma.userPackage.create({
          data: {
            userId,
            packageOfferId: packageOfferId, // Use the original ID as reference
            expiresAt,
            tipsRemaining: tipCount === -1 ? 0 : tipCount,
            totalTips: tipCount === -1 ? 0 : tipCount,
            pricePaid: countryPrice.price,
            currencyCode: countryPrice.country.currencyCode || 'USD',
            currencySymbol: countryPrice.country.currencySymbol || '$',
            status: 'active'
          }
        })

        console.log(`Created user package: ${userPackage.id} for user: ${userId} (PackageCountryPrice)`)
        return userPackage
      } else {
        console.error(`Invalid package ID format: ${packageOfferId}`)
        return
      }
    }

    // Found PackageOffer record - proceed with original logic
    tipCount = packageOffer.tipCount
    validityDays = packageOffer.validityDays
    packageName = packageOffer.name
    packageType = packageOffer.packageType

    // Get user's country pricing
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { countryId: true }
    })

    if (!user?.countryId) {
      console.error(`User country not found: ${userId}`)
      return
    }

    const countryPrice = await prisma.packageOfferCountryPrice.findFirst({
      where: {
        packageOfferId,
        countryId: user.countryId,
        isActive: true
      }
    })

    if (!countryPrice) {
      console.error(`Country price not found for package: ${packageOfferId}`)
      return
    }

    // Calculate expiration date
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + packageOffer.validityDays)

    // Create user package
    const userPackage = await prisma.userPackage.create({
      data: {
        userId,
        packageOfferId,
        expiresAt,
        tipsRemaining: packageOffer.tipCount === -1 ? 0 : packageOffer.tipCount,
        totalTips: packageOffer.tipCount === -1 ? 0 : packageOffer.tipCount,
        pricePaid: countryPrice.price,
        currencyCode: countryPrice.currencyCode,
        currencySymbol: countryPrice.currencySymbol,
        status: 'active'
      }
    })

    console.log(`Created user package: ${userPackage.id} for user: ${userId} (PackageOffer)`)
    return userPackage
  } catch (error) {
    console.error("Error creating user package:", error)
    return null
  }
}

async function processTipPurchase(userId: string, itemId: string, paymentIntent: Stripe.PaymentIntent) {
  try {
    // Get the quick purchase item
    const quickPurchase = await prisma.quickPurchase.findUnique({
      where: { id: itemId }
    })

    if (!quickPurchase) {
      console.error(`Quick purchase item not found: ${itemId}`)
      return null
    }

    // Create a user prediction record for the tip
    if (quickPurchase.matchId) {
      // First, get or create a prediction record
      const prediction = await prisma.prediction.findFirst({
        where: { matchId: quickPurchase.matchId }
      })

      if (prediction) {
        await prisma.userPrediction.create({
          data: {
            userId,
            predictionId: prediction.id,
            stakeAmount: new Prisma.Decimal(0), // Default stake amount
            potentialReturn: new Prisma.Decimal(0), // Default potential return
            status: 'pending'
          }
        })
        return prediction
      }
    }

    console.log(`Processed tip purchase: ${itemId} for user: ${userId}`)
    return null
  } catch (error) {
    console.error("Error processing tip purchase:", error)
    return null
  }
} 