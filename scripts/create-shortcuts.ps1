# create-shortcuts.ps1
$game    = "C:\Users\nawfi\StudyQuestV3"
$desktop = [Environment]::GetFolderPath("Desktop")
$shell   = New-Object -ComObject WScript.Shell

Write-Host "Creating icons..."
& "$game\scripts\create-icons.ps1"

$sleepPath = "$desktop\SLEEP - Claude Overnight.lnk"
$sleepLink = $shell.CreateShortcut($sleepPath)
$sleepLink.TargetPath       = "powershell.exe"
$sleepLink.Arguments        = "-ExecutionPolicy Bypass -WindowStyle Normal -File `"$game\scripts\overnight.ps1`""
$sleepLink.IconLocation     = "$game\scripts\icons\sleep.ico"
$sleepLink.Description      = "Start Claude overnight build"
$sleepLink.WorkingDirectory = $game
$sleepLink.WindowStyle      = 1
$sleepLink.Save()
Write-Host "created: $sleepPath"

$wakePath = "$desktop\WAKE - Morning Report.lnk"
$wakeLink = $shell.CreateShortcut($wakePath)
$wakeLink.TargetPath        = "powershell.exe"
$wakeLink.Arguments         = "-ExecutionPolicy Bypass -WindowStyle Normal -File `"$game\scripts\wake-up-report.ps1`""
$wakeLink.IconLocation      = "$game\scripts\icons\wake.ico"
$wakeLink.Description       = "Read overnight build report"
$wakeLink.WorkingDirectory  = $game
$wakeLink.WindowStyle       = 1
$wakeLink.Save()
Write-Host "created: $wakePath"

function Try-Pin($path) {
  try {
    $sh     = New-Object -ComObject Shell.Application
    $folder = $sh.Namespace((Split-Path $path -Parent))
    $item   = $folder.ParseName((Split-Path $path -Leaf))
    if (!$item) { Write-Host "pin skipped: item not found"; return }
    $pinned = $false
    foreach ($v in $item.Verbs()) {
      if ($v.Name -match "Pin to taskbar") {
        $v.DoIt()
        $pinned = $true
        Write-Host "pinned: $(Split-Path $path -Leaf)"
        break
      }
    }
    if (!$pinned) { Write-Host "taskbar pin blocked by Windows policy - shortcut on desktop" }
  } catch {
    Write-Host "taskbar pin error - shortcut on desktop"
  }
}

Try-Pin $sleepPath
Try-Pin $wakePath

Write-Host ""
Write-Host "Shortcuts ready on Desktop."
