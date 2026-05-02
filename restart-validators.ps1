# Restart HF Validator Spaces
# You need to get a HF token from: https://huggingface.co/settings/tokens

$HF_TOKEN = $env:HF_TOKEN
if (-not $HF_TOKEN) {
    Write-Host "❌ ERROR: HF_TOKEN environment variable not set" -ForegroundColor Red
    Write-Host ""
    Write-Host "Get your token from: https://huggingface.co/settings/tokens" -ForegroundColor Yellow
    Write-Host "Then run: `$env:HF_TOKEN='your-token-here'" -ForegroundColor Yellow
    Write-Host ""
    exit 1
}

$spaces = @(
    "vishalmysore/SmartAI",
    "vishalmysore/SmartAI2",
    "vishalmysore/SmartAI3"
)

Write-Host "🔄 Restarting HF Validator Spaces..." -ForegroundColor Cyan
Write-Host ""

foreach ($space in $spaces) {
    Write-Host "Restarting $space..." -ForegroundColor Yellow
    
    try {
        $response = Invoke-RestMethod -Method Post `
            -Uri "https://huggingface.co/api/spaces/$space/restart" `
            -Headers @{
                "Authorization" = "Bearer $HF_TOKEN"
            }
        
        Write-Host "✅ $space restarted successfully" -ForegroundColor Green
    } catch {
        Write-Host "❌ Failed to restart $space" -ForegroundColor Red
        Write-Host "   Error: $($_.Exception.Message)" -ForegroundColor Red
    }
    
    Start-Sleep -Seconds 2
}

Write-Host ""
Write-Host "⏳ Waiting 30 seconds for validators to start..." -ForegroundColor Cyan
Start-Sleep -Seconds 30

Write-Host ""
Write-Host "📊 Checking relay status..." -ForegroundColor Cyan
$info = Invoke-RestMethod -Uri "https://vishalmysore-agentworkbookrelayserver.hf.space/info"
Write-Host "Active Connections: $($info.registration.activeValidators)" -ForegroundColor $(if ($info.registration.activeValidators -ge 3) { "Green" } else { "Yellow" })
Write-Host ""

if ($info.registration.activeValidators -lt 3) {
    Write-Host "⚠️  WARNING: Need at least 3 validators, currently have $($info.registration.activeValidators)" -ForegroundColor Yellow
    Write-Host "Check Space logs at:" -ForegroundColor Yellow
    foreach ($space in $spaces) {
        Write-Host "  https://huggingface.co/spaces/$space/logs" -ForegroundColor Cyan
    }
} else {
    Write-Host "✅ All validators are active! Registration should work now." -ForegroundColor Green
}
