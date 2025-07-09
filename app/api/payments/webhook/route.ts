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
  console.log('--- Stripe Webhook Hit ---');
  const sig = req.headers.get('stripe-signature') ?? '';
  console.log('Stripe-Signature header present:', !!sig);
  console.log('Webhook secret loaded:', endpointSecret ? 'YES' : 'NO');
  const buf = Buffer.from(await req.arrayBuffer());

  let event: Stripe.Event;
  try {
    console.log('Attempting to construct Stripe event...');
    event = stripe.webhooks.constructEvent(buf, sig, endpointSecret);
    console.log('Stripe event constructed successfully. Event type:', event.type);
  } catch (err) {
    console.error('⚠️  Signature verify failed:', err);
    return new NextResponse('Sig error', { status: 400 });
  }

  try {
    switch (event.type) {
      case 'payment_intent.succeeded':
        console.log('Handling payment_intent.succeeded event');
        await handlePaymentSuccess(event.data.object as Stripe.PaymentIntent);
        break;
      case 'payment_intent.payment_failed':
        console.log('Handling payment_intent.payment_failed event');
        await handlePaymentFailure(event.data.object as Stripe.PaymentIntent);
        break;
      // Add more event types as needed
      default:
        console.log('Unhandled event:', event.type);
    }
    console.log('Webhook event processed successfully. Sending 200 response.');
    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Error processing webhook:', error);
    return NextResponse.json({ error: 'Webhook processing failed' }, { status: 500 });
  }
}

