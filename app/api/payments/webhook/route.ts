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
      case 'checkout.session.completed':
        console.log('Handling checkout.session.completed event');
        await handleCheckoutSessionCompleted(event.data.object as Stripe.Checkout.Session);
        break;
      case 'payment_intent.succeeded':
        console.log('Handling payment_intent.succeeded event');
        await handlePaymentSuccess(event.data.object as Stripe.PaymentIntent);
        break;
      case 'payment_intent.payment_failed':
        console.log('Handling payment_intent.payment_failed event');
        await handlePaymentFailure(event.data.object as Stripe.PaymentIntent);
        break;

      // ── Subscription lifecycle ──────────────────────────────────────────
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        console.log(`Handling ${event.type}`);
        await handleSubscriptionUpsert(event.data.object as Stripe.Subscription);
        break;

      case 'customer.subscription.deleted':
        console.log('Handling customer.subscription.deleted');
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;

      // ── Invoice events (recurring billing) ─────────────────────────────
      case 'invoice.paid':
        console.log('Handling invoice.paid');
        await handleInvoicePaid(event.data.object as Stripe.Invoice);
        break;

      case 'invoice.payment_failed':
        console.log('Handling invoice.payment_failed');
        await handleInvoicePaymentFailed(event.data.object as Stripe.Invoice);
        break;

      // ── Refunds ─────────────────────────────────────────────────────────
      case 'charge.refunded':
        console.log('Handling charge.refunded');
        await handleChargeRefunded(event.data.object as Stripe.Charge);
        break;

      // ── Disputes / chargebacks ──────────────────────────────────────────
      case 'charge.dispute.created':
      case 'charge.dispute.updated':
      case 'charge.dispute.closed':
      case 'charge.dispute.funds_withdrawn':
      case 'charge.dispute.funds_reinstated':
        console.log(`Handling ${event.type}`);
        await handleChargeDispute(event.data.object as Stripe.Dispute, event.type);
        break;

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
  console.log('PaymentIntent amount (cents):', paymentIntent.amount);
  console.log('PaymentIntent amount (dollars):', paymentIntent.amount / 100);
  console.log('PaymentIntent currency:', paymentIntent.currency);
  
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

      // Fetch the actual price from the quick-purchases API to ensure consistency
      let actualPrice = paymentIntent.amount / 100; // Fallback to payment intent amount
      try {
        console.log('Fetching package price from quick-purchases API for consistency...');
        const quickPurchasesResponse = await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/quick-purchases`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        });
        
        if (quickPurchasesResponse.ok) {
          const quickPurchasesData = await quickPurchasesResponse.json();
          // Find the specific package by ID to get the correct price
          const matchingPackage = quickPurchasesData.find((item: any) => item.id === itemId);
          if (matchingPackage && matchingPackage.price) {
            actualPrice = typeof matchingPackage.price === 'number' ? matchingPackage.price : parseFloat(matchingPackage.price);
            console.log(`Package price fetched from API: $${actualPrice} (was: $${paymentIntent.amount / 100})`);
          } else {
            console.log('Package not found in quick-purchases API, using payment intent amount');
          }
        } else {
          console.log('Failed to fetch quick-purchases for package, using payment intent amount');
        }
      } catch (error) {
        console.error('Error fetching package price from API, using payment intent amount:', error);
      }
      
      // Create package purchase record
      console.log('Creating package purchase record...');
      let packagePurchaseData: any = {
        userId,
        amount: new Prisma.Decimal(actualPrice), // Use the API price instead of payment intent amount
        paymentMethod: 'stripe',
        status: 'completed',
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      
      // Parse the itemId to determine if it's a PackageOfferCountryPrice ID or countryId_packageType
      const firstUnderscoreIndex = itemId.indexOf('_');
      if (firstUnderscoreIndex === -1) {
        // It's a PackageOfferCountryPrice ID
        packagePurchaseData.packageOfferCountryPriceId = itemId;
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
      console.log(`[handlePaymentSuccess] About to call createUserPackage with: userId=${userId}, itemId=${itemId}`);
      let userPackage = null;
      try {
        userPackage = await createUserPackage(userId, itemId, paymentIntent);
        console.log(`[handlePaymentSuccess] createUserPackage returned:`, userPackage ? `SUCCESS - ID: ${userPackage.id}` : 'NULL');
      } catch (error) {
        console.error(`[handlePaymentSuccess] CRITICAL: createUserPackage failed for userId=${userId}, itemId=${itemId}, paymentIntent=${paymentIntent.id}:`, error);
        // Record the failure on the package purchase so it can be retried/investigated
        await prisma.packagePurchase.update({
          where: { id: packagePurchase.id },
          data: { status: 'PACKAGE_CREATION_FAILED' },
        }).catch(e => console.error('[handlePaymentSuccess] Failed to update package purchase status:', e));
        userPackage = null;
      }
      
      // Update user's lifetime tracking fields (firstPaidAt / lastPurchaseAt /
      // lifetimeValue) for the /admin/users dashboard. Using setOnInsert-style
      // semantics for firstPaidAt: only set if currently null.
      try {
        const paidAmountDollars = paymentIntent.amount / 100;
        const u = await prisma.user.findUnique({
          where: { id: userId },
          select: { firstPaidAt: true, lifetimeValue: true },
        });
        await prisma.user.update({
          where: { id: userId },
          data: {
            firstPaidAt: u?.firstPaidAt ?? new Date(),
            lastPurchaseAt: new Date(),
            lifetimeValue: { increment: paidAmountDollars },
          },
        });
      } catch (trackErr) {
        // Tracking failures should never block the actual purchase flow
        console.error('[handlePaymentSuccess] Failed to update tracking fields', trackErr);
      }

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
        if (!creditResult) {
          console.error('CRITICAL: Failed to add credits to user. Aborting payment notification.');
          // Send failure notification to user
          try {
            const { NotificationService } = await import('@/lib/notification-service');
            await NotificationService.createNotification({
              userId,
              title: 'Payment Issue',
              message: 'Your payment was received, but there was an issue crediting your account. Please contact support.',
              type: 'error',
              category: 'payment',
              actionUrl: '/dashboard/support',
            });
            console.log('Failure notification sent.');
          } catch (notifyError) {
            console.error('Failed to send failure notification:', notifyError);
          }
          return;
        }
        // Send notification with package details
        try {
          console.log('Sending payment success notification...');
          const { NotificationService } = await import('@/lib/notification-service');
          await NotificationService.createPaymentSuccessNotification(
            userId,
            actualPrice, // Use the consistent API price instead of payment intent amount
            itemType === 'package' ? 'Premium Package' : 'Tip',
            packagePurchase.packageType,
            creditsGained
          );
          console.log('Notification sent.');
        } catch (error) {
          console.error('Failed to send payment notification:', error);
        }
      }
      
      // Note: Email is now sent by the NotificationService.createPaymentSuccessNotification method
      // No need for duplicate email sending here
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

      // Fetch the actual price from the quick-purchases API to ensure consistency
      let actualPrice = paymentIntent.amount / 100; // Fallback to payment intent amount
      try {
        console.log('Fetching price from quick-purchases API for consistency...');
        const quickPurchasesResponse = await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/quick-purchases`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        });
        
        if (quickPurchasesResponse.ok) {
          const quickPurchasesData = await quickPurchasesResponse.json();
          // Find the specific item by ID to get the correct price
          const matchingItem = quickPurchasesData.find((item: any) => item.id === itemId);
          if (matchingItem && matchingItem.price) {
            actualPrice = typeof matchingItem.price === 'number' ? matchingItem.price : parseFloat(matchingItem.price);
            console.log(`Price fetched from API: $${actualPrice} (was: $${paymentIntent.amount / 100})`);
          } else {
            console.log('Item not found in quick-purchases API, using payment intent amount');
          }
        } else {
          console.log('Failed to fetch quick-purchases, using payment intent amount');
        }
      } catch (error) {
        console.error('Error fetching price from API, using payment intent amount:', error);
      }
      
      // Create purchase record with the consistent price
      console.log('Creating purchase record...');
      const purchase = await prisma.purchase.create({
        data: {
          userId,
          quickPurchaseId: itemId,
          amount: new Prisma.Decimal(actualPrice), // Use the API price instead of payment intent amount
          paymentMethod: 'stripe',
          status: 'completed',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });
      console.log(`Created purchase record: ${purchase.id} for intent: ${paymentIntent.id} with amount: $${actualPrice}`);
      
      const tipResult = await processTipPurchase(userId, itemId, paymentIntent);
      
      // Add credits for tip purchase
      if (tipResult) {
        console.log('Adding credits for tip purchase...');
        await addCreditsToUser(userId, { totalTips: 1 }); // Single tip = 1 credit
      }
      
      // Send notification for tip purchase with detailed tip information
      try {
        console.log('Sending tip purchase notification...');
        const { NotificationService } = await import('@/lib/notification-service');
        
        // Get tip details for the notification
        const quickPurchase = await prisma.quickPurchase.findUnique({
          where: { id: itemId },
          include: {
            match: {
              include: {
                homeTeam: true,
                awayTeam: true,
                league: true
              }
            }
          }
        });
        
        if (quickPurchase && quickPurchase.match) {
          const match = quickPurchase.match;
          const tipName = `Premium Tip - ${match.homeTeam.name} vs ${match.awayTeam.name}`;
          const matchDetails = `${match.homeTeam.name} vs ${match.awayTeam.name} - ${match.league.name}`;
          const prediction = quickPurchase.prediction || 'Match prediction';
          const confidence = quickPurchase.confidence || 85;
          const expiresAt = match.startTime ? new Date(match.startTime).toISOString() : new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
          const transactionId = paymentIntent.id;
          const currencySymbol = paymentIntent.currency === 'usd' ? '$' : '€';
          
          await NotificationService.createTipPurchaseNotification(
            userId,
            actualPrice, // Use the consistent API price instead of payment intent amount
            tipName,
            matchDetails,
            prediction,
            confidence,
            expiresAt,
            transactionId,
            currencySymbol
          );
        } else {
          // Fallback to generic notification if tip details not available
          await NotificationService.createPaymentSuccessNotification(
            userId,
            actualPrice, // Use the consistent API price instead of payment intent amount
            'Premium Tip'
          );
        }
        console.log('Tip purchase notification sent.');
      } catch (error) {
        console.error('Failed to send tip purchase notification:', error);
      }
      
      // Note: Email is now sent by the NotificationService.createPaymentSuccessNotification method
      // No need for duplicate email sending here
    }
  } catch (error) {
    console.error('Error handling payment success:', error);
  }
}

