import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import prisma from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const latest = searchParams.get('latest');
    const limit = latest ? 1 : parseInt(searchParams.get('limit') || '10');

    // Get user's package purchases
    const packagePurchases = await prisma.packagePurchase.findMany({
      where: {
        userId: session.user.id,
        status: 'completed'
      },
      include: {
        user: {
          select: {
            country: {
              select: {
                currencySymbol: true,
                currencyCode: true
              }
            }
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: limit
    });

    // Get user packages for additional details
    const userPackages = await prisma.userPackage.findMany({
      where: {
        userId: session.user.id,
        status: 'active'
      },
      include: {
        packageOffer: {
          select: {
            name: true,
            description: true,
            packageType: true,
            tipCount: true,
            validityDays: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      },
      take: limit
    });

    // Combine package purchase data with user package details
    const packages = packagePurchases.map(purchase => {
      const userPackage = userPackages.find(up => 
        up.packageOfferId === purchase.packageOfferId || 
        up.packageOfferId === `${purchase.countryId}_${purchase.packageType}`
      );

      // Determine package details based on package type
      let packageDetails = {
        name: 'Premium Package',
        description: 'AI-powered premium sports predictions',
        tipCount: 1,
        validityDays: 1,
        features: ['AI Analysis', 'Confidence Score', 'Premium Support']
      };

      if (userPackage?.packageOffer) {
        packageDetails = {
          name: userPackage.packageOffer.name,
          description: userPackage.packageOffer.description,
          tipCount: userPackage.packageOffer.tipCount,
          validityDays: userPackage.packageOffer.validityDays,
          features: ['AI Analysis', 'Confidence Score', 'Premium Support', 'Unlimited Access']
        };
      } else {
        // Fallback based on package type
        switch (purchase.packageType) {
          case 'weekend_pass':
            packageDetails = {
              name: 'Weekend Package',
              description: 'Premium tips for the weekend matches',
              tipCount: 5,
              validityDays: 3,
              features: ['5 Premium Tips', 'Weekend Coverage', 'AI Analysis', 'Confidence Score']
            };
            break;
          case 'weekly_pass':
            packageDetails = {
              name: 'Weekly Package',
              description: 'Full week of premium sports predictions',
              tipCount: 8,
              validityDays: 7,
              features: ['8 Premium Tips', 'Weekly Coverage', 'AI Analysis', 'Confidence Score']
            };
            break;
          case 'monthly_sub':
            packageDetails = {
              name: 'Monthly Subscription',
              description: 'Unlimited premium tips for a full month',
              tipCount: -1,
              validityDays: 30,
              features: ['Unlimited Tips', 'Monthly Coverage', 'AI Analysis', 'Confidence Score', 'Priority Support']
            };
            break;
        }
      }

      // Calculate credits gained (1 credit per tip, 1000 for unlimited)
      const creditsGained = packageDetails.tipCount === -1 ? 1000 : packageDetails.tipCount;

      return {
        id: purchase.id,
        purchaseId: purchase.id,
        name: packageDetails.name,
        type: 'package',
        price: Number(purchase.amount),
        amount: Number(purchase.amount),
        description: packageDetails.description,
        features: packageDetails.features,
        currencySymbol: purchase.user?.country?.currencySymbol || '$',
        currencyCode: purchase.user?.country?.currencyCode || 'USD',
        purchaseDate: purchase.createdAt.toISOString(),
        paymentMethod: purchase.paymentMethod,
        packageType: purchase.packageType,
        creditsGained,
        tipsIncluded: packageDetails.tipCount,
        validityDays: packageDetails.validityDays,
        expiresAt: userPackage?.expiresAt?.toISOString(),
        status: purchase.status
      };
    });

    return NextResponse.json({
      packages,
      total: packages.length
    });

  } catch (error) {
    console.error('Error fetching package purchases:', error);
    return NextResponse.json(
      { error: 'Failed to fetch package purchases' },
      { status: 500 }
    );
  }
} 