async function handlePaymentSuccess(paymentIntent: Stripe.PaymentIntent) {
  const { metadata } = paymentIntent;
  console.log('PaymentIntent metadata:', metadata);
  if (!metadata.userId || !metadata.itemType || !metadata.itemId) {
    console.error('Missing required metadata in payment intent');
    return;
  }
  const userId = metadata.userId;
  const itemType = metadata.itemType;
  const itemId = metadata.itemId;
  try {
    if (itemType === 'package') {
      console.log('Processing package purchase...');
      
      // Check for existing package purchase (idempotency)
      const existingPackagePurchase = await prisma.packagePurchase.findFirst({
        where: {
          userId,
          createdAt: {
            gte: new Date(Date.now() - 5 * 60 * 1000) // Last 5 minutes
          }
        },
      });
      
      if (existingPackagePurchase) {
        console.log(`Package purchase already exists for user ${userId}`);
        return;
      }
      
      // Create package purchase record
      console.log('Creating package purchase record...');
      let packagePurchaseData: any = {
        userId,
        amount: new Prisma.Decimal(paymentIntent.amount / 100),
        paymentMethod: 'stripe',
        status: 'completed',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      
      // Parse the itemId to determine if it's a PackageOffer ID or countryId_packageType
      const firstUnderscoreIndex = itemId.indexOf('_');
      if (firstUnderscoreIndex === -1) {
        // It's a PackageOffer ID
        packagePurchaseData.packageOfferId = itemId;
        packagePurchaseData.packageType = metadata.packageType || 'unknown';
      } else {
        // It's a countryId_packageType format
        const countryId = itemId.substring(0, firstUnderscoreIndex);
        const packageType = itemId.substring(firstUnderscoreIndex + 1);
        packagePurchaseData.packageType = packageType;
        packagePurchaseData.countryId = countryId;
      }
      
      const packagePurchase = await prisma.packagePurchase.create({
        data: packagePurchaseData,
      });
      console.log(`Created package purchase record: ${packagePurchase.id} for intent: ${paymentIntent.id}`);
      
      // Create user package
      console.log('Creating user package...');
      const userPackage = await createUserPackage(userId, itemId, paymentIntent);
      
      // Add credits to user account
      if (userPackage) {
        console.log('Adding credits to user account...');
        
        // Get user's current credits before adding new ones
        const currentUser = await prisma.user.findUnique({
          where: { id: userId },
          select: { predictionCredits: true }
        });
        
        const creditResult = await addCreditsToUser(userId, userPackage);
        
        // Calculate credits gained
        const creditsGained = creditResult?.predictionCredits ? 
          creditResult.predictionCredits - (currentUser?.predictionCredits || 0) : 
          undefined;
        
        // Send notification with package details
        try {
          console.log('Sending payment success notification...');
          const { NotificationService } = await import('@/lib/notification-service');
          await NotificationService.createPaymentSuccessNotification(
            userId,
            paymentIntent.amount / 100,
            itemType === 'package' ? 'Premium Package' : 'Tip',
            packagePurchase.packageType,
            creditsGained
          );
          console.log('Notification sent.');
        } catch (error) {
          console.error('Failed to send payment notification:', error);
        }
      }
      
    } else if (itemType === 'tip') {
      console.log('Processing tip purchase...');
      
      // Idempotent: Check for recent purchases for this user and item
      console.log('Checking for existing purchase record...');
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
      console.log('Creating purchase record...');
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
      
      const tipResult = await processTipPurchase(userId, itemId, paymentIntent);
      
      // Add credits for tip purchase
      if (tipResult) {
        console.log('Adding credits for tip purchase...');
        await addCreditsToUser(userId, { totalTips: 1 }); // Single tip = 1 credit
      }
    }
    
    // Send notification
    try {
      console.log('Sending payment success notification...');
      const { NotificationService } = await import('@/lib/notification-service');
      await NotificationService.createPaymentSuccessNotification(
        userId,
        paymentIntent.amount / 100,
        itemType === 'package' ? 'Package' : 'Tip'
      );
      console.log('Notification sent.');
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
    const packageOffer = await prisma.packageOffer.findUnique({
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
            totalTips: tipCount, // Keep -1 for unlimited packages
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

    let countryPrice = await prisma.packageOfferCountryPrice.findFirst({
      where: {
        packageOfferId,
        countryId: user.countryId,
        isActive: true
      }
    })

    // If PackageOfferCountryPrice not found, try to create it from PackageCountryPrice
    if (!countryPrice) {
      console.log(`PackageOfferCountryPrice not found, trying to create from PackageCountryPrice for package: ${packageOfferId}`)
      
      const packageCountryPrice = await prisma.packageCountryPrice.findFirst({
        where: {
          countryId: user.countryId,
          packageType: packageOffer.packageType
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

      if (packageCountryPrice) {
        // Create PackageOfferCountryPrice record
        countryPrice = await prisma.packageOfferCountryPrice.create({
          data: {
            packageOfferId,
            countryId: user.countryId,
            price: packageCountryPrice.price,
            originalPrice: packageCountryPrice.originalPrice,
            currencyCode: packageCountryPrice.country.currencyCode || 'USD',
            currencySymbol: packageCountryPrice.country.currencySymbol || '$',
            isActive: true
          }
        })
        console.log(`Created PackageOfferCountryPrice record: ${countryPrice.id}`)
      } else {
        console.error(`Neither PackageOfferCountryPrice nor PackageCountryPrice found for package: ${packageOfferId}`)
        return
      }
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
        totalTips: packageOffer.tipCount, // Keep -1 for unlimited packages
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

async function addCreditsToUser(userId: string, userPackage: any) {
  try {
    console.log(`Adding credits for user package: ${userPackage.id}`);
    
    // Calculate credits to add based on package type
    let creditsToAdd = 0;
    
    if (userPackage.totalTips === -1) {
      // Unlimited package - add a large number of credits
      creditsToAdd = 150; // Unlimited credits for monthly subscription (5 tips/day * 30 days)
    } else {
      // Limited package - add credits equal to tip count
      creditsToAdd = userPackage.totalTips;
    }
    
    // Update user's prediction credits
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        predictionCredits: {
          increment: creditsToAdd
        }
      },
      select: {
        id: true,
        email: true,
        predictionCredits: true
      }
    });
    
    console.log(`Added ${creditsToAdd} credits to user ${updatedUser.email}. New total: ${updatedUser.predictionCredits}`);
    
    // Create a notification for the user about credits added
    try {
      const { NotificationService } = await import('@/lib/notification-service');
      await NotificationService.createNotification({
        userId,
        title: 'Credits Added',
        message: `Your account has been credited with ${creditsToAdd} prediction credits for your package purchase.`,
        type: 'success',
        category: 'payment'
      });
    } catch (error) {
      console.error('Failed to create credits notification:', error);
    }
    
    return updatedUser;
  } catch (error) {
    console.error('Error adding credits to user:', error);
    return null;
  }
} 