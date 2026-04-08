# wake-up-report.ps1 — morning report for desktop shortcut
$game    = "C:\Users\nawfi\StudyQuestV3"
$vault   = "C:\Users\nawfi\OneDrive\Documents\My remote vault"
$log     = "$vault\Game\docs\sessions\session-log.md"
$blocked = "$game\docs\blocked.md"

Clear-Host
Write-Host "================================" -ForegroundColor Cyan
Write-Host "GOOD MORNING NAWFI"              -ForegroundColor Cyan
Write-Host (Get-Date -Format "yyyy-MM-dd HH:mm") -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "WHAT CLAUDE BUILT OVERNIGHT:" -ForegroundColor Green
Write-Host "────────────────────────────" -ForegroundColor Green
if (Test-Path $log) {
  Get-Content $log | Select-Object -Last 25 | Write-Host
} else {
  Write-Host "No session log found."
}

Write-Host ""
Write-Host "BLOCKED ITEMS:" -ForegroundColor Yellow
Write-Host "──────────────" -ForegroundColor Yellow
if (Test-Path $blocked) {
  $content = Get-Content $blocked
  if ($content.Count -gt 1) {
    $content | Write-Host
  } else {
    Write-Host "Nothing blocked — clean run." -ForegroundColor Green
  }
} else {
  Write-Host "Nothing blocked — clean run." -ForegroundColor Green
}

Write-Host ""
Write-Host "GIT LOG (last 10 commits):" -ForegroundColor White
Write-Host "──────────────────────────" -ForegroundColor White
Set-Location $game
git log --oneline -10

Write-Host ""
Write-Host "VAULT SIZE:" -ForegroundColor White
Write-Host "───────────" -ForegroundColor White
$size = 0
try {
  $size = [math]::Round((
    Get-ChildItem $vault -Recurse -ErrorAction SilentlyContinue |
    Measure-Object -Property Length -Sum).Sum / 1GB, 2)
} catch {}
$remaining = [math]::Round(10 - $size, 2)
Write-Host "${size}GB used of 10GB  (${remaining}GB remaining)"

Write-Host ""
Write-Host "================================"  -ForegroundColor Cyan
Write-Host "Paste docs\blocked.md into Claude" -ForegroundColor Cyan
Write-Host "if anything needs manual fixing."  -ForegroundColor Cyan
Write-Host "================================"  -ForegroundColor Cyan
Write-Host ""
Read-Host "Press Enter to close"
