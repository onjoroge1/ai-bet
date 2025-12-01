import { logger } from "@/lib/logger";

const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
const ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;
const API_VERSION = process.env.WHATSAPP_API_VERSION || "v21.0";

/**
 * Send a text message via WhatsApp Cloud API
 * @param to - Recipient's WhatsApp number in E.164 format (e.g., "16783929144")
 * @param text - Message text content
 * @returns Promise<boolean> - true if message was sent successfully
 */
export async function sendWhatsAppText(
  to: string,
  text: string
): Promise<boolean> {
  if (!PHONE_NUMBER_ID || !ACCESS_TOKEN) {
    logger.error("WhatsApp credentials not configured", {
      hasPhoneNumberId: !!PHONE_NUMBER_ID,
      hasAccessToken: !!ACCESS_TOKEN,
    });
    return false;
  }

  const url = `https://graph.facebook.com/${API_VERSION}/${PHONE_NUMBER_ID}/messages`;

  const payload = {
    messaging_product: "whatsapp",
    to,
    type: "text",
    text: { body: text },
  };

  try {
    logger.debug("Sending WhatsApp message", {
      to,
      textLength: text.length,
      url,
    });

    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errorText = await res.text();
      logger.error("WhatsApp API error", {
        status: res.status,
        statusText: res.statusText,
        error: errorText,
        to,
      });
      return false;
    }

    const data = (await res.json()) as { messages?: Array<{ id?: string }> };
    logger.info("WhatsApp message sent successfully", {
      to,
      messageId: data.messages?.[0]?.id,
    });

    return true;
  } catch (error) {
    logger.error("Error sending WhatsApp message", {
      error,
      to,
    });
    return false;
  }
}

/**
 * Send a WhatsApp message with interactive buttons
 * @param to - Recipient's WhatsApp number
 * @param text - Message text
 * @param buttons - Array of button objects with id and title
 * @returns Promise<boolean>
 */
export async function sendWhatsAppInteractive(
  to: string,
  text: string,
  buttons: Array<{ id: string; title: string }>
): Promise<boolean> {
  if (!PHONE_NUMBER_ID || !ACCESS_TOKEN) {
    logger.error("WhatsApp credentials not configured");
    return false;
  }

  const url = `https://graph.facebook.com/${API_VERSION}/${PHONE_NUMBER_ID}/messages`;

  const payload = {
    messaging_product: "whatsapp",
    to,
    type: "interactive",
    interactive: {
      type: "button",
      body: {
        text,
      },
      action: {
        buttons: buttons.map((btn) => ({
          type: "reply",
          reply: {
            id: btn.id,
            title: btn.title,
          },
        })),
      },
    },
  };

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errorText = await res.text();
      logger.error("WhatsApp interactive message error", {
        status: res.status,
        error: errorText,
      });
      return false;
    }

    logger.info("WhatsApp interactive message sent", { to });
    return true;
  } catch (error) {
    logger.error("Error sending WhatsApp interactive message", error);
    return false;
  }
}

/**
 * Format a phone number to E.164 format
 * @param phone - Phone number in any format
 * @returns Formatted phone number or null if invalid
 */
export function formatPhoneNumber(phone: string): string | null {
  // Remove all non-digit characters
  const digits = phone.replace(/\D/g, "");

  // Basic validation - should be 10-15 digits
  if (digits.length < 10 || digits.length > 15) {
    return null;
  }

  // If it doesn't start with a country code, assume US (+1)
  if (digits.length === 10) {
    return `1${digits}`;
  }

  return digits;
}

