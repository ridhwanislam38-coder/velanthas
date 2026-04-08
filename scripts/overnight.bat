@echo off
cls
echo ================================
echo OVERNIGHT MODE — NAWFI'S GAME
echo Started: %date% %time%
echo Auto-approving everything
echo Leave computer on and sleep
echo ================================
echo.
cd /d C:\Users\nawfi\StudyQuestV3
powershell -ExecutionPolicy Bypass -File "scripts\session-start.ps1"
claude --dangerously-skip-permissions "Read CLAUDE.md fully. Check docs\blocked.md. Work through every [ ] item in the build order in CLAUDE.md in sequence. For every system: check Context7 for latest docs, build it, run npx tsc --noEmit, fix any errors, update CLAUDE.md build order, create a doc in docs\systems\, run scripts\obsidian-sync.bat, git add -A and git commit. If anything fails: write timestamp + what failed + what you tried to docs\blocked.md, then continue with the next item. Never stop and wait for input. Work until build queue is empty or 6am. Run scripts\session-end.ps1 when done."
powershell -ExecutionPolicy Bypass -File "scripts\session-end.ps1"
echo.
echo ================================
echo OVERNIGHT COMPLETE: %date% %time%
echo Check docs\blocked.md for issues
echo ================================
pause
