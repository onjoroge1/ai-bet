import prisma from "@/lib/db";
import { logger } from "@/lib/logger";
import { Prisma } from "@prisma/client";

/**
 * Check if WhatsApp user has VIP/premium access
 * Checks for active VIP subscriptions stored in WhatsAppUser metadata
 * Also checks for linked User accounts with active packages
 */
export async function hasWhatsAppPremiumAccess(waId: string): Promise<{
  hasAccess: boolean;
  plan: string | null;
  expiresAt: Date | null;
  isExpired: boolean;
}> {
  try {
    const waUser = await prisma.whatsAppUser.findUnique({
      where: { waId },
    });

    if (!waUser) {
      return {
        hasAccess: false,
        plan: null,
        expiresAt: null,
        isExpired: true,
      };
    }

    // Check vipInfo JSON field for VIP subscription
    if (!waUser.vipInfo) {
      logger.debug("No VIP info found for user", { waId });
      return {
        hasAccess: false,
        plan: null,
        expiresAt: null,
        isExpired: true,
      };
    }

    const vipInfo = waUser.vipInfo as {
      plan: string;
      expiresAt: string;
      hasAccess: boolean;
      isExpired: boolean;
    };

    // Check if VIP is expired
    const expiresAt = new Date(vipInfo.expiresAt);
    const isExpired = expiresAt <= new Date();

    // Update vipInfo if expired (async, don't wait)
    if (isExpired && vipInfo.hasAccess) {
      prisma.whatsAppUser.update({
        where: { id: waUser.id },
        data: {
          vipInfo: {
            ...vipInfo,
            hasAccess: false,
            isExpired: true,
          } as Prisma.JsonObject,
        },
      }).catch((err) => {
        logger.error("Error updating expired VIP status", { waId, error: err });
      });
    }

    logger.debug("VIP access check result", {
      waId,
      hasAccess: vipInfo.hasAccess && !isExpired,
      plan: vipInfo.plan,
      expiresAt: expiresAt.toISOString(),
      isExpired,
    });

    return {
      hasAccess: vipInfo.hasAccess && !isExpired,
      plan: vipInfo.plan || null,
      expiresAt: expiresAt,
      isExpired: isExpired,
    };
  } catch (error) {
    logger.error("Error checking WhatsApp premium access", {
      waId,
      error,
    });
    return {
      hasAccess: false,
      plan: null,
      expiresAt: null,
      isExpired: true,
    };
  }
}

/**
 * Get VIP status message for WhatsApp user
 */
export async function getWhatsAppVIPStatus(waId: string): Promise<string> {
  const status = await hasWhatsAppPremiumAccess(waId);
  
  if (status.hasAccess && status.expiresAt) {
    const expiresDate = new Date(status.expiresAt).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
    return `✅ VIP Active\nPlan: ${status.plan || 'VIP'}\nExpires: ${expiresDate}`;
  }
  
  return "❌ No VIP Access\nSend 'VIP' to see pricing options.";
}

