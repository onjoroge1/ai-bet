import { Stripe } from 'stripe';
import prisma from '@/lib/db';
import { Prisma } from '@prisma/client';
import { logger } from '@/lib/logger';

/**
 * Handle WhatsApp VIP subscription purchase completion
 */
export async function handleWhatsAppVIPSubscription(
  session: Stripe.Checkout.Session,
  waId: string,
  packageType: string,
  metadata: Record<string, string>
) {
  try {
    logger.info('Processing WhatsApp VIP subscription purchase', {
      sessionId: session.id,
      waId,
      packageType,
    });

    // Find WhatsAppUser
    const waUser = await prisma.whatsAppUser.findUnique({
      where: { waId },
    });

    if (!waUser) {
      logger.error('WhatsAppUser not found for VIP subscription', { waId });
      return;
    }

    // Get package offer
    const packageOffer = await prisma.packageOffer.findFirst({
      where: {
        packageType,
        isActive: true,
      },
    });

    if (!packageOffer) {
      logger.error('PackageOffer not found for type', { packageType });
      return;
    }

    // Calculate expiry date
    const validityDays = packageOffer.validityDays;
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + validityDays);

    // Store VIP subscription info in vipInfo JSON field
    await prisma.whatsAppUser.update({
      where: { id: waUser.id },
      data: {
        vipInfo: {
          plan: packageOffer.name || packageType,
          expiresAt: expiresAt.toISOString(),
          hasAccess: true,
          isExpired: false,
        } as Prisma.JsonObject,
        lastSeenAt: new Date(),
      },
    });
    
    // Log VIP activation for tracking
    logger.info('WhatsApp VIP subscription activated and stored', {
      waId,
      packageType,
      plan: packageOffer.name,
      expiresAt: expiresAt.toISOString(),
      validityDays,
    });
    
    // For now, send confirmation message
    const { sendWhatsAppText } = await import('@/lib/whatsapp-service');

    const packageNames: Record<string, string> = {
      weekend_pass: 'Weekend Pack',
      weekly_pass: 'Weekly Pack',
      monthly_sub: 'Monthly VIP Subscription',
    };

    const packageName = packageNames[packageType] || 'VIP Package';

    const message = [
      '✅ **PAYMENT CONFIRMED!**',
      '',
      `🎉 Your ${packageName} has been activated!`,
      '',
      `**What's Included:**`,
      packageOffer.tipCount === -1 
        ? '• Unlimited premium picks'
        : `• ${packageOffer.tipCount} premium picks`,
      `• Valid for ${validityDays} days`,
      ...packageOffer.features.slice(0, 3).map(f => `• ${f}`),
      '',
      '**You now have access to:**',
      '• VIP PICKS - Premium predictions',
      '• PARLAY - AI-built parlays',
      '• CS - Correct scores',
      '• BTTS - Both teams to score',
      '• OVERS - Over/Under goals',
      '• V2/V3 - High-accuracy picks',
      '',
      'Send any premium command to get started!',
      '',
      'Thank you for choosing SnapBet! 🚀',
    ].join('\n');

    const result = await sendWhatsAppText(waId, message);

    if (result.success) {
      logger.info('VIP subscription confirmation sent successfully', {
        waId,
        packageType,
      });
    } else {
      logger.error('Failed to send VIP subscription confirmation', {
        waId,
        packageType,
        error: result.error,
      });
    }
  } catch (error) {
    logger.error('Error processing WhatsApp VIP subscription', {
      error: error instanceof Error ? error.message : undefined,
      waId,
      packageType,
    });
  }
}

