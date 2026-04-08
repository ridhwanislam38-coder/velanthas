# obsidian-sync.ps1
# Syncs approved markdown docs from game project to Obsidian vault.
# NEVER syncs code files, assets, audio, or images.
# Run after every session / system completion.

$game      = "C:\Users\nawfi\StudyQuestV3"
$vault     = "C:\Users\nawfi\OneDrive\Documents\My remote vault"
$timestamp = Get-Date -Format "yyyy-MM-dd HH:mm"
$synced    = 0

# -- Ensure all vault folders exist ----------------------------------------
$folders = @(
  "Game\CLAUDE",
  "Game\docs\systems",
  "Game\docs\characters",
  "Game\docs\bosses",
  "Game\docs\regions",
  "Game\docs\quests",
  "Game\docs\sessions",
  "Game\snapshots",
  "ChatLogs",
  "ClaudeMemory",
  "Artifacts"
)
foreach ($f in $folders) {
  $p = Join-Path $vault $f
  if (!(Test-Path $p)) {
    New-Item -ItemType Directory -Path $p -Force | Out-Null
  }
}

# -- Sync CLAUDE.md --------------------------------------------------------
$claudeSrc = Join-Path $game "CLAUDE.md"
if (Test-Path $claudeSrc) {
  Copy-Item $claudeSrc "$vault\Game\CLAUDE\CLAUDE.md" -Force
  Copy-Item $claudeSrc "$vault\Game\snapshots\CLAUDE-$(Get-Date -Format 'yyyy-MM-dd-HHmm').md" -Force
  $synced++
  Write-Host "synced: CLAUDE.md"
}

# Keep only last 5 snapshots
Get-ChildItem "$vault\Game\snapshots\" -Filter "CLAUDE-*.md" -ErrorAction SilentlyContinue |
  Sort-Object LastWriteTime -Descending |
  Select-Object -Skip 5 |
  ForEach-Object { Remove-Item $_.FullName -Force; Write-Host "pruned: $($_.Name)" }

# -- Sync docs/ folder — markdown only ------------------------------------
$docsPath = Join-Path $game "docs"
if (Test-Path $docsPath) {
  Get-ChildItem -Path $docsPath -Filter "*.md" -Recurse | ForEach-Object {
    $relative = $_.FullName.Substring($game.Length)
    $dest     = Join-Path "$vault\Game" $relative
    $destDir  = Split-Path $dest -Parent
    if (!(Test-Path $destDir)) {
      New-Item -ItemType Directory -Path $destDir -Force | Out-Null
    }
    Copy-Item $_.FullName -Destination $dest -Force
    $synced++
    Write-Host "synced:$relative"
  }
}

# -- Vault size check ------------------------------------------------------
$vaultGB = 0
try {
  $vaultGB = [math]::Round(
    (Get-ChildItem $vault -Recurse -ErrorAction SilentlyContinue |
     Measure-Object -Property Length -Sum).Sum / 1GB, 2)
} catch {
  Write-Host "WARNING: could not measure vault size"
}

# -- Session log -----------------------------------------------------------
$log = "$vault\Game\docs\sessions\session-log.md"
if (!(Test-Path $log)) {
  New-Item -ItemType File -Path $log -Force | Out-Null
  Add-Content $log "# Session Log"
  Add-Content $log ""
}
Add-Content $log "- $timestamp | $synced files | ${vaultGB}GB/10GB"

Write-Host ""
Write-Host "============================="
Write-Host "obsidian sync: $synced files"
Write-Host "vault usage:   ${vaultGB}GB of 10GB"
if ($vaultGB -gt 8) {
  Add-Content $log "- WARNING: vault over 8GB at $timestamp"
  Write-Host "WARNING: vault over 8GB"
}
Write-Host "============================="