async function handlePaymentFailure(paymentIntent: Stripe.PaymentIntent) {
  console.log(`Payment failed for intent: ${paymentIntent.id}`);
  // Optionally notify user
}

/**
 * Handle Stripe Checkout Session completion (for WhatsApp purchases)
 */
async function handleCheckoutSessionCompleted(session: Stripe.Checkout.Session) {
  console.log('Processing checkout.session.completed for session:', session.id);
  
  const metadata = session.metadata || {};
  const waId = metadata.waId;
  const matchId = metadata.matchId;
  const quickPurchaseId = metadata.quickPurchaseId;
  const source = metadata.source;
  const purchaseType = metadata.purchaseType;
  const packageType = metadata.packageType;

  // ── Web-app subscription checkout ─────────────────────────────────────────
  // When a web user completes a subscription checkout, store the Stripe customer
  // ID on the User record so future subscription events can be correlated.
  if (source !== 'whatsapp' && session.mode === 'subscription') {
    const userId = metadata.userId;
    if (userId && session.customer) {
      const customerId =
        typeof session.customer === 'string' ? session.customer : session.customer.id;
      await prisma.user.update({
        where: { id: userId },
        data: {
          stripeCustomerId: customerId,
          subscriptionStatus: 'active',
          subscriptionPlan: metadata.planType ?? 'monthly_sub',
        },
      });
      console.log(`[handleCheckoutSessionCompleted] Stored Stripe customer ${customerId} for user ${userId}`);
    }
    return;
  }

  // Process WhatsApp purchases (both individual picks and VIP subscriptions)
  if (source !== 'whatsapp' || !waId) {
    console.log('Not a WhatsApp purchase, skipping');
    return;
  }

  // Handle VIP subscription purchases
  if (purchaseType === 'vip_subscription' && packageType) {
    const { handleWhatsAppVIPSubscription } = await import('../webhook-handle-vip');
    await handleWhatsAppVIPSubscription(session, waId, packageType, metadata);
    return;
  }

  // Handle individual pick purchases (existing logic)
  if (!matchId || !quickPurchaseId) {
    console.log('WhatsApp purchase missing matchId or quickPurchaseId, skipping');
    return;
  }

  try {
    // Find WhatsAppPurchase by paymentSessionId
    const whatsappPurchase = await prisma.whatsAppPurchase.findFirst({
      where: {
        paymentSessionId: session.id,
      },
      include: {
        waUser: true,
        quickPurchase: {
          include: {
            country: {
              select: {
                currencyCode: true,
                currencySymbol: true,
              },
            },
          },
        },
      },
    });

    if (!whatsappPurchase) {
      console.error('WhatsAppPurchase not found for session:', session.id);
      return;
    }

    // Check if already processed (idempotency)
    if (whatsappPurchase.status === 'completed') {
      console.log('WhatsAppPurchase already completed:', whatsappPurchase.id);
      return;
    }

    // Update purchase status
    await prisma.whatsAppPurchase.update({
      where: { id: whatsappPurchase.id },
      data: {
        status: 'completed',
        paymentIntentId: session.payment_intent as string | null,
        purchasedAt: new Date(),
      },
    });

    // Update WhatsAppUser totals
    await prisma.whatsAppUser.update({
      where: { id: whatsappPurchase.waUserId },
      data: {
        totalSpend: {
          increment: whatsappPurchase.amount,
        },
        totalPicks: {
          increment: 1,
        },
      },
    });

    // Get pick details and send via WhatsApp (same as direct webhook flow)
    const { formatPickDeliveryMessage } = await import('@/lib/whatsapp-payment');
    const { sendWhatsAppText } = await import('@/lib/whatsapp-service');

    // Extract match and prediction data from QuickPurchase (same as handleBuyByMatchId)
    const matchData = whatsappPurchase.quickPurchase.matchData as
      | {
          homeTeam?: { name?: string };
          awayTeam?: { name?: string };
          league?: { name?: string };
          startTime?: string;
        }
      | null;

    const predictionData = whatsappPurchase.quickPurchase.predictionData as any;

    const homeTeam =
      matchData?.homeTeam?.name ||
      whatsappPurchase.quickPurchase.name.split(" vs ")[0] ||
      "Team A";
    const awayTeam =
      matchData?.awayTeam?.name ||
      whatsappPurchase.quickPurchase.name.split(" vs ")[1] ||
      "Team B";
    const market = predictionData?.market || whatsappPurchase.quickPurchase.predictionType || "1X2";
    const tip =
      predictionData?.tip ||
      predictionData?.prediction ||
      whatsappPurchase.quickPurchase.predictionType ||
      "Win";

    // Format the full AI analysis message (same format as direct webhook)
    const message = formatPickDeliveryMessage({
      matchId: whatsappPurchase.quickPurchase.matchId!,
      homeTeam,
      awayTeam,
      market,
      tip,
      confidence: whatsappPurchase.quickPurchase.confidenceScore || 75,
      odds: whatsappPurchase.quickPurchase.odds ? Number(whatsappPurchase.quickPurchase.odds) : undefined,
      valueRating: whatsappPurchase.quickPurchase.valueRating || undefined,
      consensusOdds: undefined, // Not needed since odds removed from analysis message
      isConsensusOdds: false,
      primaryBook: undefined,
      booksCount: undefined,
      predictionData: predictionData,
    });
    
    const result = await sendWhatsAppText(whatsappPurchase.waUser.waId, message);

    if (result.success) {
      console.log('Pick delivered successfully via WhatsApp:', {
        waId: whatsappPurchase.waUser.waId,
        matchId,
      });
    } else {
      console.error('Failed to send pick via WhatsApp:', {
        waId: whatsappPurchase.waUser.waId,
        error: result.error,
      });
    }
  } catch (error) {
    console.error('Error processing WhatsApp purchase completion:', error);
  }
}

