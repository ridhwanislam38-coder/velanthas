# overnight.ps1 — PowerShell version for desktop shortcut
$timestamp = Get-Date -Format "yyyy-MM-dd HH:mm"
$game      = "C:\Users\nawfi\StudyQuestV3"

Clear-Host
Write-Host "================================" -ForegroundColor Magenta
Write-Host "OVERNIGHT MODE - NAWFI'S GAME"   -ForegroundColor Magenta
Write-Host "Started: $timestamp"              -ForegroundColor Magenta
Write-Host "Leave computer on and sleep"      -ForegroundColor Magenta
Write-Host "================================" -ForegroundColor Magenta
Write-Host ""

# Session start
& "$game\scripts\session-start.ps1"

# Launch Claude Code with full autonomous mode
$prompt = @"
Read CLAUDE.md fully.
Check docs\blocked.md for any prior blocked items and try to resolve them first.
Run a full codebase scan to understand current state.
Work through every [ ] item in the CLAUDE.md build order in sequence.

For every system you build:
  1. Check Context7 for latest library docs
  2. Build the system completely
  3. Run: npx tsc --noEmit  — fix ALL errors before proceeding
  4. Code review pass
  5. Update CLAUDE.md build order (mark [DONE])
  6. Create a doc in docs\systems\ describing what was built
  7. Run: scripts\obsidian-sync.bat
  8. Git commit: feat(system-name): description

If anything fails or blocks you:
  - Write to docs\blocked.md: timestamp + what failed + what you tried
  - Try 2 alternative approaches
  - Continue with next system
  - NEVER stop and wait for input

Work until build queue is empty or 6am.
Run scripts\session-end.ps1 when done.
"@

claude --dangerously-skip-permissions $prompt

# Session end
& "$game\scripts\session-end.ps1"

Write-Host ""
Write-Host "================================" -ForegroundColor Green
Write-Host "OVERNIGHT COMPLETE"              -ForegroundColor Green
Write-Host "Ended: $(Get-Date -Format 'yyyy-MM-dd HH:mm')" -ForegroundColor Green
Write-Host "================================" -ForegroundColor Green
Read-Host "Press Enter to close"
