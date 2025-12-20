# PowerShell script to test WhatsApp picks endpoint
# Usage: .\test-whatsapp-picks.ps1

$phoneNumber = Read-Host "Enter your phone number (e.g., 6783929144)"
$domain = Read-Host "Enter your domain (e.g., snapbet.bet or localhost:3000)"

$url = "https://$domain/api/whatsapp/send-test"
$body = @{
    to = $phoneNumber
    type = "picks"
} | ConvertTo-Json

Write-Host "`nSending request to: $url" -ForegroundColor Cyan
Write-Host "Body: $body`n" -ForegroundColor Gray

try {
    $response = Invoke-RestMethod -Uri $url -Method POST -Body $body -ContentType "application/json" -ErrorAction Stop
    
    Write-Host "✅ Success!" -ForegroundColor Green
    Write-Host "Response:" -ForegroundColor Yellow
    $response | ConvertTo-Json -Depth 10
    
    if ($response.success) {
        Write-Host "`n📱 Check your WhatsApp for the picks message!" -ForegroundColor Green
        if ($response.preview) {
            Write-Host "`nPreview of message sent:" -ForegroundColor Cyan
            Write-Host $response.preview -ForegroundColor White
        }
    }
} catch {
    Write-Host "❌ Error occurred:" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    
    if ($_.ErrorDetails.Message) {
        Write-Host "`nError details:" -ForegroundColor Yellow
        Write-Host $_.ErrorDetails.Message -ForegroundColor White
    }
    
    Write-Host "`n💡 Tips:" -ForegroundColor Cyan
    Write-Host "1. Make sure your server is running" -ForegroundColor White
    Write-Host "2. Check if the endpoint is deployed: https://$domain/api/whatsapp/send-test" -ForegroundColor White
    Write-Host "3. Try using the test page instead: https://$domain/whatsapp/test" -ForegroundColor White
}