async function createUserPackage(userId: string, packageOfferCountryPriceId: string, paymentIntent: Stripe.PaymentIntent) {
  try {
    console.log(`[createUserPackage] Starting for userId: ${userId}, packageOfferCountryPriceId: ${packageOfferCountryPriceId}`);
    
    // First try to find a PackageOfferCountryPrice with this ID
    console.log(`[createUserPackage] Looking for PackageOfferCountryPrice with ID: ${packageOfferCountryPriceId}`);
    const packageOfferCountryPrice = await prisma.packageOfferCountryPrice.findUnique({
      where: { id: packageOfferCountryPriceId },
      include: {
        packageOffer: true
      }
    })

    let tipCount: number
    let validityDays: number
    let packageName: string
    let packageType: string

    // If not found, try to parse as PackageCountryPrice ID (format: countryId_packageType)
    if (!packageOfferCountryPrice) {
      console.log(`[createUserPackage] PackageOfferCountryPrice not found, trying to parse as countryId_packageType: ${packageOfferCountryPriceId}`);
      const parts = packageOfferCountryPriceId.split('_')
      if (parts.length === 2) {
        const [countryId, pkgType] = parts
        console.log(`[createUserPackage] Parsed countryId: ${countryId}, packageType: ${pkgType}`);
        
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
        console.log(`[createUserPackage] Package details - tipCount: ${tipCount}, validityDays: ${validityDays}, packageName: ${packageName}`);

        // Get user's country pricing
        console.log(`[createUserPackage] Getting user country for userId: ${userId}`);
        const user = await prisma.user.findUnique({
          where: { id: userId },
          select: { countryId: true }
        })

        if (!user?.countryId) {
          console.error(`[createUserPackage] User country not found: ${userId}`)
          return null
        }
        console.log(`[createUserPackage] User countryId: ${user.countryId}`);

        console.log(`[createUserPackage] Looking for PackageCountryPrice - countryId: ${user.countryId}, packageType: ${pkgType}`);
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
          console.error(`[createUserPackage] Country price not found for package: ${packageOfferCountryPriceId}`)
          return null
        }
        console.log(`[createUserPackage] Found country price: ${countryPrice.id}, price: ${countryPrice.price}`);

        // Calculate expiration date
        const expiresAt = new Date()
        expiresAt.setDate(expiresAt.getDate() + validityDays)
        console.log(`[createUserPackage] Calculated expiresAt: ${expiresAt.toISOString()}`);

        // Create user package with virtual package offer
        console.log(`[createUserPackage] Creating UserPackage record...`);
        const userPackage = await prisma.userPackage.create({
          data: {
            userId,
            packageOfferCountryPriceId: packageOfferCountryPriceId, // Use the original ID as reference
            expiresAt,
            tipsRemaining: tipCount === -1 ? 0 : tipCount,
            totalTips: tipCount, // Keep -1 for unlimited packages
            pricePaid: countryPrice.price,
            currencyCode: countryPrice.country.currencyCode || 'USD',
            currencySymbol: countryPrice.country.currencySymbol || '$',
            status: 'active'
          }
        })

        console.log(`[createUserPackage] SUCCESS: Created user package: ${userPackage.id} for user: ${userId} (PackageCountryPrice)`)
        return userPackage
      } else {
        console.error(`[createUserPackage] Invalid package ID format: ${packageOfferCountryPriceId}`)
        return null
      }
    }

    // Found PackageOfferCountryPrice record - proceed with original logic
    console.log(`[createUserPackage] Found PackageOfferCountryPrice: ${packageOfferCountryPrice.id}, name: ${packageOfferCountryPrice.packageOffer.name}`);
    tipCount = packageOfferCountryPrice.packageOffer.tipCount
    validityDays = packageOfferCountryPrice.packageOffer.validityDays
    packageName = packageOfferCountryPrice.packageOffer.name
    packageType = packageOfferCountryPrice.packageOffer.packageType
    console.log(`[createUserPackage] PackageOfferCountryPrice details - tipCount: ${tipCount}, validityDays: ${validityDays}, packageType: ${packageType}`);

    // Get user's country pricing
    console.log(`[createUserPackage] Getting user country for userId: ${userId}`);
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { countryId: true }
    })

    if (!user?.countryId) {
      console.error(`[createUserPackage] User country not found: ${userId}`)
      return null
    }
    console.log(`[createUserPackage] User countryId: ${user.countryId}`);

    console.log(`[createUserPackage] Looking for PackageOfferCountryPrice - packageOfferCountryPriceId: ${packageOfferCountryPriceId}, countryId: ${user.countryId}`);
    let countryPrice = await prisma.packageOfferCountryPrice.findFirst({
      where: {
        packageOfferCountryPriceId,
        countryId: user.countryId,
        isActive: true
      }
    })

    // If PackageOfferCountryPrice not found, try to create it from PackageCountryPrice
    if (!countryPrice) {
      console.log(`[createUserPackage] PackageOfferCountryPrice not found, trying to create from PackageCountryPrice for package: ${packageOfferCountryPriceId}`)
      
      const packageCountryPrice = await prisma.packageCountryPrice.findFirst({
        where: {
          countryId: user.countryId,
          packageType: packageOfferCountryPrice.packageOffer.packageType
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
        console.log(`[createUserPackage] Creating PackageOfferCountryPrice from PackageCountryPrice...`);
        countryPrice = await prisma.packageOfferCountryPrice.create({
          data: {
            packageOfferCountryPriceId,
            countryId: user.countryId,
            price: packageCountryPrice.price,
            originalPrice: packageCountryPrice.originalPrice,
            currencyCode: packageCountryPrice.country.currencyCode || 'USD',
            currencySymbol: packageCountryPrice.country.currencySymbol || '$',
            isActive: true
          }
        })
        console.log(`[createUserPackage] Created PackageOfferCountryPrice record: ${countryPrice.id}`)
      } else {
        console.error(`[createUserPackage] Neither PackageOfferCountryPrice nor PackageCountryPrice found for package: ${packageOfferCountryPriceId}`)
        return null
      }
    } else {
      console.log(`[createUserPackage] Found existing PackageOfferCountryPrice: ${countryPrice.id}`);
    }

    // Calculate expiration date
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + packageOfferCountryPrice.packageOffer.validityDays)
    console.log(`[createUserPackage] Calculated expiresAt: ${expiresAt.toISOString()}`);

    // Create user package
    console.log(`[createUserPackage] Creating UserPackage record...`);
    const userPackage = await prisma.userPackage.create({
      data: {
        userId,
        packageOfferCountryPriceId,
        expiresAt,
        tipsRemaining: packageOfferCountryPrice.packageOffer.tipCount === -1 ? 0 : packageOfferCountryPrice.packageOffer.tipCount,
        totalTips: packageOfferCountryPrice.packageOffer.tipCount, // Keep -1 for unlimited packages
        pricePaid: countryPrice.price,
        currencyCode: countryPrice.currencyCode,
        currencySymbol: countryPrice.currencySymbol,
        status: 'active'
      }
    })

    console.log(`[createUserPackage] SUCCESS: Created user package: ${userPackage.id} for user: ${userId} (PackageOfferCountryPrice)`)
    return userPackage
  } catch (error) {
    console.error("[createUserPackage] Error creating user package:", error)
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

// ─────────────────────────────────────────────────────────────────────────────
// Subscription handlers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Handles subscription created / updated events.
 * Syncs the subscription state into the User record and creates / extends a
 * UserPackage row for the monthly_sub plan.
 */
async function handleSubscriptionUpsert(subscription: Stripe.Subscription) {
  const customerId =
    typeof subscription.customer === 'string'
      ? subscription.customer
      : subscription.customer.id;

  // Look up the user by Stripe customer ID
  const user = await prisma.user.findFirst({
    where: { stripeCustomerId: customerId },
  });

  if (!user) {
    // Throw instead of silent-returning so the caller's catch returns 500.
    // Stripe will retry the webhook (up to ~3 days). If the user truly doesn't
    // exist (deleted account), the retries eventually expire and the event
    // lands in Stripe's failed-events log for support review.
    throw new Error(`[handleSubscriptionUpsert] No user found for Stripe customer: ${customerId} (subscription=${subscription.id})`);
  }

  const status = subscription.status; // "active" | "trialing" | "past_due" etc.
  const periodEnd = new Date(subscription.current_period_end * 1000);

  // Update User subscription fields
  await prisma.user.update({
    where: { id: user.id },
    data: {
      stripeSubscriptionId: subscription.id,
      subscriptionStatus: status,
      subscriptionPlan: 'monthly_sub',
      subscriptionExpiresAt: periodEnd,
    },
  });

  // Upsert active UserPackage for monthly sub when subscription is active/trialing
  if (status === 'active' || status === 'trialing') {
    const existing = await prisma.userPackage.findFirst({
      where: { userId: user.id, packageType: 'monthly_sub', status: 'active' },
    });

    if (!existing) {
      await prisma.userPackage.create({
        data: {
          userId: user.id,
          packageOfferCountryPriceId: subscription.id, // use sub ID as ref
          expiresAt: periodEnd,
          tipsRemaining: 0,
          totalTips: -1, // unlimited
          pricePaid: 0,
          currencyCode: 'USD',
          currencySymbol: '$',
          status: 'active',
          packageType: 'monthly_sub',
        },
      });
    } else {
      // Extend expiry on renewal
      await prisma.userPackage.update({
        where: { id: existing.id },
        data: { expiresAt: periodEnd, status: 'active' },
      });
    }

    console.log(`[handleSubscriptionUpsert] User ${user.id} subscription synced → ${status}, expires ${periodEnd.toISOString()}`);
  }
}

/**
 * Handles subscription cancelled / expired event.
 * Marks the UserPackage as expired and clears subscription fields.
 */
async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const customerId =
    typeof subscription.customer === 'string'
      ? subscription.customer
      : subscription.customer.id;

  const user = await prisma.user.findFirst({
    where: { stripeCustomerId: customerId },
  });

  if (!user) {
    // Throw so Stripe retries; otherwise a user could be left with active
    // UserPackage despite their Stripe sub being deleted.
    throw new Error(`[handleSubscriptionDeleted] No user found for Stripe customer: ${customerId} (subscription=${subscription.id})`);
  }

  // Expire all active monthly_sub packages for this user
  await prisma.userPackage.updateMany({
    where: { userId: user.id, packageType: 'monthly_sub', status: 'active' },
    data: { status: 'expired' },
  });

  await prisma.user.update({
    where: { id: user.id },
    data: {
      subscriptionStatus: 'canceled',
      stripeSubscriptionId: null,
    },
  });

  // Notify user
  try {
    const { NotificationService } = await import('@/lib/notification-service');
    await NotificationService.createNotification({
      userId: user.id,
      title: 'Subscription Cancelled',
      message:
        'Your monthly subscription has been cancelled. You can re-subscribe at any time from the packages page.',
      type: 'warning',
      category: 'payment',
      actionUrl: '/dashboard',
    });
  } catch (_err) {
    console.error('[handleSubscriptionDeleted] Failed to notify user', _err);
  }

  console.log(`[handleSubscriptionDeleted] User ${user.id} subscription cancelled`);
}

