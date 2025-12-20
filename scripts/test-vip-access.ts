/**
 * Test script to verify VIP access tracking works correctly
 * 
 * This script:
 * 1. Creates a test WhatsApp user (if doesn't exist)
 * 2. Simulates VIP subscription by updating vipInfo
 * 3. Tests hasWhatsAppPremiumAccess() function
 * 4. Verifies expiry checking works
 */

import prisma from "../lib/db";
import { hasWhatsAppPremiumAccess } from "../lib/whatsapp-premium";
import { logger } from "../lib/logger";

const TEST_WA_ID = "1234567890";

async function testVIPAccess() {
  console.log("🧪 Testing VIP Access Tracking...\n");

  try {
    // Step 1: Get or create test user
    let waUser = await prisma.whatsAppUser.findUnique({
      where: { waId: TEST_WA_ID },
    });

    if (!waUser) {
      console.log("Creating test WhatsApp user...");
      waUser = await prisma.whatsAppUser.create({
        data: {
          waId: TEST_WA_ID,
          countryCode: "US",
        },
      });
      console.log("✅ Test user created\n");
    } else {
      console.log("✅ Test user found\n");
    }

    // Step 2: Test without VIP (should return false)
    console.log("1. Testing access WITHOUT VIP...");
    const noVIPAccess = await hasWhatsAppPremiumAccess(TEST_WA_ID);
    console.log("   Result:", noVIPAccess);
    if (!noVIPAccess.hasAccess) {
      console.log("   ✅ Correctly returns no access\n");
    } else {
      console.log("   ❌ ERROR: Should return no access\n");
      return;
    }

    // Step 3: Set VIP info with future expiry
    console.log("2. Setting VIP info with future expiry...");
    const futureExpiry = new Date();
    futureExpiry.setDate(futureExpiry.getDate() + 30); // 30 days from now

    await prisma.whatsAppUser.update({
      where: { id: waUser.id },
      data: {
        vipInfo: {
          plan: "Monthly VIP Subscription",
          expiresAt: futureExpiry.toISOString(),
          hasAccess: true,
          isExpired: false,
        },
      },
    });
    console.log("   ✅ VIP info set (expires:", futureExpiry.toISOString(), ")\n");

    // Step 4: Test with valid VIP
    console.log("3. Testing access WITH valid VIP...");
    const validVIPAccess = await hasWhatsAppPremiumAccess(TEST_WA_ID);
    console.log("   Result:", {
      hasAccess: validVIPAccess.hasAccess,
      plan: validVIPAccess.plan,
      expiresAt: validVIPAccess.expiresAt?.toISOString(),
      isExpired: validVIPAccess.isExpired,
    });
    if (validVIPAccess.hasAccess && !validVIPAccess.isExpired) {
      console.log("   ✅ Correctly returns access\n");
    } else {
      console.log("   ❌ ERROR: Should return access\n");
      return;
    }

    // Step 5: Set VIP info with past expiry
    console.log("4. Setting VIP info with PAST expiry...");
    const pastExpiry = new Date();
    pastExpiry.setDate(pastExpiry.getDate() - 1); // Yesterday

    await prisma.whatsAppUser.update({
      where: { id: waUser.id },
      data: {
        vipInfo: {
          plan: "Monthly VIP Subscription",
          expiresAt: pastExpiry.toISOString(),
          hasAccess: true,
          isExpired: false,
        },
      },
    });
    console.log("   ✅ VIP info set (expired:", pastExpiry.toISOString(), ")\n");

    // Step 6: Test with expired VIP
    console.log("5. Testing access WITH expired VIP...");
    const expiredVIPAccess = await hasWhatsAppPremiumAccess(TEST_WA_ID);
    console.log("   Result:", {
      hasAccess: expiredVIPAccess.hasAccess,
      plan: expiredVIPAccess.plan,
      expiresAt: expiredVIPAccess.expiresAt?.toISOString(),
      isExpired: expiredVIPAccess.isExpired,
    });
    if (!expiredVIPAccess.hasAccess && expiredVIPAccess.isExpired) {
      console.log("   ✅ Correctly returns no access (expired)\n");
    } else {
      console.log("   ❌ ERROR: Should return no access (expired)\n");
      return;
    }

    // Step 7: Clean up - remove VIP info
    console.log("6. Cleaning up test data...");
    await prisma.whatsAppUser.update({
      where: { id: waUser.id },
      data: {
        vipInfo: null,
      },
    });
    console.log("   ✅ VIP info removed\n");

    console.log("✅ All VIP access tests passed!\n");
    console.log("VIP access tracking is working correctly.");

  } catch (error) {
    console.error("❌ Test failed:", error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

testVIPAccess().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});

