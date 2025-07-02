import prisma from '@/lib/db'
import { logger } from '@/lib/logger'
import { EmailService } from '@/lib/email-service'

export interface CreateNotificationData {
  userId: string
  title: string
  message: string
  type: 'info' | 'success' | 'warning' | 'error' | 'prediction' | 'payment' | 'achievement'
  category: 'system' | 'prediction' | 'payment' | 'achievement' | 'marketing'
  actionUrl?: string
  metadata?: Record<string, any>
  expiresAt?: Date
}

export interface NotificationTemplate {
  title: string
  message: string
  type: string
  category: string
  variables: string[]
}

export class NotificationService {
  /**
   * Create a notification for a user
   */
  static async createNotification(data: CreateNotificationData) {
    try {
      // Check if user has notifications enabled (default to true for now)
      const user = await prisma.user.findUnique({
        where: { id: data.userId },
        select: { id: true },
      })

      if (!user) {
        logger.info('User not found for notification', { data: { userId: data.userId } })
        return null
      }

      // For now, we'll create notifications regardless of settings
      // TODO: Add notification preferences check once schema is updated
      const notification = await prisma.userNotification.create({
        data: {
          userId: data.userId,
          title: data.title,
          message: data.message,
          type: data.type,
          category: data.category,
          actionUrl: data.actionUrl,
          metadata: data.metadata,
          expiresAt: data.expiresAt,
        },
      })

      logger.info('Notification created', {
        data: {
          notificationId: notification.id,
          userId: data.userId,
          type: data.type,
          category: data.category,
        }
      })

      return notification
    } catch (error) {
      logger.error('Failed to create notification', {
        error: error as Error,
        data: { userId: data.userId },
      })
      throw error
    }
  }

  /**
   * Create a prediction result notification
   */
  static async createPredictionResultNotification(
    userId: string,
    predictionId: string,
    matchId: string,
    isWin: boolean,
    stakeAmount: number,
    actualReturn?: number
  ) {
    const title = isWin ? '🎉 Prediction Won!' : '❌ Prediction Lost'
    const message = isWin
      ? `Your prediction won! You earned $${actualReturn?.toFixed(2) || '0.00'} from your $${stakeAmount.toFixed(2)} stake.`
      : `Your prediction didn't work out this time. Keep analyzing and try again!`

    return this.createNotification({
      userId,
      title,
      message,
      type: isWin ? 'success' : 'info',
      category: 'prediction',
      actionUrl: `/dashboard/predictions`,
      metadata: {
        predictionId,
        matchId,
        isWin,
        stakeAmount,
        actualReturn,
      },
    })
  }

  /**
   * Create a new prediction available notification
   */
  static async createNewPredictionNotification(
    userId: string,
    predictionId: string,
    matchId: string,
    predictionType: string,
    confidenceScore: number
  ) {
    return this.createNotification({
      userId,
      title: '⚽ New Prediction Available',
      message: `A new ${predictionType} prediction with ${confidenceScore}% confidence is ready for you!`,
      type: 'prediction',
      category: 'prediction',
      actionUrl: `/dashboard/predictions`,
      metadata: {
        predictionId,
        matchId,
        predictionType,
        confidenceScore,
      },
    })
  }