/**
 * Handles successful recurring invoice payment.
 * Re-activates / extends the UserPackage for another billing cycle and
 * adds the monthly credit allowance back.
 */
async function handleInvoicePaid(invoice: Stripe.Invoice) {
  const subscriptionId =
    typeof invoice.subscription === 'string'
      ? invoice.subscription
      : invoice.subscription?.id ?? null;

  if (!subscriptionId) return; // one-time invoice, not recurring

  const user = await prisma.user.findFirst({
    where: { stripeSubscriptionId: subscriptionId },
  });

  if (!user) {
    // Race: invoice.paid may arrive before customer.subscription.created on the
    // first billing cycle. Throw so Stripe retries; the subscription event will
    // have created the User by the time the retry fires.
    throw new Error(`[handleInvoicePaid] No user found for subscription: ${subscriptionId} (invoice=${invoice.id})`);
  }

  // Update lifetime tracking fields for /admin/users dashboard (subscription
  // renewal path — every successful invoice counts toward LTV).
  try {
    const paidDollars = (invoice.amount_paid ?? 0) / 100;
    if (paidDollars > 0) {
      await prisma.user.update({
        where: { id: user.id },
        data: {
          firstPaidAt: user.firstPaidAt ?? new Date(),
          lastPurchaseAt: new Date(),
          lifetimeValue: { increment: paidDollars },
        },
      });
    }
  } catch (trackErr) {
    console.error('[handleInvoicePaid] Failed to update tracking fields', trackErr);
  }

  // Top up credits for the new billing cycle (150 = unlimited monthly allowance)
  await prisma.user.update({
    where: { id: user.id },
    data: {
      predictionCredits: { increment: 150 },
      totalCreditsEarned: { increment: 150 },
    },
  });

  console.log(`[handleInvoicePaid] Topped up 150 credits for user ${user.id} (recurring billing)`);
}

