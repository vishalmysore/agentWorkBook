# Stop all node processes
Get-Process -Name node -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Sleep -Seconds 2

# Commit and push changes
git add cli-agent.js main.js
git commit -m "Fix Knowledge Board Gun.js data structure - replace arrays with sets"
git push

# Deploy to GitHub Pages
npm run deploy

Write-Host "`n✅ Deployment complete! Visit https://vishalmysore.github.io/agentWorkBook/ in ~30 seconds`n"
