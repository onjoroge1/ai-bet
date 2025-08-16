import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/db'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email } = body

    if (!email || !email.includes('@')) {
      return NextResponse.json(
        { success: false, error: 'Valid email is required' },
        { status: 400 }
      )
    }

    // Check if email already exists
    const existingSubscription = await prisma.newsletterSubscription.findUnique({
      where: { email }
    })

    if (existingSubscription) {
      return NextResponse.json(
        { success: false, error: 'Email already subscribed' },
        { status: 400 }
      )
    }

    // Create new subscription
    const subscription = await prisma.newsletterSubscription.create({
      data: {
        email,
        isActive: true,
        subscribedAt: new Date()
      }
    })

    return NextResponse.json({
      success: true,
      message: 'Successfully subscribed to newsletter',
      data: subscription
    })
  } catch (error) {
    console.error('[Newsletter] Subscribe Error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to subscribe to newsletter' },
      { status: 500 }
    )
  }
}