/**
 * Handles failed recurring invoice payment.
 * Updates subscription status and notifies the user to update payment details.
 */
async function handleInvoicePaymentFailed(invoice: Stripe.Invoice) {
  const subscriptionId =
    typeof invoice.subscription === 'string'
      ? invoice.subscription
      : invoice.subscription?.id ?? null;

  if (!subscriptionId) return;

  const user = await prisma.user.findFirst({
    where: { stripeSubscriptionId: subscriptionId },
  });

  if (!user) {
    // Same race as handleInvoicePaid — let Stripe retry.
    throw new Error(`[handleInvoicePaymentFailed] No user found for subscription: ${subscriptionId} (invoice=${invoice.id})`);
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { subscriptionStatus: 'past_due' },
  });

  try {
    const { NotificationService } = await import('@/lib/notification-service');
    await NotificationService.createNotification({
      userId: user.id,
      title: 'Payment Failed',
      message:
        'Your subscription renewal payment failed. Please update your payment method to keep your premium access.',
      type: 'error',
      category: 'payment',
      actionUrl: '/dashboard/settings',
    });
  } catch (_err) {
    console.error('[handleInvoicePaymentFailed] Failed to notify user', _err);
  }

  console.log(`[handleInvoicePaymentFailed] Payment failed for user ${user.id}, status → past_due`);
}

