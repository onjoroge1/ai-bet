import { NextRequest, NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { sendWhatsAppText, formatPhoneNumber } from "@/lib/whatsapp-service";
import {
  getTodaysPicks,
  formatPicksList,
  getPickByMatchId,
} from "@/lib/whatsapp-picks";
import { formatPickDeliveryMessage } from "@/lib/whatsapp-payment";
import prisma from "@/lib/db";

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/whatsapp/test-command
 * Test endpoint to simulate WhatsApp menu commands
 * 
 * Body: {
 *   to: string (phone number)
 *   command: string ("1", "2", "3", "menu", or matchId)
 *   matchId?: string (required if command is "2")
 * }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { to, command, matchId } = body;

    if (!to || !command) {
      return NextResponse.json(
        { error: "Missing required fields: 'to' and 'command'" },
        { status: 400 }
      );
    }

    // Format phone number to E.164
    const formattedPhone = formatPhoneNumber(to);
    if (!formattedPhone) {
      return NextResponse.json(
        { error: "Invalid phone number format" },
        { status: 400 }
      );
    }

    const lowerCommand = command.toLowerCase().trim();
    let messageToSend: string;
    let commandType: string;

    try {
      // Handle menu commands (same logic as webhook)
      if (["menu", "hi", "hello", "hey", "0", "start"].includes(lowerCommand)) {
        commandType = "menu";
        messageToSend = [
          "Welcome to SnapBet ⚽🔥",
          "",
          "Reply with:",
          "1️⃣ Today's picks",
          "2️⃣ Buy a pick (send matchId directly)",
          "3️⃣ Help",
          "",
          "Example: Send '123456' to buy pick with matchId 123456",
        ].join("\n");
      }
      // Command "1" - Today's picks
      else if (lowerCommand === "1" || lowerCommand === "picks") {
        commandType = "picks";
        const picks = await getTodaysPicks();
        messageToSend = formatPicksList(picks);
      }
      // Command "3" - Help
      else if (lowerCommand === "3" || lowerCommand === "help") {
        commandType = "help";
        messageToSend = [
          "Help 📲",
          "",
          "1️⃣ Today's picks – see top matches + matchIds",
          "2️⃣ Buy a pick – send matchId directly",
          "3️⃣ Help – you're here 😊",
          "",
          "You can type MENU anytime to see options again.",
          "",
          "Examples:",
          "Send '1' to see picks",
          "Send '123456' to buy pick with matchId 123456",
        ].join("\n");
      }
      // Command "2" - Buy pick (needs matchId)
      else if (lowerCommand === "2" || lowerCommand.startsWith("2")) {
        commandType = "buy";
        const matchIdToUse = matchId || lowerCommand.split(/\s+/)[1];
        
        if (!matchIdToUse) {
          messageToSend = [
            "To buy a pick 💰",
            "",
            "Send the matchId directly:",
            "Example: 123456",
            "",
            "Or send '1' to see available picks.",
          ].join("\n");
        } else {
          // TEMPORARY: Skip payment and directly send full AI analysis from QuickPurchase
          const quickPurchase = await prisma.quickPurchase.findUnique({
            where: { matchId: matchIdToUse },
            include: {
              country: {
                select: {
                  currencyCode: true,
                  currencySymbol: true,
                },
              },
            },
          });

          if (!quickPurchase) {
            messageToSend = `Match ID ${matchIdToUse} not found in our database. Please send '1' to see available matches.`;
          } else {
            // Extract match and prediction data
            const matchData = quickPurchase.matchData as any;
            const predictionData = quickPurchase.predictionData as any;

            const homeTeam =
              matchData?.homeTeam?.name ||
              quickPurchase.name.split(" vs ")[0] ||
              "Team A";
            const awayTeam =
              matchData?.awayTeam?.name ||
              quickPurchase.name.split(" vs ")[1] ||
              "Team B";
          const market = predictionData?.market || quickPurchase.predictionType || "1X2";
          const tip =
            predictionData?.tip ||
            predictionData?.prediction ||
            quickPurchase.predictionType ||
            "Win";

          // Note: Consensus odds fetching removed since we removed odds from the analysis message
          let consensusOdds: { home: number; draw: number; away: number } | undefined;
          let isConsensusOdds = false;
          let primaryBook: string | undefined;
          let booksCount: number | undefined;

          // Format the full AI analysis message
          messageToSend = formatPickDeliveryMessage({
            matchId: quickPurchase.matchId!,
            homeTeam,
            awayTeam,
            market,
            tip,
            confidence: quickPurchase.confidenceScore || 75,
            odds: quickPurchase.odds ? Number(quickPurchase.odds) : undefined,
            valueRating: quickPurchase.valueRating || undefined,
            consensusOdds: consensusOdds,
            isConsensusOdds: isConsensusOdds,
            primaryBook: primaryBook,
            booksCount: booksCount,
            predictionData: predictionData,
          });
          }
        }
      }
      // Numeric matchId - treat as purchase request (TEMPORARY: skip payment, send analysis)
      else if (/^\d+$/.test(lowerCommand) && lowerCommand.length >= 4) {
        commandType = "buy";
        
        // TEMPORARY: Skip payment and directly send full AI analysis from QuickPurchase
        const quickPurchase = await prisma.quickPurchase.findUnique({
          where: { matchId: lowerCommand },
          include: {
            country: {
              select: {
                currencyCode: true,
                currencySymbol: true,
              },
            },
          },
        });

        if (!quickPurchase) {
          messageToSend = `Match ID ${lowerCommand} not found in our database. Please send '1' to see available matches.`;
        } else {
          // Extract match and prediction data
          const matchData = quickPurchase.matchData as any;
          const predictionData = quickPurchase.predictionData as any;

          const homeTeam =
            matchData?.homeTeam?.name ||
            quickPurchase.name.split(" vs ")[0] ||
            "Team A";
          const awayTeam =
            matchData?.awayTeam?.name ||
            quickPurchase.name.split(" vs ")[1] ||
            "Team B";
          const market = predictionData?.market || quickPurchase.predictionType || "1X2";
          const tip =
            predictionData?.tip ||
            predictionData?.prediction ||
            quickPurchase.predictionType ||
            "Win";

          // Note: Consensus odds fetching removed since we removed odds from the analysis message
          let consensusOdds: { home: number; draw: number; away: number } | undefined;
          let isConsensusOdds = false;
          let primaryBook: string | undefined;
          let booksCount: number | undefined;

          // Format the full AI analysis message
          messageToSend = formatPickDeliveryMessage({
            matchId: quickPurchase.matchId!,
            homeTeam,
            awayTeam,
            market,
            tip,
            confidence: quickPurchase.confidenceScore || 75,
            odds: quickPurchase.odds ? Number(quickPurchase.odds) : undefined,
            valueRating: quickPurchase.valueRating || undefined,
            consensusOdds: consensusOdds,
            isConsensusOdds: isConsensusOdds,
            primaryBook: primaryBook,
            booksCount: booksCount,
            predictionData: predictionData,
          });
        }
      }
      // Unknown command - show menu
      else {
        commandType = "menu";
        messageToSend = [
          "Welcome to SnapBet ⚽🔥",
          "",
          "Reply with:",
          "1️⃣ Today's picks",
          "2️⃣ Buy a pick (send matchId directly)",
          "3️⃣ Help",
          "",
          "Example: Send '123456' to buy pick with matchId 123456",
        ].join("\n");
      }

      logger.info("Test command processed", {
        to: formattedPhone,
        command: lowerCommand,
        commandType,
        messageLength: messageToSend.length,
      });

      // Send the message via WhatsApp
      const result = await sendWhatsAppText(formattedPhone, messageToSend);

      if (result.success) {
        return NextResponse.json({
          success: true,
          message: "WhatsApp message sent successfully",
          to: formattedPhone,
          command: lowerCommand,
          commandType,
          messageLength: messageToSend.length,
          fullMessage: messageToSend,
        });
      } else {
        return NextResponse.json(
          {
            success: false,
            error: result.error || "Failed to send WhatsApp message. Check server logs for details.",
            command: lowerCommand,
            commandType,
            fullMessage: messageToSend, // Return message even if send failed
          },
          { status: 500 }
        );
      }
    } catch (error) {
      logger.error("Error processing test command", {
        to: formattedPhone,
        command: lowerCommand,
        error: error instanceof Error ? error : undefined,
      });
      
      return NextResponse.json(
        {
          success: false,
          error: "Error processing command",
          details: error instanceof Error ? error.message : "Unknown error",
          command: lowerCommand,
        },
        { status: 500 }
      );
    }
  } catch (error) {
    logger.error("Error in WhatsApp test-command endpoint", error);
    return NextResponse.json(
      {
        success: false,
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

