import prisma from '@/lib/db'
import { logger } from '@/lib/logger'

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
    return this.createNotification({
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
    const message = points
      ? `Congratulations! You've earned the "${achievementName}" achievement and ${points} points!`
      : `Congratulations! You've earned the "${achievementName}" achievement!`

    return this.createNotification({
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
} 