// ─────────────────────────────────────────────────────────────────────────
// REFUND HANDLER
// Stripe issues `charge.refunded` whenever a refund is created or updated.
// We need to: (1) locate the original PackagePurchase or Subscription, (2)
// reverse credits if applicable, (3) mark the purchase as refunded, and
// (4) notify the user. Idempotent: re-runs are no-ops because we check
// status before mutating.
// ─────────────────────────────────────────────────────────────────────────
async function handleChargeRefunded(charge: Stripe.Charge) {
  const paymentIntentId =
    typeof charge.payment_intent === 'string'
      ? charge.payment_intent
      : charge.payment_intent?.id ?? null;

  console.log(`[handleChargeRefunded] charge=${charge.id} pi=${paymentIntentId} refunded=${charge.amount_refunded}/${charge.amount} ${charge.currency.toUpperCase()}`);

  // Resolve the user via the original PaymentIntent metadata (we always set userId there).
  // This is more reliable than amount-matching across PackagePurchase rows.
  let userId: string | null = null;
  let originalAmount: number | null = null;
  if (paymentIntentId) {
    try {
      const pi = await stripe.paymentIntents.retrieve(paymentIntentId);
      userId = (pi.metadata?.userId as string) ?? null;
      originalAmount = pi.amount;
    } catch (e) {
      console.error('[handleChargeRefunded] Failed to retrieve payment intent', e);
    }
  }

  // Subscription-charge refund path — no userId on PaymentIntent metadata for
  // automatic invoice charges. Fall back to stripeCustomerId.
  if (!userId && charge.customer) {
    const customerId = typeof charge.customer === 'string' ? charge.customer : charge.customer.id;
    const u = await prisma.user.findFirst({
      where: { stripeCustomerId: customerId },
      select: { id: true },
    });
    userId = u?.id ?? null;
  }

  if (!userId) {
    console.error(`[handleChargeRefunded] Could not resolve user for charge=${charge.id} — manual support review required`);
    return;
  }

  // Find the most recent completed PackagePurchase for this user matching the
  // refunded amount, created within 90 days. This is the best signal we have
  // because PackagePurchase doesn't store stripePaymentIntentId (schema gap).
  const candidatePurchases = await prisma.packagePurchase.findMany({
    where: {
      userId,
      status: 'completed',
      createdAt: { gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) },
    },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });

  // Match by amount (in dollars, rounded to 2dp). originalAmount is in cents.
  const targetDollars = originalAmount != null ? originalAmount / 100 : null;
  const matched = targetDollars != null
    ? candidatePurchases.find(pp => Math.abs(Number(pp.amount) - targetDollars) < 0.01)
    : candidatePurchases[0]; // best-effort: most recent if amount unknown

  if (!matched) {
    // Subscription refund (no PackagePurchase row) — log and notify, don't deduct.
    console.warn(`[handleChargeRefunded] No matching PackagePurchase found for user=${userId} amount=${targetDollars} — likely a subscription refund. Notifying user only.`, { chargeId: charge.id });
    try {
      const { NotificationService } = await import('@/lib/notification-service');
      await NotificationService.createNotification({
        userId,
        title: 'Refund Processed',
        message: `A refund of $${(charge.amount_refunded / 100).toFixed(2)} has been processed. It will appear on your statement within 5-10 business days.`,
        type: 'info',
        category: 'payment',
        actionUrl: '/dashboard/settings',
      });
    } catch (e) {
      console.error('[handleChargeRefunded] Failed to notify user', e);
    }
    return;
  }

  // Idempotency — already refunded
  if (matched.status === 'refunded') {
    console.log(`[handleChargeRefunded] PackagePurchase ${matched.id} already refunded — skipping`);
    return;
  }

  // Find the linked UserPackage (created within ~2 min of the PackagePurchase)
  const userPackage = await prisma.userPackage.findFirst({
    where: {
      userId,
      purchasedAt: {
        gte: new Date(matched.createdAt.getTime() - 120_000),
        lte: new Date(matched.createdAt.getTime() + 120_000),
      },
      status: 'active',
    },
    include: { packageOffer: { select: { tipCount: true, name: true } } },
  });

  let creditsDeducted = 0;
  if (userPackage) {
    const granted = userPackage.packageOffer?.tipCount ?? userPackage.totalTips ?? 0;
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { predictionCredits: true } });
    const currentBalance = user?.predictionCredits ?? 0;
    creditsDeducted = Math.min(granted, currentBalance);

    await prisma.$transaction([
      prisma.userPackage.update({
        where: { id: userPackage.id },
        data: { status: 'refunded' },
      }),
      prisma.user.update({
        where: { id: userId },
        data: { predictionCredits: { decrement: creditsDeducted } },
      }),
    ]);
  }

  await prisma.packagePurchase.update({
    where: { id: matched.id },
    data: { status: 'refunded' },
  });

  console.log(`[handleChargeRefunded] Reversed: PackagePurchase ${matched.id} → refunded, credits deducted=${creditsDeducted}, userPackageId=${userPackage?.id ?? 'none'}`);

  try {
    const { NotificationService } = await import('@/lib/notification-service');
    await NotificationService.createNotification({
      userId,
      title: 'Refund Processed',
      message: `Your payment has been refunded.${creditsDeducted > 0 ? ` ${creditsDeducted} credits were deducted from your account.` : ''} Refund will appear on your statement within 5-10 business days.`,
      type: 'info',
      category: 'payment',
      actionUrl: '/dashboard/my-tips',
    });
  } catch (e) {
    console.error('[handleChargeRefunded] Failed to notify user', e);
  }
}

