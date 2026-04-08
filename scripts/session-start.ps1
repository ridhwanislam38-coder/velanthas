# session-start.ps1 — run at the start of every Claude Code session
$timestamp = Get-Date -Format "yyyy-MM-dd HH:mm"
$vault     = "C:\Users\nawfi\OneDrive\Documents\My remote vault"
$game      = "C:\Users\nawfi\StudyQuestV3"
$log       = "$vault\Game\docs\sessions\session-log.md"

Write-Host "==========================="
Write-Host "SESSION STARTED: $timestamp"
Write-Host "node: $(node --version)"
Write-Host "npm:  $(npm --version)"
Write-Host "==========================="

# Report any blocked items from last session
$blocked = "$game\docs\blocked.md"
if (Test-Path $blocked) {
  $content = Get-Content $blocked
  if ($content.Length -gt 2) {
    Write-Host ""
    Write-Host "BLOCKED FROM LAST SESSION:"
    $content | Write-Host
    Write-Host ""
  }
}

# Append to session log
if (Test-Path $log) {
  Add-Content $log "- $timestamp | SESSION STARTED"
} else {
  New-Item -ItemType File -Path $log -Force | Out-Null
  Add-Content $log "# Session Log"
  Add-Content $log ""
  Add-Content $log "- $timestamp | SESSION STARTED"
}

# TypeScript check
Write-Host "Running TypeScript check..."
$result = & cmd /c "cd /d $game && npx tsc --noEmit 2>&1"
if ($LASTEXITCODE -eq 0) {
  Write-Host "TypeScript: OK (0 errors)"
} else {
  Write-Host "TypeScript errors found:"
  $result | Write-Host
}

Write-Host "==========================="
Write-Host "Ready. Check CLAUDE.md for build queue."
Write-Host "==========================="
