# PowerShell script to check MarketMatch sync logs and verify data collection
# Usage: .\CHECK_MARKET_SYNC_LOGS.ps1

$baseUrl = "http://localhost:3000"
$secret = "snapbet-marketmatch"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "MarketMatch Sync - Logs & Data Check" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check if server is running
Write-Host "1. Checking if dev server is running..." -ForegroundColor Yellow
try {
    $serverCheck = Invoke-WebRequest -Uri "$baseUrl/api/health" -Method GET -UseBasicParsing -ErrorAction SilentlyContinue
    if ($serverCheck.StatusCode -eq 200) {
        Write-Host "✅ Server is running" -ForegroundColor Green
    }
} catch {
    Write-Host "⚠️  Server may not be running or health endpoint not available" -ForegroundColor Yellow
    Write-Host "   Make sure to run: npm run dev" -ForegroundColor Yellow
}

Write-Host ""

# Test the sync endpoint
Write-Host "2. Testing MarketMatch Sync Endpoint..." -ForegroundColor Yellow
Write-Host "   Endpoint: $baseUrl/api/admin/market/sync-scheduled?type=upcoming" -ForegroundColor Gray
Write-Host ""

try {
    $response = Invoke-WebRequest -Uri "$baseUrl/api/admin/market/sync-scheduled?type=upcoming" `
        -Method GET `
        -Headers @{Authorization="Bearer $secret"} `
        -UseBasicParsing
    
    Write-Host "✅ Request successful!" -ForegroundColor Green
    Write-Host "   Status Code: $($response.StatusCode)" -ForegroundColor Green
    Write-Host ""
    
    # Parse and display response
    $responseData = $response.Content | ConvertFrom-Json
    
    Write-Host "📋 Response Data:" -ForegroundColor Cyan
    Write-Host "-------------------" -ForegroundColor Cyan
    
    if ($responseData.success) {
        Write-Host "✅ success: $($responseData.success)" -ForegroundColor Green
    } else {
        Write-Host "❌ success: $($responseData.success)" -ForegroundColor Red
    }
    
    if ($responseData.results) {
        Write-Host "✅ results: Present" -ForegroundColor Green
        
        if ($responseData.results.upcoming) {
            $upcoming = $responseData.results.upcoming
            Write-Host ""
            Write-Host "   Upcoming Matches:" -ForegroundColor Cyan
            Write-Host "   - Synced: $($upcoming.synced)" -ForegroundColor $(if ($upcoming.synced -gt 0) { "Green" } else { "Yellow" })
            Write-Host "   - Errors: $($upcoming.errors)" -ForegroundColor $(if ($upcoming.errors -eq 0) { "Green" } else { "Red" })
            Write-Host "   - Skipped: $($upcoming.skipped)" -ForegroundColor Yellow
        }
    } else {
        Write-Host "❌ results: Missing" -ForegroundColor Red
    }
    
    if ($responseData.summary) {
        Write-Host ""
        Write-Host "   Summary:" -ForegroundColor Cyan
        Write-Host "   - Total Synced: $($responseData.summary.totalSynced)" -ForegroundColor $(if ($responseData.summary.totalSynced -gt 0) { "Green" } else { "Yellow" })
        Write-Host "   - Total Errors: $($responseData.summary.totalErrors)" -ForegroundColor $(if ($responseData.summary.totalErrors -eq 0) { "Green" } else { "Red" })
        Write-Host "   - Total Skipped: $($responseData.summary.totalSkipped)" -ForegroundColor Yellow
        Write-Host "   - Duration: $($responseData.summary.duration)" -ForegroundColor Cyan
    }
    
    Write-Host ""
    Write-Host "📄 Full Response JSON:" -ForegroundColor Cyan
    Write-Host "-------------------" -ForegroundColor Cyan
    $responseData | ConvertTo-Json -Depth 10 | Write-Host
    
} catch {
    Write-Host "❌ Request failed!" -ForegroundColor Red
    Write-Host "   Error: $($_.Exception.Message)" -ForegroundColor Red
    
    if ($_.Exception.Response) {
        $statusCode = $_.Exception.Response.StatusCode.value__
        Write-Host "   Status Code: $statusCode" -ForegroundColor Red
        
        if ($statusCode -eq 401) {
            Write-Host ""
            Write-Host "⚠️  Unauthorized - Check:" -ForegroundColor Yellow
            Write-Host "   1. CRON_SECRET is set correctly" -ForegroundColor Yellow
            Write-Host "   2. Authorization header format: 'Bearer snapbet-marketmatch'" -ForegroundColor Yellow
        } elseif ($statusCode -eq 404) {
            Write-Host ""
            Write-Host "⚠️  Endpoint not found - Check:" -ForegroundColor Yellow
            Write-Host "   1. Server is running (npm run dev)" -ForegroundColor Yellow
            Write-Host "   2. Route file exists: app/api/admin/market/sync-scheduled/route.ts" -ForegroundColor Yellow
        } elseif ($statusCode -eq 500) {
            Write-Host ""
            Write-Host "⚠️  Server error - Check:" -ForegroundColor Yellow
            Write-Host "   1. Server console logs for errors" -ForegroundColor Yellow
            Write-Host "   2. BACKEND_API_URL is configured" -ForegroundColor Yellow
            Write-Host "   3. Database connection is working" -ForegroundColor Yellow
        }
        
        try {
            $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
            $responseBody = $reader.ReadToEnd()
            Write-Host ""
            Write-Host "   Response Body:" -ForegroundColor Red
            Write-Host "   $responseBody" -ForegroundColor Red
        } catch {
            Write-Host "   (Could not read response body)" -ForegroundColor Yellow
        }
    }
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Expected Log Messages" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Look for these log messages in your dev server console:" -ForegroundColor Yellow
Write-Host ""
Write-Host "✅ Success Logs:" -ForegroundColor Green
Write-Host "   [TIMESTAMP] [INFO] 🕐 CRON: Starting scheduled market sync" -ForegroundColor Gray
Write-Host "   [TIMESTAMP] [INFO] 🔄 Starting sync for upcoming matches" -ForegroundColor Gray
Write-Host "   [TIMESTAMP] [INFO] ✅ Completed sync for upcoming matches" -ForegroundColor Gray
Write-Host "   [TIMESTAMP] [INFO] 🕐 CRON: Scheduled market sync completed" -ForegroundColor Gray
Write-Host ""
Write-Host "❌ Error Logs:" -ForegroundColor Red
Write-Host "   [TIMESTAMP] [WARN] 🕐 CRON: Unauthorized market sync attempt" -ForegroundColor Gray
Write-Host "   [TIMESTAMP] [ERROR] Error syncing match {matchId}" -ForegroundColor Gray
Write-Host "   [TIMESTAMP] [ERROR] Failed to sync upcoming matches" -ForegroundColor Gray
Write-Host "   [TIMESTAMP] [ERROR] 🕐 CRON: Market sync failed" -ForegroundColor Gray
Write-Host ""

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Data Collection Check" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "To verify data is being collected, run this SQL query:" -ForegroundColor Yellow
Write-Host ""
Write-Host "SELECT" -ForegroundColor Cyan
Write-Host "  status," -ForegroundColor Gray
Write-Host "  COUNT(*) as count," -ForegroundColor Gray
Write-Host "  MAX(\"lastSyncedAt\") as last_sync," -ForegroundColor Gray
Write-Host "  AVG(\"syncCount\") as avg_sync_count" -ForegroundColor Gray
Write-Host "FROM \"MarketMatch\"" -ForegroundColor Gray
Write-Host "GROUP BY status" -ForegroundColor Gray
Write-Host "ORDER BY status;" -ForegroundColor Gray
Write-Host ""

Write-Host "Alternative: Use the verification script:" -ForegroundColor Yellow
Write-Host "  npx tsx scripts/verify-market-sync.ts" -ForegroundColor Cyan
Write-Host ""

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Check Complete!" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

