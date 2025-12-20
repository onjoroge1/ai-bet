# Comprehensive QA Test Runner for MarketMatch Setup
# This script runs all QA tests and generates a summary report

Write-Host "MarketMatch QA Test Suite" -ForegroundColor Cyan
Write-Host ("=" * 60)
Write-Host ""

# Test 1: Database Validation
Write-Host "[1/2] Running Database Validation Tests..." -ForegroundColor Yellow
Write-Host ("-" * 60)
$dbResult = npx tsx scripts/test-database-validation.ts 2>&1
$dbExitCode = $LASTEXITCODE

if ($dbExitCode -eq 0) {
    Write-Host "PASS: Database tests passed" -ForegroundColor Green
} else {
    Write-Host "FAIL: Database tests failed" -ForegroundColor Red
    Write-Host $dbResult
}

Write-Host ""

# Test 2: API Endpoint Tests
Write-Host "[2/2] Running API Endpoint Tests..." -ForegroundColor Yellow
Write-Host ("-" * 60)
$apiResult = powershell -ExecutionPolicy Bypass -File scripts/test-api-endpoints.ps1 2>&1
$apiExitCode = $LASTEXITCODE

if ($apiExitCode -eq 0) {
    Write-Host "PASS: API endpoint tests passed" -ForegroundColor Green
} else {
    Write-Host "FAIL: API endpoint tests failed" -ForegroundColor Red
    Write-Host $apiResult
}

Write-Host ""
Write-Host ("=" * 60)
Write-Host "Test Summary" -ForegroundColor Cyan
Write-Host ("=" * 60)

if ($dbExitCode -eq 0 -and $apiExitCode -eq 0) {
    Write-Host "ALL TESTS PASSED" -ForegroundColor Green
    Write-Host ""
    Write-Host "The MarketMatch setup is production-ready!" -ForegroundColor Green
    exit 0
} else {
    Write-Host "SOME TESTS FAILED" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please review the test output above for details." -ForegroundColor Yellow
    exit 1
}
