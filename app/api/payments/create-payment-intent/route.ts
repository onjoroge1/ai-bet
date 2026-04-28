import { NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import prisma from "@/lib/db"
import { authOptions } from "@/lib/auth"
import { stripe, formatAmountForStripe, getStripeCurrency } from "@/lib/stripe-server"
import { getAvailablePaymentMethods, getPaymentMethodConfiguration } from "@/lib/stripe"
import { getDbCountryPricing } from "@/lib/server-pricing-service"

// POST /api/payments/create-payment-intent - Create a payment intent for purchase
export async function POST(request: NextRequest) {
  console.log("🔍 DEBUG: /api/payments/create-payment-intent called")
  
  try {
    // Try to get the authenticated user via NextAuth session
    const session = await getServerSession(authOptions)
    console.log("🔍 DEBUG: Session check - user:", session?.user?.id ? "found" : "not found")

    const body = await request.json()
    console.log("🔍 DEBUG: Request body:", { 
      itemId: body.itemId, 
      itemType: body.itemType, 
      paymentMethod: body.paymentMethod,
      userId: body.userId,
    })
    
    const { 
      itemId, 
      itemType, // 'package' or 'tip'
      paymentMethod,
      userId: bodyUserId,
    } = body

    // Prefer server-side session user, but allow an explicit userId from the client as a fallback.
    // This is primarily to work around local dev/session issues while keeping existing behaviour for real users.
    const userId = session?.user?.id || bodyUserId

    if (!userId) {
      console.log("❌ DEBUG: No authenticated user (session) and no userId in body - returning 401")
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (!itemId || !itemType) {
      console.log("❌ DEBUG: Missing itemId or itemType")
      return NextResponse.json({ error: "Item ID and type are required" }, { status: 400 })
    }

    // Get user's country and currency
    console.log("🔍 DEBUG: Getting user data for:", userId)
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        country: {
          select: {
            code: true,
            currencyCode: true,
            currencySymbol: true
          }
        }
      }
    })

    console.log("🔍 DEBUG: User data:", { 
      userId: user?.id, 
      countryId: user?.countryId, 
      countryCode: user?.country?.code,
      hasCountry: !!user?.country 
    })

    if (!user?.country) {
      console.log("❌ DEBUG: User country not set")
      return NextResponse.json({ error: "User country not set" }, { status: 400 })
    }

    // Block admin users from making payments — they already have full access
    // via role check. Prevents accidental real charges on admin/staff cards.
    if (user.role?.toLowerCase() === 'admin') {
      console.log("ℹ️ Admin user — payment skipped (has full access via role)")
      return NextResponse.json({
        error: "You already have full admin access. No payment needed.",
        code: "ADMIN_HAS_ACCESS",
      }, { status: 409 })
    }

    // Require email verification before paying.
    // Same rule as the subscription checkout — keeps disposable-email signups
    // from completing purchases that we then can't honor disputes against.
    if (!user.emailVerified) {
      console.log("❌ Email not verified for user:", user.id)
      return NextResponse.json({
        error: "Please verify your email address before purchasing. Check your inbox for the verification link.",
        code: "EMAIL_NOT_VERIFIED",
        resendUrl: "/resend-verification",
      }, { status: 403 })
    }

    let amount: number
    let currency: string
    let description: string
    const metadata: any = {
      userId,
      itemType,
      itemId,
      userCountry: user.country.code
    }

    if (itemType === 'package') {
      console.log("🔍 DEBUG: Processing PACKAGE item")
      
      // Parse the itemId to determine if it's a PackageCountryPrice ID or countryId_packageType
      const firstUnderscoreIndex = itemId.indexOf('_')
      if (firstUnderscoreIndex === -1) {
        // It's a direct PackageCountryPrice ID
        console.log("🔍 DEBUG: Treating as direct PackageCountryPrice ID")
        
        const packageCountryPrice = await prisma.packageCountryPrice.findUnique({
          where: { id: itemId },
          include: {
            country: {
              select: {
                currencyCode: true,
                currencySymbol: true
              }
            }
          }
        })

        if (!packageCountryPrice) {
          console.log("❌ DEBUG: PackageCountryPrice not found with ID:", itemId)
          return NextResponse.json({ error: "Package not found" }, { status: 404 })
        }

        console.log("🔍 DEBUG: Found PackageCountryPrice:", {
          id: packageCountryPrice.id,
          packageType: packageCountryPrice.packageType,
          price: packageCountryPrice.price,
          countryId: packageCountryPrice.countryId
        })

        amount = Number(packageCountryPrice.price)
        currency = packageCountryPrice.country.currencyCode || 'USD'
        description = `Purchase: ${packageCountryPrice.packageType} package`
        
        metadata.packageType = packageCountryPrice.packageType
        metadata.packageCountryPriceId = packageCountryPrice.id
        
      } else {
        // It's a countryId_packageType format
        console.log("🔍 DEBUG: Parsing as countryId_packageType format")
        
        const countryId = itemId.substring(0, firstUnderscoreIndex)
        const packageType = itemId.substring(firstUnderscoreIndex + 1)
        
        console.log("🔍 DEBUG: Parsed as countryId_packageType:", { countryId, packageType })
        
        // Find the PackageCountryPrice record directly
        const packageCountryPrice = await prisma.packageCountryPrice.findFirst({
          where: {
            countryId,
            packageType
          }
        })

        if (packageCountryPrice) {
          console.log("🔍 DEBUG: Found PackageCountryPrice:", {
            id: packageCountryPrice.id,
            packageType: packageCountryPrice.packageType,
            price: packageCountryPrice.price,
            countryId: packageCountryPrice.countryId
          })

          amount = Number(packageCountryPrice.price)
          currency = user.country.currencyCode || 'USD'
          description = `Purchase: ${packageCountryPrice.packageType} package`
          
          metadata.packageType = packageCountryPrice.packageType
          metadata.packageCountryPriceId = packageCountryPrice.id
          
        } else {
          console.log("❌ DEBUG: PackageCountryPrice not found for:", { countryId, packageType })
          return NextResponse.json({ error: "Package not found or not available in your country" }, { status: 404 })
        }
      }
    } else if (itemType === 'tip') {
      console.log("🔍 DEBUG: Processing TIP item")
      
      // Get quick purchase item for metadata
      const quickPurchase = await prisma.quickPurchase.findUnique({
        where: { id: itemId },
        include: {
          country: {
            select: {
              currencyCode: true,
              currencySymbol: true
            }
          }
        }
      })

      console.log("🔍 DEBUG: QuickPurchase query result:", {
        found: !!quickPurchase,
        name: quickPurchase?.name,
        price: quickPurchase?.price,
        currencyCode: quickPurchase?.country?.currencyCode
      })

      if (!quickPurchase) {
        console.log("❌ DEBUG: QuickPurchase not found")
        return NextResponse.json({ error: "Item not found" }, { status: 404 })
      }

      // Get correct pricing from PackageCountryPrice table using getDbCountryPricing()
      // This ensures consistency with the initial display pricing
      console.log("🔍 DEBUG: Getting pricing from PackageCountryPrice table via getDbCountryPricing()")
      try {
        const pricingConfig = await getDbCountryPricing(user.country.code, 'prediction')
        console.log("🔍 DEBUG: Pricing config from getDbCountryPricing():", {
          price: pricingConfig.price,
          originalPrice: pricingConfig.originalPrice,
          currencyCode: pricingConfig.currencyCode,
          source: pricingConfig.source
        })
        
        amount = pricingConfig.price
        currency = pricingConfig.currencyCode
        description = `Purchase: ${quickPurchase.name}`
        
        metadata.itemName = quickPurchase.name
        metadata.quickPurchaseType = quickPurchase.type
        metadata.pricingSource = 'PackageCountryPrice'
        
      } catch (error) {
        console.error("❌ DEBUG: Error getting pricing from PackageCountryPrice:", error)
        // Fallback to QuickPurchase price if PackageCountryPrice lookup fails
        console.log("🔍 DEBUG: Falling back to QuickPurchase price")
        amount = Number(quickPurchase.price)
        currency = quickPurchase.country?.currencyCode || 'USD'
        description = `Purchase: ${quickPurchase.name}`
        
        metadata.itemName = quickPurchase.name
        metadata.quickPurchaseType = quickPurchase.type
        metadata.pricingSource = 'QuickPurchase_fallback'
      }
    } else {
      console.log("❌ DEBUG: Invalid item type:", itemType)
      return NextResponse.json({ error: "Invalid item type" }, { status: 400 })
    }

    console.log("🔍 DEBUG: Final values:", { amount, currency, description })
    console.log("🔍 DEBUG: Final metadata:", metadata)

    console.log("🔍 DEBUG: Creating Stripe payment intent with:", { amount, currency, description })
    console.log("🔍 DEBUG: Stripe payment intent metadata:", metadata)
    
    // Create payment intent with automatic payment methods (includes Apple Pay & Google Pay)
    const paymentIntent = await stripe.paymentIntents.create({
      amount: formatAmountForStripe(amount, currency),
      currency: getStripeCurrency(currency),
      description,
      metadata,
      automatic_payment_methods: { 
        enabled: true
      },
      payment_method_options: {
        card: {
          request_three_d_secure: 'automatic'
        }
      },
      receipt_email: user.email,
    })

    console.log("🔍 DEBUG: Payment intent created successfully:", paymentIntent.id)
    console.log("🔍 DEBUG: Payment intent metadata returned:", paymentIntent.metadata)

    return NextResponse.json({
      clientSecret: paymentIntent.client_secret,
      amount,
      currency,
      paymentIntentId: paymentIntent.id
    })
  } catch (error) {
    console.error("❌ DEBUG: Error creating payment intent:", error)
    return NextResponse.json({ error: "Failed to create payment intent" }, { status: 500 })
  }
} 