@echo off
cls
echo ================================
echo MORNING REPORT — NAWFI'S GAME
echo ================================
echo.
echo WHAT WAS BUILT:
type "C:\Users\nawfi\OneDrive\Documents\My remote vault\Game\docs\sessions\session-log.md"
echo.
echo --------------------------------
echo BLOCKED ITEMS:
if exist "C:\Users\nawfi\StudyQuestV3\docs\blocked.md" (
  type "C:\Users\nawfi\StudyQuestV3\docs\blocked.md"
) else (
  echo Nothing blocked — clean run.
)
echo.
echo --------------------------------
echo VAULT SIZE:
powershell -Command "$s=[math]::Round((Get-ChildItem 'C:\Users\nawfi\OneDrive\Documents\My remote vault' -Recurse -ErrorAction SilentlyContinue | Measure-Object -Property Length -Sum).Sum/1GB,2); Write-Host \"${s}GB of 10GB used\""
echo.
echo --------------------------------
echo GIT LOG (last 10 commits):
cd /d C:\Users\nawfi\StudyQuestV3
git log --oneline -10
echo.
echo ================================
pause
