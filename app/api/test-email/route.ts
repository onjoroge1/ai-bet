import { NextRequest, NextResponse } from 'next/server'
import { EmailService } from '@/lib/email-service'
import { logger } from '@/lib/logger'

// Define proper types for email service results
interface EmailServiceResult {
  success: boolean
  messageId?: string
  error?: string | Error
}

export async function POST(req: NextRequest) {
  try {
    const { email, type } = await req.json()
    
    logger.info('[TestEmailAPI] Starting test email send', { email, type })
    
    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 })
    }

    let result: EmailServiceResult

    switch (type) {
      case 'payment-confirmation':
        logger.info('[TestEmailAPI] Sending payment confirmation test email')
        result = await EmailService.sendPaymentConfirmation({
          to: email, // Add the missing 'to' field
          userName: email,
          packageName: 'Test Premium Package',
          amount: 29.99,
          currencySymbol: '$',
          transactionId: 'test_txn_' + Date.now(),
          tipsCount: 5
        })
        break
        
      case 'tip-purchase-confirmation':
        logger.info('[TestEmailAPI] Sending tip purchase confirmation test email')
        result = await EmailService.sendTipPurchaseConfirmation({
          amount: 4.99,
          tipName: 'Premium Tip - Manchester United vs Liverpool',
          matchDetails: 'Manchester United vs Liverpool - Premier League',
          prediction: 'Manchester United to win',
          confidence: 85,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          transactionId: 'test_txn_' + Date.now(),
          currencySymbol: '$',
          userName: 'Test User',
          userEmail: email,
          currency: 'USD',
          appUrl: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
        })
        break
        
      case 'credit-claim-confirmation':
        logger.info('[TestEmailAPI] Sending credit claim confirmation test email')
        result = await EmailService.sendCreditClaimConfirmation({
          tipName: 'Premium Tip - Arsenal vs Chelsea',
          matchDetails: 'Arsenal vs Chelsea - Premier League',
          prediction: 'Arsenal to win',
          confidence: 80,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          creditsUsed: 1,
          creditsRemaining: 5,
          userName: 'Test User',
          userEmail: email,
          appUrl: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
        })
        break
        
      case 'password-reset':
        logger.info('[TestEmailAPI] Sending password reset test email')
        result = await EmailService.sendPasswordResetEmail({
          to: email,
          userName: 'Test User',
          resetToken: 'test_reset_token_' + Date.now(),
          appUrl: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
        })
        break
        
      case 'email-verification':
        logger.info('[TestEmailAPI] Sending email verification test email')
        result = await EmailService.sendEmailVerification({
          to: email,
          userName: 'Test User',
          verificationToken: 'test_verification_token_' + Date.now(),
          appUrl: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
        })
        break
        
      case 'prediction-alert':
        logger.info('[TestEmailAPI] Sending prediction alert test email')
        result = await EmailService.sendPredictionAlert({
          to: email, // Add the missing 'to' field
          userName: email,
          predictions: [
            {
              match: 'Manchester United vs Liverpool',
              prediction: 'Manchester United to win',
              confidence: 85,
              odds: 2.10,
              matchTime: 'Today 3:00 PM'
            },
            {
              match: 'Arsenal vs Chelsea',
              prediction: 'Arsenal to win',
              confidence: 82,
              odds: 1.95,
              matchTime: 'Tomorrow 2:00 PM'
            }
          ]
        })
        break
        
      case 'daily-digest':
        logger.info('[TestEmailAPI] Sending daily digest test email')
        result = await EmailService.sendDailyDigest({
          to: email, // Add the missing 'to' field
          userName: email,
          newPredictions: 5,
          topPredictions: [
            {
              match: 'Manchester United vs Liverpool',
              prediction: 'Manchester United to win',
              confidence: 85
            },
            {
              match: 'Arsenal vs Chelsea',
              prediction: 'Arsenal to win',
              confidence: 82
            }
          ],
          recentResults: [
            { match: 'Liverpool vs Everton', result: 'Liverpool won', isWin: true },
            { match: 'Chelsea vs Tottenham', result: 'Chelsea lost', isWin: false }
          ],
          unreadNotifications: 3
        })
        break
        
      case 'achievement':
        logger.info('[TestEmailAPI] Sending achievement test email')
        result = await EmailService.sendAchievementNotification({
          to: email, // Add the missing 'to' field
          userName: email,
          achievementName: 'First Win',
          description: 'You won your first prediction!',
          points: 100
        })
        break
        
      case 'referral-bonus':
        logger.info('[TestEmailAPI] Sending referral bonus test email')
        // For referral bonus, we'll use a generic notification since it's not implemented yet
        result = await EmailService.sendSecurityNotification(
          email,
          'Test User',
          'Referral Bonus Earned!',
          'Jane Smith joined using your referral code! You\'ve earned $10.00 bonus!'
        )
        break
        
      default:
        return NextResponse.json(
          { error: 'Invalid email type' },
          { status: 400 }
        )
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