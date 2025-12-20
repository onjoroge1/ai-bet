# PowerShell script to verify MarketMatch sync endpoint and data collection
# Usage: .\VERIFY_MARKET_SYNC.ps1

$baseUrl = "http://localhost:3000"
$secret = "snapbet-marketmatch"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "MarketMatch Sync Verification" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Test 1: Check if endpoint is accessible
Write-Host "1. Testing Endpoint Accessibility..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "$baseUrl/api/admin/market/sync-scheduled?type=upcoming" `
        -Method GET `
        -Headers @{Authorization="Bearer $secret"} `
        -UseBasicParsing
    
    Write-Host "✅ Endpoint is accessible" -ForegroundColor Green
    Write-Host "Status Code: $($response.StatusCode)" -ForegroundColor Green
    Write-Host ""
    
    # Parse response
    $responseData = $response.Content | ConvertFrom-Json
    
    Write-Host "Response Structure:" -ForegroundColor Cyan
    Write-Host "-------------------" -ForegroundColor Cyan
    $responseData | ConvertTo-Json -Depth 10 | Write-Host
    
    Write-Host ""
    Write-Host "Expected Response Format:" -ForegroundColor Cyan
    Write-Host "-------------------" -ForegroundColor Cyan
    Write-Host @"
{
  "success": true,
  "results": {
    "upcoming": {
      "synced": <number>,
      "errors": <number>,
      "skipped": <number>
    }
  },
  "summary": {
    "totalSynced": <number>,
    "totalErrors": <number>,
    "totalSkipped": <number>,
    "duration": "<number>ms"
  }
}
"@ -ForegroundColor Gray
    
    Write-Host ""
    Write-Host "Actual Response Analysis:" -ForegroundColor Cyan
    Write-Host "-------------------" -ForegroundColor Cyan
    
    if ($responseData.success -eq $true) {
        Write-Host "✅ success: true" -ForegroundColor Green
    } else {
        Write-Host "❌ success: false or missing" -ForegroundColor Red
    }
    
    if ($responseData.results) {
        Write-Host "✅ results object present" -ForegroundColor Green
        
        if ($responseData.results.upcoming) {
            $upcoming = $responseData.results.upcoming
            Write-Host "  - upcoming.synced: $($upcoming.synced)" -ForegroundColor $(if ($upcoming.synced -gt 0) { "Green" } else { "Yellow" })
            Write-Host "  - upcoming.errors: $($upcoming.errors)" -ForegroundColor $(if ($upcoming.errors -eq 0) { "Green" } else { "Red" })
            Write-Host "  - upcoming.skipped: $($upcoming.skipped)" -ForegroundColor Yellow
        } else {
            Write-Host "  ⚠️ upcoming results missing" -ForegroundColor Yellow
        }
    } else {
        Write-Host "❌ results object missing" -ForegroundColor Red
    }
    
    if ($responseData.summary) {
        Write-Host "✅ summary object present" -ForegroundColor Green
        Write-Host "  - totalSynced: $($responseData.summary.totalSynced)" -ForegroundColor $(if ($responseData.summary.totalSynced -gt 0) { "Green" } else { "Yellow" })
        Write-Host "  - totalErrors: $($responseData.summary.totalErrors)" -ForegroundColor $(if ($responseData.summary.totalErrors -eq 0) { "Green" } else { "Red" })
        Write-Host "  - totalSkipped: $($responseData.summary.totalSkipped)" -ForegroundColor Yellow
        Write-Host "  - duration: $($responseData.summary.duration)" -ForegroundColor Cyan
    } else {
        Write-Host "❌ summary object missing" -ForegroundColor Red
    }
    
} catch {
    Write-Host "❌ Error accessing endpoint" -ForegroundColor Red
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
    
    if ($_.Exception.Response) {
        $statusCode = $_.Exception.Response.StatusCode.value__
        Write-Host "Status Code: $statusCode" -ForegroundColor Red
        
        if ($statusCode -eq 401) {
            Write-Host "⚠️ Unauthorized - Check CRON_SECRET" -ForegroundColor Yellow
        } elseif ($statusCode -eq 404) {
            Write-Host "⚠️ Endpoint not found - Check if server is running" -ForegroundColor Yellow
        } elseif ($statusCode -eq 500) {
            Write-Host "⚠️ Server error - Check logs" -ForegroundColor Yellow
        }
        
        try {
            $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
            $responseBody = $reader.ReadToEnd()
            Write-Host "Response Body: $responseBody" -ForegroundColor Red
        } catch {
            Write-Host "Could not read response body" -ForegroundColor Yellow
        }
    }
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Data Collection Verification" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "To verify data collection, check the database:" -ForegroundColor Yellow
Write-Host ""
Write-Host "SQL Query to check MarketMatch records:" -ForegroundColor Cyan
Write-Host @"
SELECT 
  status,
  COUNT(*) as count,
  MAX(\"lastSyncedAt\") as last_sync,
  AVG(\"syncCount\") as avg_sync_count
FROM \"MarketMatch\"
GROUP BY status
ORDER BY status;
"@ -ForegroundColor Gray

Write-Host ""
Write-Host "Check specific match data:" -ForegroundColor Cyan
Write-Host @"
SELECT 
  \"matchId\",
  status,
  \"homeTeam\",
  \"awayTeam\",
  league,
  \"kickoffDate\",
  \"consensusOdds\",
  \"v1Model\",
  \"v2Model\",
  \"lastSyncedAt\",
  \"syncCount\"
FROM \"MarketMatch\"
WHERE status = 'UPCOMING'
ORDER BY \"kickoffDate\" ASC
LIMIT 10;
"@ -ForegroundColor Gray

Write-Host ""
Write-Host "Check sync statistics:" -ForegroundColor Cyan
Write-Host @"
SELECT 
  status,
  COUNT(*) as total_matches,
  SUM(CASE WHEN \"syncErrors\" > 0 THEN 1 ELSE 0 END) as matches_with_errors,
  AVG(\"syncCount\") as avg_syncs,
  MAX(\"lastSyncedAt\") as most_recent_sync
FROM \"MarketMatch\"
GROUP BY status;
"@ -ForegroundColor Gray

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Verification Complete!" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