// ─────────────────────────────────────────────────────────────────────────
// DISPUTE HANDLER
// Logs every dispute event verbosely. On `created` and `funds_withdrawn` we
// downgrade the user to free tier so disputed access stops accruing. Once
// the dispute is `closed` and we lost, we keep them downgraded; if we won
// (`charge.dispute.funds_reinstated`), we restore. Notifications are best-
// effort.
// ─────────────────────────────────────────────────────────────────────────
async function handleChargeDispute(dispute: Stripe.Dispute, eventType: string) {
  const chargeId = typeof dispute.charge === 'string' ? dispute.charge : dispute.charge?.id ?? null;
  if (!chargeId) {
    console.warn('[handleChargeDispute] No charge id on dispute — skipping', { disputeId: dispute.id, eventType });
    return;
  }

  // Resolve the affected user. Two paths:
  //  1. PaymentIntent metadata.userId (we set this on every payment we create)
  //  2. Customer → user via stripeCustomerId (fallback)
  // Note: PackagePurchase schema has no stripePaymentIntentId column today,
  // so we resolve through PaymentIntent metadata directly.
  let userId: string | null = null;
  try {
    const charge = await stripe.charges.retrieve(chargeId);
    const paymentIntentId =
      typeof charge.payment_intent === 'string'
        ? charge.payment_intent
        : charge.payment_intent?.id ?? null;

    if (paymentIntentId) {
      try {
        const pi = await stripe.paymentIntents.retrieve(paymentIntentId);
        userId = (pi.metadata?.userId as string) ?? null;
      } catch (piErr) {
        console.error('[handleChargeDispute] Failed to retrieve payment intent', piErr);
      }
    }

    // Fallback: subscription dispute (no metadata.userId on auto invoice charges)
    if (!userId && charge.customer) {
      const customerId = typeof charge.customer === 'string' ? charge.customer : charge.customer.id;
      const u = await prisma.user.findFirst({ where: { stripeCustomerId: customerId }, select: { id: true } });
      userId = u?.id ?? null;
    }
  } catch (e) {
    console.error('[handleChargeDispute] Failed to resolve user from charge', e);
  }

  console.error(`[handleChargeDispute] ${eventType}`, {
    disputeId: dispute.id,
    chargeId,
    userId,
    amount: dispute.amount,
    currency: dispute.currency,
    reason: dispute.reason,
    status: dispute.status,
  });

  // On dispute creation or funds withdrawal: downgrade user immediately to prevent
  // continued premium access during dispute proceedings.
  const shouldDowngrade =
    eventType === 'charge.dispute.created' || eventType === 'charge.dispute.funds_withdrawn';
  // On reinstated (we won): restore. Stripe sends this when the dispute is decided in our favor.
  const shouldRestore = eventType === 'charge.dispute.funds_reinstated';

  if (userId && shouldDowngrade) {
    await prisma.user.update({
      where: { id: userId },
      data: { subscriptionStatus: 'disputed' },
    }).catch(e => console.error('[handleChargeDispute] Failed to flag user as disputed', e));
  }

  if (userId && shouldRestore) {
    await prisma.user.update({
      where: { id: userId },
      data: { subscriptionStatus: 'active' },
    }).catch(e => console.error('[handleChargeDispute] Failed to restore user', e));
  }

  // Notify admin support team via notification (uses an admin-channel category).
  // We do NOT notify the user — disputes are a sensitive financial situation and
  // the user already initiated it; their bank communicates the resolution.
  try {
    const { NotificationService } = await import('@/lib/notification-service');
    // Find an admin to notify, or skip silently if no admin exists
    const admin = await prisma.user.findFirst({ where: { role: 'admin' }, select: { id: true } });
    if (admin) {
      await NotificationService.createNotification({
        userId: admin.id,
        title: `Stripe Dispute: ${eventType}`,
        message: `Dispute ${dispute.id} for $${(dispute.amount / 100).toFixed(2)} ${dispute.currency.toUpperCase()} (${dispute.reason}). Affected user: ${userId ?? 'unknown'}.`,
        type: 'error',
        category: 'admin',
        actionUrl: `/admin/payments?dispute=${dispute.id}`,
      });
    }
  } catch (e) {
    console.error('[handleChargeDispute] Failed to notify admin', e);
  }
}