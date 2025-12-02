import { logger } from "@/lib/logger";

const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
const ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN;
const API_VERSION = process.env.WHATSAPP_API_VERSION || "v21.0";

/**
 * Send a text message via WhatsApp Cloud API
 * @param to - Recipient's WhatsApp number in E.164 format (e.g., "16783929144")
 * @param text - Message text content
 * @returns Promise<{ success: boolean; error?: string }> - Result with optional error message
 */
export async function sendWhatsAppText(
  to: string,
  text: string
): Promise<{ success: boolean; error?: string; errorCode?: number; errorType?: string }> {
  if (!PHONE_NUMBER_ID || !ACCESS_TOKEN) {
    logger.error("WhatsApp credentials not configured", {
      hasPhoneNumberId: !!PHONE_NUMBER_ID,
      hasAccessToken: !!ACCESS_TOKEN,
    });
    return {
      success: false,
      error: "WhatsApp credentials not configured. Please set WHATSAPP_PHONE_NUMBER_ID and WHATSAPP_ACCESS_TOKEN environment variables.",
    };
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
      let errorMessage = `WhatsApp API error (${res.status}): ${res.statusText}`;
      let errorCode: number | undefined;
      let errorType: string | undefined;
      
      // Try to parse error details from Meta API response
      try {
        const errorJson = JSON.parse(errorText);
        if (errorJson.error?.message) {
          errorMessage = errorJson.error.message;
          errorCode = errorJson.error.code;
          
          // Check for common errors
          if (errorJson.error.code === 190) {
            errorMessage = "Access token expired. Please generate a new token from Meta for Developers.";
            errorType = "TOKEN_EXPIRED";
          } else if (errorJson.error.code === 131047) {
            errorMessage = "Invalid phone number format. Please use E.164 format (e.g., 16783929144).";
            errorType = "INVALID_PHONE";
          } else if (errorJson.error.code === 100) {
            errorMessage = `Message too long: ${errorJson.error.message}`;
            errorType = "MESSAGE_TOO_LONG";
          } else if (res.status === 429) {
            errorMessage = "Rate limit exceeded. Please wait before sending more messages.";
            errorType = "RATE_LIMIT";
          } else if (errorJson.error.code === 131026) {
            errorMessage = "Recipient phone number not registered on WhatsApp.";
            errorType = "NUMBER_NOT_REGISTERED";
          } else if (errorJson.error.code === 131031) {
            errorMessage = "Message template required for this recipient (24-hour window expired).";
            errorType = "TEMPLATE_REQUIRED";
          }
        }
      } catch {
        // If parsing fails, use the raw error text
        errorMessage = errorText || errorMessage;
      }
      
      logger.error("WhatsApp API error", {
        status: res.status,
        statusText: res.statusText,
        errorCode,
        errorType,
        error: errorText,
        errorMessage,
        to,
        url,
      });
      
      return {
        success: false,
        error: errorMessage,
        errorCode,
        errorType,
      };
    }

    const data = (await res.json()) as { messages?: Array<{ id?: string }> };
    logger.info("WhatsApp message sent successfully", {
      to,
      messageId: data.messages?.[0]?.id,
    });

    return { success: true };
  } catch (error) {
    logger.error("Error sending WhatsApp message", {
      error,
      to,
    });
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error occurred while sending WhatsApp message",
    };
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

