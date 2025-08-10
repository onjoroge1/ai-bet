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