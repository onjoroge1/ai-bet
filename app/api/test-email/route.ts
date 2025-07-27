import { NextRequest, NextResponse } from 'next/server'
import { EmailService } from '@/lib/email-service'
import { logger } from '@/lib/logger'

export async function POST(req: NextRequest) {
  try {
    const { email, type } = await req.json()
    
    logger.info('[TestEmailAPI] Starting test email send', { email, type })
    
    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 })
    }

    let result: any

    switch (type) {
      case 'payment-confirmation':
        logger.info('[TestEmailAPI] Sending payment confirmation test email')
        result = await EmailService.sendPaymentConfirmation({
          userName: email,
          packageName: 'Test Premium Package',
          amount: 29.99,
          currencySymbol: '$',
          transactionId: 'test_txn_' + Date.now(),
          tipsCount: 5
        })
        break
        
      case 'welcome-email':
        logger.info('[TestEmailAPI] Sending welcome email test')
        result = await EmailService.sendWelcomeEmail({
          to: email,
          userName: 'Test User',
          appUrl: 'https://snapbet.com',
          supportEmail: 'support@snapbet.com'
        })
        break
        
      default:
        return NextResponse.json({ error: 'Invalid email type' }, { status: 400 })
    }

    logger.info('[TestEmailAPI] Test email sent successfully', { result })
    
    return NextResponse.json({
      success: true,
      message: 'Test email sent successfully',
      result
    })
    
  } catch (error) {
    logger.error('[TestEmailAPI] Error sending test email', { error })
    
    return NextResponse.json({
      error: 'Failed to send test email',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
} 