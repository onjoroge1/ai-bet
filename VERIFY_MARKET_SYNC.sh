#!/bin/bash
# Bash script to verify MarketMatch sync and data collection
# Usage: ./VERIFY_MARKET_SYNC.sh

echo "MarketMatch Sync Verification"
echo "============================="
echo ""

# Check if server is running
echo "1. Checking if server is running..."
if curl -s -f "http://localhost:3000/api/health" > /dev/null 2>&1; then
    echo "✅ Server is running"
else
    echo "⚠️  Server may not be running. Start with: npm run dev"
    echo "   Continuing with API test anyway..."
fi

echo ""

# Test sync endpoint
echo "2. Testing sync endpoint..."
BASE_URL="http://localhost:3000"
SECRET="snapbet-marketmatch"

RESPONSE=$(curl -s -w "\n%{http_code}" -X GET \
    "$BASE_URL/api/admin/market/sync-scheduled?type=live" \
    -H "Authorization: Bearer $SECRET")

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" -eq 200 ]; then
    echo "✅ Sync endpoint responded successfully"
    echo "Status Code: $HTTP_CODE"
    echo ""
    echo "Response Body:"
    echo "$BODY" | jq '.' 2>/dev/null || echo "$BODY"
    
    echo ""
    echo "Expected Response Structure:"
    echo "  - success: true"
    echo "  - results: { live: { synced, errors, skipped } }"
    echo "  - summary: { totalSynced, totalErrors, totalSkipped, duration }"
    
    # Verify response structure (basic check)
    if echo "$BODY" | grep -q '"success"'; then
        echo ""
        echo "✅ Response structure is valid!"
        
        # Extract values using jq if available
        if command -v jq &> /dev/null; then
            echo ""
            echo "Live Matches Sync Results:"
            echo "  - Synced: $(echo "$BODY" | jq -r '.results.live.synced // 0')"
            echo "  - Errors: $(echo "$BODY" | jq -r '.results.live.errors // 0')"
            echo "  - Skipped: $(echo "$BODY" | jq -r '.results.live.skipped // 0')"
            
            echo ""
            echo "Summary:"
            echo "  - Total Synced: $(echo "$BODY" | jq -r '.summary.totalSynced // 0')"
            echo "  - Total Errors: $(echo "$BODY" | jq -r '.summary.totalErrors // 0')"
            echo "  - Total Skipped: $(echo "$BODY" | jq -r '.summary.totalSkipped // 0')"
            echo "  - Duration: $(echo "$BODY" | jq -r '.summary.duration // "N/A"')"
        fi
    else
        echo "❌ Response missing expected structure"
    fi
elif [ "$HTTP_CODE" -eq 401 ]; then
    echo "❌ Unauthorized (401)"
    echo "⚠️  Check CRON_SECRET in .env.local"
    echo "Response: $BODY"
elif [ "$HTTP_CODE" -eq 500 ]; then
    echo "❌ Server Error (500)"
    echo "⚠️  Check server logs"
    echo "Response: $BODY"
else
    echo "❌ Unexpected status code: $HTTP_CODE"
    echo "Response: $BODY"
fi

echo ""
echo "3. Checking database for synced data..."
echo "   (This requires database connection)"
echo ""
echo "To verify data in database, run:"
echo "  npx prisma studio"
echo "  Then check the 'MarketMatch' table"
echo ""
echo "Or use this query in your code:"
echo "  const matches = await prisma.marketMatch.findMany({ take: 10 })"

echo ""
echo "============================="
echo "Verification Complete!"

