import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import prisma from "@/lib/db"
import { authOptions } from "@/lib/auth"
import { stripe, formatAmountForStripe, getStripeCurrency } from "@/lib/stripe-server"
import { getAvailablePaymentMethods, getPaymentMethodConfiguration } from "@/lib/stripe"

// POST /api/payments/create-payment-intent - Create a payment intent for purchase
export async function POST(request: Request) {
  console.log("🔍 DEBUG: /api/payments/create-payment-intent called")
  
  try {
    const session = await getServerSession(authOptions)
    console.log("🔍 DEBUG: Session check - user:", session?.user?.id ? "found" : "not found")
    
    if (!session?.user) {
      console.log("❌ DEBUG: No session user - returning 401")
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    console.log("🔍 DEBUG: Request body:", { itemId: body.itemId, itemType: body.itemType, paymentMethod: body.paymentMethod })
    
    const { 
      itemId, 
      itemType, // 'package' or 'tip'
      paymentMethod 
    } = body

    if (!itemId || !itemType) {
      console.log("❌ DEBUG: Missing itemId or itemType")
      return NextResponse.json({ error: "Item ID and type are required" }, { status: 400 })
    }

    // Get user's country and currency
    console.log("🔍 DEBUG: Getting user data for:", session.user.id)
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
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

    let amount: number
    let currency: string
    let description: string
    const metadata: any = {
      userId: session.user.id,
      itemType,
      itemId,
      userCountry: user.country.code
    }

    if (itemType === 'package') {
      console.log("🔍 DEBUG: Processing PACKAGE item")
      
      // First try to find a PackageOffer with this ID
      console.log("🔍 DEBUG: Looking for PackageOffer with ID:", itemId)
      const packageOffer = await prisma.packageOffer.findUnique({
        where: { id: itemId },
        include: {
          countryPrices: {
            where: {
              countryId: user.countryId!,
              isActive: true
            }
          }
        }
      })

      console.log("🔍 DEBUG: PackageOffer query result:", {
        found: !!packageOffer,
        name: packageOffer?.name,
        packageType: packageOffer?.packageType,
        countryPricesCount: packageOffer?.countryPrices?.length || 0,
        userCountryId: user.countryId,
        packageCountryPrices: packageOffer?.countryPrices?.map(cp => ({
          countryId: cp.countryId,
          price: cp.price,
          isActive: cp.isActive
        }))
      })

      // If not found, try to parse as PackageCountryPrice ID (format: countryId_packageType)
      if (!packageOffer) {
        console.log("🔍 DEBUG: PackageOffer not found, trying to parse as countryId_packageType")
        
        // Handle package types with underscores (e.g., "weekend_pass", "weekly_pass", "monthly_sub")
        // The format is: countryId_packageType where packageType can contain underscores
        const firstUnderscoreIndex = itemId.indexOf('_')
        if (firstUnderscoreIndex === -1) {
          console.log("❌ DEBUG: No underscore found in package ID")
          return NextResponse.json({ error: "Invalid package ID format" }, { status: 400 })
        }
        
        const countryId = itemId.substring(0, firstUnderscoreIndex)
        const packageType = itemId.substring(firstUnderscoreIndex + 1)
        
        console.log("🔍 DEBUG: Parsed as countryId_packageType:", { countryId, packageType })
        
        // Find the PackageCountryPrice record
        const countryPrice = await prisma.packageCountryPrice.findFirst({
          where: {
            countryId,
            packageType
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

        if (countryPrice) {
          console.log("🔍 DEBUG: Found PackageCountryPrice:", { price: countryPrice.price, packageType })
          // Create a virtual package offer structure for payment
          amount = Number(countryPrice.price)
          currency = countryPrice.country.currencyCode || 'USD'
          description = `Purchase: ${packageType} Package`
          
          metadata.packageName = packageType
          metadata.packageType = packageType
          metadata.tipCount = 1 // Default, will be updated based on package type
          metadata.validityDays = 1 // Default, will be updated based on package type
          
          // Set tip count and validity based on package type
          switch (packageType) {
            case 'prediction':
              metadata.tipCount = 1
              metadata.validityDays = 1
              break
            case 'weekend_pass':
              metadata.tipCount = 5
              metadata.validityDays = 3
              break
            case 'weekly_pass':
              metadata.tipCount = 8
              metadata.validityDays = 7
              break
            case 'monthly_sub':
              metadata.tipCount = -1 // Unlimited
              metadata.validityDays = 30
              break
            default:
              metadata.tipCount = 1
              metadata.validityDays = 1
          }
        } else {
          console.log("❌ DEBUG: PackageCountryPrice not found for:", { countryId, packageType })
          return NextResponse.json({ error: "Package not found or not available in your country" }, { status: 404 })
        }
      } else {
        console.log("🔍 DEBUG: Found PackageOffer record")
        
        if (packageOffer.countryPrices.length === 0) {
          console.log("❌ DEBUG: PackageOffer found but no country prices for user's country")
          return NextResponse.json({ error: "Package not found or not available in your country" }, { status: 404 })
        }

        const countryPrice = packageOffer.countryPrices[0]
        console.log("🔍 DEBUG: Using country price:", { price: countryPrice.price, currency: countryPrice.currencyCode })
        
        amount = Number(countryPrice.price)
        currency = countryPrice.currencyCode
        description = `Purchase: ${packageOffer.name}`
        
        metadata.packageName = packageOffer.name
        metadata.packageType = packageOffer.packageType
        metadata.tipCount = packageOffer.tipCount
        metadata.validityDays = packageOffer.validityDays
      }
    } else if (itemType === 'tip') {
      console.log("🔍 DEBUG: Processing TIP item")
      
      // Get quick purchase item
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

      amount = Number(quickPurchase.price)
      currency = quickPurchase.country?.currencyCode || 'USD'
      description = `Purchase: ${quickPurchase.name}`
      
      metadata.itemName = quickPurchase.name
      metadata.quickPurchaseType = quickPurchase.type
    } else {
      console.log("❌ DEBUG: Invalid item type:", itemType)
      return NextResponse.json({ error: "Invalid item type" }, { status: 400 })
    }

    console.log("🔍 DEBUG: Final values:", { amount, currency, description })
    console.log("🔍 DEBUG: Final metadata:", metadata)

    // Get payment method configuration for user's country
    const paymentConfig = getPaymentMethodConfiguration(user.country.code)
    const availableMethods = getAvailablePaymentMethods(user.country.code)

    // If a specific payment method is requested, use only that method
    let paymentMethodTypes = paymentConfig.payment_method_types
    if (paymentMethod) {
      // Map the frontend payment method to Stripe payment method types
      switch (paymentMethod) {
        case 'apple_pay':
        case 'google_pay':
          paymentMethodTypes = ['card'] // Both use card as base type
          break
        case 'paypal':
          paymentMethodTypes = ['paypal']
          break
        case 'card':
          paymentMethodTypes = ['card']
          break
        default:
          paymentMethodTypes = ['card'] // Default to card
      }
    }

    console.log("🔍 DEBUG: Creating Stripe payment intent with:", { amount, currency, description })
    console.log("🔍 DEBUG: Stripe payment intent metadata:", metadata)

    // Create payment intent with automatic payment methods
    const paymentIntent = await stripe.paymentIntents.create({
      amount: formatAmountForStripe(amount, currency),
      currency: getStripeCurrency(currency),
      description,
      metadata,
      automatic_payment_methods: { enabled: true },
      receipt_email: user.email,
    })

    console.log("🔍 DEBUG: Payment intent created successfully:", paymentIntent.id)
    console.log("🔍 DEBUG: Payment intent metadata returned:", paymentIntent.metadata)

    return NextResponse.json({
      clientSecret: paymentIntent.client_secret,
      amount,
      currency,
      paymentIntentId: paymentIntent.id,
      availablePaymentMethods: availableMethods
    })
  } catch (error) {
    console.error("❌ DEBUG: Error creating payment intent:", error)
    return NextResponse.json({ error: "Failed to create payment intent" }, { status: 500 })
  }
} 