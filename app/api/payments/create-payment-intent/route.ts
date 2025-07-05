import { NextResponse } from "next/server"
import { getServerSession } from "next-auth"
import prisma from "@/lib/db"
import { authOptions } from "@/lib/auth"
import { stripe, formatAmountForStripe, getStripeCurrency } from "@/lib/stripe-server"
import { getAvailablePaymentMethods, getPaymentMethodConfiguration } from "@/lib/stripe"

// POST /api/payments/create-payment-intent - Create a payment intent for purchase
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = await request.json()
    const { 
      itemId, 
      itemType, // 'package' or 'tip'
      paymentMethod 
    } = body

    if (!itemId || !itemType) {
      return NextResponse.json({ error: "Item ID and type are required" }, { status: 400 })
    }

    // Get user's country and currency
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

    if (!user?.country) {
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
      // First try to find a PackageOffer with this ID
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

      // If not found, try to parse as PackageCountryPrice ID (format: countryId_packageType)
      if (!packageOffer) {
        const parts = itemId.split('_')
        if (parts.length === 2) {
          const [countryId, packageType] = parts
          
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
            return NextResponse.json({ error: "Package not found or not available in your country" }, { status: 404 })
          }
        } else {
          return NextResponse.json({ error: "Invalid package ID format" }, { status: 400 })
        }
      } else {
        // Found PackageOffer record
        if (packageOffer.countryPrices.length === 0) {
          return NextResponse.json({ error: "Package not found or not available in your country" }, { status: 404 })
        }

        const countryPrice = packageOffer.countryPrices[0]
        amount = Number(countryPrice.price)
        currency = countryPrice.currencyCode
        description = `Purchase: ${packageOffer.name}`
        
        metadata.packageName = packageOffer.name
        metadata.packageType = packageOffer.packageType
        metadata.tipCount = packageOffer.tipCount
        metadata.validityDays = packageOffer.validityDays
      }
    } else if (itemType === 'tip') {
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

      if (!quickPurchase) {
        return NextResponse.json({ error: "Item not found" }, { status: 404 })
      }

      amount = Number(quickPurchase.price)
      currency = quickPurchase.country?.currencyCode || 'USD'
      description = `Purchase: ${quickPurchase.name}`
      
      metadata.itemName = quickPurchase.name
      metadata.itemType = quickPurchase.type
    } else {
      return NextResponse.json({ error: "Invalid item type" }, { status: 400 })
    }

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

    // Create payment intent with automatic payment methods
    const paymentIntent = await stripe.paymentIntents.create({
      amount: formatAmountForStripe(amount, currency),
      currency: getStripeCurrency(currency),
      description,
      metadata,
      automatic_payment_methods: { enabled: true },
      receipt_email: user.email,
    })

    return NextResponse.json({
      clientSecret: paymentIntent.client_secret,
      amount,
      currency,
      paymentIntentId: paymentIntent.id,
      availablePaymentMethods: availableMethods
    })
  } catch (error) {
    console.error("Error creating payment intent:", error)
    return NextResponse.json({ error: "Failed to create payment intent" }, { status: 500 })
  }
} 