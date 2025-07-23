import { Resend } from 'resend'
import { logger } from '@/lib/logger'

const resend = new Resend(process.env.RESEND_API_KEY)

export interface EmailNotificationData {
  to: string
  subject: string
  template: 'payment-confirmation' | 'prediction-alert' | 'daily-digest' | 'achievement' | 'security' | 'welcome-email'
  data: Record<string, any>
}

export interface PaymentConfirmationData {
  amount: number
  packageName: string
  transactionId: string
  userName: string
  tipsCount: number
}

export interface PredictionAlertData {
  userName: string
  predictions: Array<{
    match: string
    prediction: string
    confidence: number
    odds: number
    matchTime: string
  }>
}

export interface DailyDigestData {
  userName: string
  newPredictions: number
  topPredictions: Array<{
    match: string
    prediction: string
    confidence: number
  }>
  recentResults: Array<{
    match: string
    result: string
    isWin: boolean
  }>
  unreadNotifications: number
}

export interface AchievementData {
  userName: string
  achievementName: string
  description: string
  points?: number
}

export class EmailService {
  /**
   * Send welcome email to new users
   */
  static async sendWelcomeEmail(data: {
    to: string
    userName: string
    appUrl?: string
    supportEmail?: string
  }) {
    try {
      // Try to use the email template system first
      const { EmailTemplateService } = await import('@/lib/email-template-service')
      
      // Check if welcome email template exists
      const template = await EmailTemplateService.getTemplateBySlug('welcome-email')
      
      if (template && template.isActive) {
        // Use the template system
        const renderedEmail = await EmailTemplateService.renderTemplate('welcome-email', {
          userName: data.userName,
          appUrl: data.appUrl || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
          supportEmail: data.supportEmail || 'support@snapbet.com'
        })
        
        return this.sendEmail({
          to: data.to,
          subject: renderedEmail.subject,
          template: 'welcome-email',
          data: {
            userName: data.userName,
            appUrl: data.appUrl,
            supportEmail: data.supportEmail
          },
        }, renderedEmail.html)
      }
    } catch (error) {
      // Fall back to hardcoded template if template system fails
      logger.warn('Failed to use email template system, falling back to hardcoded template', {
        error: error as Error,
        data: { email: data.to }
      })
    }

    // Fallback hardcoded template
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #8b5cf6, #7c3aed); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="margin: 0; font-size: 28px;">Welcome to SnapBet! 🎉</h1>
          <p style="margin: 10px 0 0 0; opacity: 0.9;">Your journey to smarter sports predictions starts now</p>
        </div>
        
        <div style="background: white; padding: 30px; border-radius: 0 0 10px 10px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <h2 style="color: #374151; margin-top: 0;">Hi ${data.userName},</h2>
          
          <p style="color: #6b7280; line-height: 1.6;">
            Welcome to SnapBet! We're excited to have you join our community of sports prediction enthusiasts. 
            You're now part of a platform that combines AI-powered insights with expert analysis to help you 
            make informed betting decisions.
          </p>
          
          <div style="background: #f0f9ff; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #0ea5e9;">
            <h3 style="color: #374151; margin-top: 0;">🚀 What's Next?</h3>
            <ul style="color: #6b7280; line-height: 1.8;">
              <li>Explore our daily free tips</li>
              <li>Check out premium prediction packages</li>
              <li>Take our quiz to earn credits</li>
              <li>Join our community discussions</li>
            </ul>
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${data.appUrl || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/dashboard" 
               style="background: #8b5cf6; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">
              Get Started
            </a>
          </div>
          
          <p style="color: #6b7280; line-height: 1.6;">
            We're committed to providing you with the best possible experience. If you have any questions or 
            need assistance, our support team is here to help.
          </p>
          
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
          
          <p style="color: #9ca3af; font-size: 14px; text-align: center;">
            Need help? Contact us at ${data.supportEmail || 'support@snapbet.com'}<br>
            © 2024 SnapBet. All rights reserved.
          </p>
        </div>
      </div>
    `

    return this.sendEmail({
      to: data.to,
      subject: `Welcome to SnapBet, ${data.userName}! 🎉`,
      template: 'welcome-email',
      data,
    }, html)
  }

  /**
   * Send payment confirmation email
   */
  static async sendPaymentConfirmation(data: PaymentConfirmationData) {
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #10b981, #059669); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="margin: 0; font-size: 28px;">Payment Confirmed! 🎉</h1>
          <p style="margin: 10px 0 0 0; opacity: 0.9;">Your SnapBet purchase was successful</p>
        </div>
        
        <div style="background: white; padding: 30px; border-radius: 0 0 10px 10px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <h2 style="color: #374151; margin-top: 0;">Hi ${data.userName},</h2>
          
          <p style="color: #6b7280; line-height: 1.6;">
            Thank you for your purchase! Your payment has been processed successfully.
          </p>
          
          <div style="background: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="color: #374151; margin-top: 0;">Purchase Details</h3>
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
              <div>
                <strong style="color: #6b7280;">Package:</strong><br>
                <span style="color: #374151;">${data.packageName}</span>
              </div>
              <div>
                <strong style="color: #6b7280;">Amount:</strong><br>
                <span style="color: #374151;">$${data.amount.toFixed(2)}</span>
              </div>
              <div>
                <strong style="color: #6b7280;">Tips Included:</strong><br>
                <span style="color: #374151;">${data.tipsCount} premium tips</span>
              </div>
              <div>
                <strong style="color: #6b7280;">Transaction ID:</strong><br>
                <span style="color: #374151; font-family: monospace;">${data.transactionId}</span>
              </div>
            </div>
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${process.env.NEXT_PUBLIC_APP_URL}/dashboard/my-tips" 
               style="background: #10b981; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">
              View Your Tips
            </a>
          </div>
          
          <p style="color: #6b7280; line-height: 1.6;">
            Your premium tips are now available in your dashboard. Start making informed predictions and maximize your winning potential!
          </p>
          
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
          
          <p style="color: #9ca3af; font-size: 14px; text-align: center;">
            If you have any questions, please contact our support team.<br>
            © 2024 SnapBet. All rights reserved.
          </p>
        </div>
      </div>
    `

    return this.sendEmail({
      to: data.userName, // This should be the email address
      subject: `Payment Confirmed - ${data.packageName}`,
      template: 'payment-confirmation',
      data,
    }, html)
  }

  /**
   * Send high-confidence prediction alert
   */
  static async sendPredictionAlert(data: PredictionAlertData) {
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #3b82f6, #1d4ed8); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="margin: 0; font-size: 28px;">⚽ High-Confidence Predictions Alert</h1>
          <p style="margin: 10px 0 0 0; opacity: 0.9;">Don't miss these premium opportunities</p>
        </div>
        
        <div style="background: white; padding: 30px; border-radius: 0 0 10px 10px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <h2 style="color: #374151; margin-top: 0;">Hi ${data.userName},</h2>
          
          <p style="color: #6b7280; line-height: 1.6;">
            We've identified ${data.predictions.length} high-confidence prediction${data.predictions.length > 1 ? 's' : ''} that match your preferences. 
            These opportunities have been carefully analyzed and show strong potential.
          </p>
          
          ${data.predictions.map((pred, index) => `
            <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #3b82f6;">
              <h3 style="color: #374151; margin-top: 0;">${pred.match}</h3>
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin: 15px 0;">
                <div>
                  <strong style="color: #6b7280;">Prediction:</strong><br>
                  <span style="color: #374151; font-weight: bold;">${pred.prediction}</span>
                </div>
                <div>
                  <strong style="color: #6b7280;">Confidence:</strong><br>
                  <span style="color: #10b981; font-weight: bold;">${pred.confidence}%</span>
                </div>
                <div>
                  <strong style="color: #6b7280;">Odds:</strong><br>
                  <span style="color: #374151;">${pred.odds}</span>
                </div>
                <div>
                  <strong style="color: #6b7280;">Match Time:</strong><br>
                  <span style="color: #374151;">${pred.matchTime}</span>
                </div>
              </div>
            </div>
          `).join('')}
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${process.env.NEXT_PUBLIC_APP_URL}/dashboard/predictions" 
               style="background: #3b82f6; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">
              View All Predictions
            </a>
          </div>
          
          <p style="color: #6b7280; line-height: 1.6;">
            Remember to always bet responsibly and never risk more than you can afford to lose.
          </p>
          
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
          
          <p style="color: #9ca3af; font-size: 14px; text-align: center;">
            You can manage your email preferences in your account settings.<br>
            © 2024 SnapBet. All rights reserved.
          </p>
        </div>
      </div>
    `

    return this.sendEmail({
      to: data.userName, // This should be the email address
      subject: `⚽ ${data.predictions.length} High-Confidence Prediction${data.predictions.length > 1 ? 's' : ''} Available`,
      template: 'prediction-alert',
      data,
    }, html)
  }

  /**
   * Send daily digest email
   */
  static async sendDailyDigest(data: DailyDigestData) {
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #8b5cf6, #7c3aed); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="margin: 0; font-size: 28px;">📊 Your Daily SnapBet Digest</h1>
          <p style="margin: 10px 0 0 0; opacity: 0.9;">${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
        </div>
        
        <div style="background: white; padding: 30px; border-radius: 0 0 10px 10px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <h2 style="color: #374151; margin-top: 0;">Hi ${data.userName},</h2>
          
          <p style="color: #6b7280; line-height: 1.6;">
            Here's your daily summary of what's happening on SnapBet.
          </p>
          
          <div style="background: #f0f9ff; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #0ea5e9;">
            <h3 style="color: #374151; margin-top: 0;">📈 New Predictions</h3>
            <p style="color: #6b7280; margin: 10px 0;">
              We've added <strong>${data.newPredictions} new prediction${data.newPredictions !== 1 ? 's' : ''}</strong> to our platform today.
            </p>
          </div>
          
          ${data.topPredictions.length > 0 ? `
            <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3 style="color: #374151; margin-top: 0;">🏆 Top Predictions Today</h3>
              ${data.topPredictions.map((pred, index) => `
                <div style="padding: 10px 0; border-bottom: 1px solid #e5e7eb; ${index === data.topPredictions.length - 1 ? 'border-bottom: none;' : ''}">
                  <div style="font-weight: bold; color: #374151;">${pred.match}</div>
                  <div style="color: #6b7280; font-size: 14px;">
                    ${pred.prediction} • ${pred.confidence}% confidence
                  </div>
                </div>
              `).join('')}
            </div>
          ` : ''}
          
          ${data.recentResults.length > 0 ? `
            <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3 style="color: #374151; margin-top: 0;">📊 Recent Results</h3>
              ${data.recentResults.map((result, index) => `
                <div style="padding: 10px 0; border-bottom: 1px solid #e5e7eb; ${index === data.recentResults.length - 1 ? 'border-bottom: none;' : ''}">
                  <div style="font-weight: bold; color: #374151;">${result.match}</div>
                  <div style="color: ${result.isWin ? '#10b981' : '#ef4444'}; font-size: 14px;">
                    ${result.result} ${result.isWin ? '✅' : '❌'}
                  </div>
                </div>
              `).join('')}
            </div>
          ` : ''}
          
          ${data.unreadNotifications > 0 ? `
            <div style="background: #fef3c7; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f59e0b;">
              <h3 style="color: #374151; margin-top: 0;">🔔 Notifications</h3>
              <p style="color: #6b7280; margin: 10px 0;">
                You have <strong>${data.unreadNotifications} unread notification${data.unreadNotifications !== 1 ? 's' : ''}</strong>.
              </p>
            </div>
          ` : ''}
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${process.env.NEXT_PUBLIC_APP_URL}/dashboard" 
               style="background: #8b5cf6; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">
              Go to Dashboard
            </a>
          </div>
          
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
          
          <p style="color: #9ca3af; font-size: 14px; text-align: center;">
            You can manage your email preferences in your account settings.<br>
            © 2024 SnapBet. All rights reserved.
          </p>
        </div>
      </div>
    `

    return this.sendEmail({
      to: data.userName, // This should be the email address
      subject: `📊 Your Daily SnapBet Digest - ${data.newPredictions} New Predictions`,
      template: 'daily-digest',
      data,
    }, html)
  }

  /**
   * Send achievement notification email
   */
  static async sendAchievementNotification(data: AchievementData) {
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #f59e0b, #d97706); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="margin: 0; font-size: 28px;">🏆 Achievement Unlocked!</h1>
          <p style="margin: 10px 0 0 0; opacity: 0.9;">Congratulations on your success</p>
        </div>
        
        <div style="background: white; padding: 30px; border-radius: 0 0 10px 10px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <h2 style="color: #374151; margin-top: 0;">Hi ${data.userName},</h2>
          
          <div style="text-align: center; margin: 30px 0;">
            <div style="font-size: 48px; margin-bottom: 20px;">🏆</div>
            <h3 style="color: #374151; margin: 10px 0;">${data.achievementName}</h3>
            <p style="color: #6b7280; line-height: 1.6;">${data.description}</p>
            ${data.points ? `
              <div style="background: #fef3c7; padding: 15px; border-radius: 8px; margin: 20px 0; display: inline-block;">
                <strong style="color: #d97706;">+${data.points} Points Earned!</strong>
              </div>
            ` : ''}
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${process.env.NEXT_PUBLIC_APP_URL}/dashboard" 
               style="background: #f59e0b; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">
              View Your Achievements
            </a>
          </div>
          
          <p style="color: #6b7280; line-height: 1.6; text-align: center;">
            Keep up the great work! Your dedication to making informed predictions is paying off.
          </p>
          
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
          
          <p style="color: #9ca3af; font-size: 14px; text-align: center;">
            You can manage your email preferences in your account settings.<br>
            © 2024 SnapBet. All rights reserved.
          </p>
        </div>
      </div>
    `

    return this.sendEmail({
      to: data.userName, // This should be the email address
      subject: `🏆 Achievement Unlocked: ${data.achievementName}`,
      template: 'achievement',
      data,
    }, html)
  }

  /**
   * Send security notification email
   */
  static async sendSecurityNotification(to: string, userName: string, event: string, details: string) {
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #ef4444, #dc2626); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
          <h1 style="margin: 0; font-size: 28px;">🔒 Security Alert</h1>
          <p style="margin: 10px 0 0 0; opacity: 0.9;">Important account security information</p>
        </div>
        
        <div style="background: white; padding: 30px; border-radius: 0 0 10px 10px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <h2 style="color: #374151; margin-top: 0;">Hi ${userName},</h2>
          
          <div style="background: #fef2f2; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ef4444;">
            <h3 style="color: #374151; margin-top: 0;">${event}</h3>
            <p style="color: #6b7280; line-height: 1.6;">${details}</p>
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${process.env.NEXT_PUBLIC_APP_URL}/dashboard/settings" 
               style="background: #ef4444; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">
              Review Account Settings
            </a>
          </div>
          
          <p style="color: #6b7280; line-height: 1.6;">
            If this wasn't you, please contact our support team immediately and consider changing your password.
          </p>
          
          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
          
          <p style="color: #9ca3af; font-size: 14px; text-align: center;">
            This is an important security notification and cannot be disabled.<br>
            © 2024 SnapBet. All rights reserved.
          </p>
        </div>
      </div>
    `

    return this.sendEmail({
      to,
      subject: `🔒 Security Alert: ${event}`,
      template: 'security',
      data: { userName, event, details },
    }, html)
  }

  /**
   * Generic email sending method
   */
  private static async sendEmail(emailData: EmailNotificationData, html: string) {
    try {
      if (!process.env.RESEND_API_KEY) {
        logger.warn('RESEND_API_KEY not configured, skipping email send', {
          data: { template: emailData.template, to: emailData.to }
        })
        return { success: false, error: 'Email service not configured' }
      }

      const result = await resend.emails.send({
        from: process.env.FROM_EMAIL || 'notifications@snapbet.com',
        to: emailData.to,
        subject: emailData.subject,
        html,
      })

      logger.info('Email sent successfully', {
        data: {
          template: emailData.template,
          to: emailData.to,
          messageId: result.data?.id,
        }
      })

      return { success: true, messageId: result.data?.id }
    } catch (error) {
      logger.error('Failed to send email', {
        error: error as Error,
        data: { template: emailData.template, to: emailData.to }
      })
      return { success: false, error: error as Error }
    }
  }
}