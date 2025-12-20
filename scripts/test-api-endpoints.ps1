# PowerShell script to test MarketMatch API endpoints
# This script tests both scheduled and manual sync endpoints

$baseUrl = "http://localhost:3000"
$cronSecret = "snapbet-marketmatch"

Write-Host "🧪 Testing MarketMatch API Endpoints" -ForegroundColor Cyan
Write-Host "=" * 60

# Test 1: Scheduled Sync - Valid CRON_SECRET
Write-Host "`n[Test 1] Scheduled Sync with Valid CRON_SECRET" -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "$baseUrl/api/admin/market/sync-scheduled?type=live" `
        -Method GET `
        -Headers @{ "Authorization" = "Bearer $cronSecret" } `
        -UseBasicParsing
    
    if ($response.StatusCode -eq 200) {
        $body = $response.Content | ConvertFrom-Json
        Write-Host "✅ PASS: Status 200, Response:" -ForegroundColor Green
        Write-Host ($body | ConvertTo-Json -Depth 3)
    } else {
        Write-Host "❌ FAIL: Unexpected status code $($response.StatusCode)" -ForegroundColor Red
    }
} catch {
    Write-Host "❌ FAIL: $($_.Exception.Message)" -ForegroundColor Red
}

# Test 2: Scheduled Sync - Invalid CRON_SECRET
Write-Host "`n[Test 2] Scheduled Sync with Invalid CRON_SECRET" -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "$baseUrl/api/admin/market/sync-scheduled?type=live" `
        -Method GET `
        -Headers @{ "Authorization" = "Bearer invalid-secret" } `
        -UseBasicParsing `
        -ErrorAction Stop
    
    Write-Host "❌ FAIL: Should have returned 401" -ForegroundColor Red
} catch {
    if ($_.Exception.Response.StatusCode -eq 401) {
        Write-Host "✅ PASS: Correctly returned 401 Unauthorized" -ForegroundColor Green
    } else {
        Write-Host "❌ FAIL: Unexpected error: $($_.Exception.Message)" -ForegroundColor Red
    }
}

# Test 3: Scheduled Sync - No CRON_SECRET
Write-Host "`n[Test 3] Scheduled Sync without CRON_SECRET" -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "$baseUrl/api/admin/market/sync-scheduled?type=live" `
        -Method GET `
        -UseBasicParsing `
        -ErrorAction Stop
    
    Write-Host "❌ FAIL: Should have returned 401" -ForegroundColor Red
} catch {
    if ($_.Exception.Response.StatusCode -eq 401) {
        Write-Host "✅ PASS: Correctly returned 401 Unauthorized" -ForegroundColor Green
    } else {
        Write-Host "❌ FAIL: Unexpected error: $($_.Exception.Message)" -ForegroundColor Red
    }
}

# Test 4: Scheduled Sync - Different Types
Write-Host "`n[Test 4] Scheduled Sync - Type=upcoming" -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "$baseUrl/api/admin/market/sync-scheduled?type=upcoming" `
        -Method GET `
        -Headers @{ "Authorization" = "Bearer $cronSecret" } `
        -UseBasicParsing
    
    if ($response.StatusCode -eq 200) {
        $body = $response.Content | ConvertFrom-Json
        Write-Host "✅ PASS: Status 200" -ForegroundColor Green
        Write-Host "   Summary: $($body.summary | ConvertTo-Json -Compress)"
    } else {
        Write-Host "❌ FAIL: Status $($response.StatusCode)" -ForegroundColor Red
    }
} catch {
    Write-Host "❌ FAIL: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n" + "=" * 60
Write-Host "Note: Manual sync endpoint requires admin session authentication" -ForegroundColor Gray
Write-Host "      Test it manually through the admin UI at /admin" -ForegroundColor Gray