  /**
   * Create a payment success notification
   */
  static async createPaymentSuccessNotification(
    userId: string,
    amount: number,
    packageName: string
  ) {
    // Get user email for email notification
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, fullName: true },
    })

    const notification = await this.createNotification({
      userId,
      title: '💳 Payment Successful',
      message: `Your payment of $${amount.toFixed(2)} for ${packageName} was successful. Your tips are now available!`,
      type: 'success',
      category: 'payment',
      actionUrl: `/dashboard/my-tips`,
      metadata: {
        amount,
        packageName,
      },
    })

    // Send email notification for payment confirmation
    if (user?.email) {
      try {
        await EmailService.sendPaymentConfirmation({
          amount,
          packageName,
          transactionId: `TXN-${Date.now()}`,
          userName: user.email, // Email address
          tipsCount: 5, // This should come from the package data
        })
        logger.info('Payment confirmation email sent', {
          data: { userId, email: user.email, amount, packageName }
        })
      } catch (error) {
        logger.error('Failed to send payment confirmation email', {
          error: error as Error,
          data: { userId, email: user.email }
        })
      }
    }

    return notification
  }

  /**
   * Create an achievement notification
   */
  static async createAchievementNotification(
    userId: string,
    achievementName: string,
    description: string,
    points?: number
  ) {
    // Get user email for email notification
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, fullName: true },
    })

    const message = points
      ? `Congratulations! You've earned the "${achievementName}" achievement and ${points} points!`
      : `Congratulations! You've earned the "${achievementName}" achievement!`

    const notification = await this.createNotification({
      userId,
      title: '🏆 Achievement Unlocked!',
      message,
      type: 'achievement',
      category: 'achievement',
      actionUrl: `/dashboard/achievements`,
      metadata: {
        achievementName,
        points,
      },
    })

    // Send email notification for achievements
    if (user?.email) {
      try {
        await EmailService.sendAchievementNotification({
          userName: user.email, // Email address
          achievementName,
          description,
          points,
        })
        logger.info('Achievement email sent', {
          data: { userId, email: user.email, achievementName }
        })
      } catch (error) {
        logger.error('Failed to send achievement email', {
          error: error as Error,
          data: { userId, email: user.email }
        })
      }
    }

    return notification
  }

  /**
   * Create a win streak notification
   */
  static async createWinStreakNotification(
    userId: string,
    streakCount: number
  ) {
    const messages = {
      3: '🔥 You\'re on fire! 3 wins in a row!',
      5: '🔥🔥 Amazing! 5 wins in a row!',
      10: '🔥🔥🔥 Legendary! 10 wins in a row!',
      15: '🔥🔥🔥🔥 Unstoppable! 15 wins in a row!',
      20: '🔥🔥🔥🔥🔥 GOD MODE! 20 wins in a row!',
    }

    const message = messages[streakCount as keyof typeof messages] || `Great job! ${streakCount} wins in a row!`

    return this.createNotification({
      userId,
      title: '🔥 Win Streak!',
      message,
      type: 'achievement',
      category: 'achievement',
      actionUrl: `/dashboard`,
      metadata: {
        streakCount,
      },
    })
  }

  /**
   * Create a referral bonus notification
   */
  static async createReferralBonusNotification(
    userId: string,
    referredUserName: string,
    bonusAmount: number
  ) {
    return this.createNotification({
      userId,
      title: '👥 Referral Bonus!',
      message: `${referredUserName} joined using your referral code! You've earned $${bonusAmount.toFixed(2)} bonus!`,
      type: 'success',
      category: 'achievement',
      actionUrl: `/dashboard/referrals`,
      metadata: {
        referredUserName,
        bonusAmount,
      },
    })
  }

  /**
   * Create a system maintenance notification
   */
  static async createSystemMaintenanceNotification(
    userId: string,
    maintenanceTime: string,
    duration: string
  ) {
    return this.createNotification({
      userId,
      title: '🔧 Scheduled Maintenance',
      message: `We'll be performing maintenance on ${maintenanceTime} for ${duration}. Services may be temporarily unavailable.`,
      type: 'warning',
      category: 'system',
      metadata: {
        maintenanceTime,
        duration,
      },
    })
  }

  /**
   * Create a welcome notification for new users
   */
  static async createWelcomeNotification(userId: string, userName: string) {
    return this.createNotification({
      userId,
      title: '🎉 Welcome to SnapBet!',
      message: `Hi ${userName}! Welcome to the ultimate sports prediction platform. Start exploring our AI-powered predictions!`,
      type: 'info',
      category: 'system',
      actionUrl: `/dashboard`,
      metadata: {
        userName,
      },
    })
  }

  /**
   * Create a package expiration reminder
   */
  static async createPackageExpirationNotification(
    userId: string,
    packageName: string,
    daysLeft: number
  ) {
    return this.createNotification({
      userId,
      title: '⏰ Package Expiring Soon',
      message: `Your ${packageName} package expires in ${daysLeft} days. Renew now to keep getting premium predictions!`,
      type: 'warning',
      category: 'payment',
      actionUrl: `/pricing`,
      metadata: {
        packageName,
        daysLeft,
      },
    })
  }

  /**
   * Bulk create notifications for multiple users
   */
  static async createBulkNotifications(
    userIds: string[],
    data: Omit<CreateNotificationData, 'userId'>
  ) {
    const notifications = []
    
    for (const userId of userIds) {
      try {
        const notification = await this.createNotification({
          ...data,
          userId,
        })
        if (notification) {
          notifications.push(notification)
        }
      } catch (error) {
        logger.error('Failed to create bulk notification', {
          error: error as Error,
          data: { userId },
        })
      }
    }

    return notifications
  }

  /**
   * Get notification statistics for a user
   */
  static async getUserNotificationStats(userId: string) {
    const [total, unread, byType, byCategory] = await Promise.all([
      prisma.userNotification.count({ where: { userId } }),
      prisma.userNotification.count({ where: { userId, isRead: false } }),
      prisma.userNotification.groupBy({
        by: ['type'],
        where: { userId },
        _count: { type: true },
      }),
      prisma.userNotification.groupBy({
        by: ['category'],
        where: { userId },
        _count: { category: true },
      }),
    ])

    return {
      total,
      unread,
      byType: byType.reduce((acc, item) => {
        acc[item.type] = item._count.type
        return acc
      }, {} as Record<string, number>),
      byCategory: byCategory.reduce((acc, item) => {
        acc[item.category] = item._count.category
        return acc
      }, {} as Record<string, number>),
    }
  }

  /**
   * Create high-confidence prediction notifications and send email alerts
   */
  static async createHighConfidencePredictionAlert(
    userIds: string[],
    predictions: Array<{
      match: string
      prediction: string
      confidence: number
      odds: number
      matchTime: string
    }>
  ) {
    // Only send alerts for predictions with >85% confidence
    const highConfidencePredictions = predictions.filter(p => p.confidence >= 85)
    
    if (highConfidencePredictions.length === 0) {
      return []
    }

    const notifications = []
    
    for (const userId of userIds) {
      try {
        // Get user email for email notification
        const user = await prisma.user.findUnique({
          where: { id: userId },
          select: { email: true, fullName: true },
        })

        // Create in-app notification
        const notification = await this.createNotification({
          userId,
          title: '⚽ High-Confidence Predictions Available',
          message: `${highConfidencePredictions.length} high-confidence prediction${highConfidencePredictions.length > 1 ? 's' : ''} with ${highConfidencePredictions[0].confidence}%+ confidence are ready for you!`,
          type: 'prediction',
          category: 'prediction',
          actionUrl: `/dashboard/predictions`,
          metadata: {
            predictions: highConfidencePredictions,
            count: highConfidencePredictions.length,
          },
        })

        // Send email alert for high-confidence predictions
        if (user?.email) {
          try {
            await EmailService.sendPredictionAlert({
              userName: user.email, // Email address
              predictions: highConfidencePredictions,
            })
            logger.info('High-confidence prediction email sent', {
              data: { userId, email: user.email, predictionCount: highConfidencePredictions.length }
            })
          } catch (error) {
            logger.error('Failed to send prediction alert email', {
              error: error as Error,
              data: { userId, email: user.email }
            })
          }
        }

        if (notification) {
          notifications.push(notification)
        }
      } catch (error) {
        logger.error('Failed to create high-confidence prediction notification', {
          error: error as Error,
          data: { userId }
        })
      }
    }

    return notifications
  }

  /**
   * Send daily digest emails to users
   */
  static async sendDailyDigestEmails() {
    try {
      // Get all users with email notifications enabled
      const users = await prisma.user.findMany({
        where: {
          emailNotifications: true,
          // TODO: Add email preferences check once schema is updated
        },
        select: {
          id: true,
          email: true,
          fullName: true,
        },
      })

      for (const user of users) {
        if (!user.email) continue

        try {
          // Get user's daily stats
          const [newPredictions, topPredictions, recentResults, unreadNotifications] = await Promise.all([
            // Count new predictions from last 24 hours
            prisma.prediction.count({
              where: {
                createdAt: {
                  gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
                },
              },
            }),
            // Get top 3 predictions from last 24 hours
            prisma.prediction.findMany({
              where: {
                createdAt: {
                  gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
                },
                confidenceScore: { gte: 80 },
              },
              take: 3,
              orderBy: { confidenceScore: 'desc' },
              include: {
                match: {
                  include: {
                    homeTeam: true,
                    awayTeam: true,
                  },
                },
              },
            }),
            // Get recent user prediction results
            prisma.userPrediction.findMany({
              where: {
                userId: user.id,
                status: { in: ['won', 'lost'] },
                placedAt: {
                  gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
                },
              },
              take: 5,
              orderBy: { placedAt: 'desc' },
              include: {
                prediction: {
                  include: {
                    match: {
                      include: {
                        homeTeam: true,
                        awayTeam: true,
                      },
                    },
                  },
                },
              },
            }),
            // Count unread notifications
            prisma.userNotification.count({
              where: {
                userId: user.id,
                isRead: false,
              },
            }),
          ])

          // Format data for email
          const digestData = {
            userName: user.email, // Email address
            newPredictions,
            topPredictions: topPredictions.map(p => ({
              match: `${p.match.homeTeam.name} vs ${p.match.awayTeam.name}`,
              prediction: p.predictionType,
              confidence: p.confidenceScore,
            })),
            recentResults: recentResults.map(up => ({
              match: `${up.prediction.match.homeTeam.name} vs ${up.prediction.match.awayTeam.name}`,
              result: up.status === 'won' ? 'Won' : 'Lost',
              isWin: up.status === 'won',
            })),
            unreadNotifications,
          }

          // Send daily digest email
          await EmailService.sendDailyDigest(digestData)
          
          logger.info('Daily digest email sent', {
            data: { userId: user.id, email: user.email }
          })
        } catch (error) {
          logger.error('Failed to send daily digest email', {
            error: error as Error,
            data: { userId: user.id, email: user.email }
          })
        }
      }
    } catch (error) {
      logger.error('Failed to send daily digest emails', {
        error: error as Error,
      })
    }
  }
} 