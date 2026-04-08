# session-end.ps1 — run at the end of every Claude Code session
$timestamp = Get-Date -Format "yyyy-MM-dd HH:mm"
$game      = "C:\Users\nawfi\StudyQuestV3"
$vault     = "C:\Users\nawfi\OneDrive\Documents\My remote vault"
$log       = "$vault\Game\docs\sessions\session-log.md"

Write-Host "Ending session: $timestamp"

# 1. Obsidian sync
Write-Host "Syncing to Obsidian..."
powershell -ExecutionPolicy Bypass -File "$game\scripts\obsidian-sync.ps1"

# 2. Git commit everything
Write-Host "Committing to git..."
Set-Location $game
$status = git status --porcelain
if ($status) {
  git add -A
  git commit -m "session: auto-commit $timestamp"
  Write-Host "Committed."

  # Push if remote exists
  $remote = git remote get-url origin 2>$null
  if ($remote) {
    git push
    Write-Host "Pushed to remote."
  } else {
    Write-Host "No remote configured — skipping push."
  }
} else {
  Write-Host "Nothing to commit."
}

# 3. Session log
if (Test-Path $log) {
  Add-Content $log "- $timestamp | SESSION ENDED + SYNCED + COMMITTED"
}

Write-Host ""
Write-Host "==========================="
Write-Host "Session complete: $timestamp"
Write-Host "==========================="
