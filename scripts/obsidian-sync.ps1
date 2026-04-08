# obsidian-sync.ps1
# Syncs approved markdown docs from game project to Obsidian vault.
# NEVER syncs code files, assets, audio, or images.
# Run after every session.

$game      = "C:\Users\nawfi\StudyQuestV3"
$vault     = "C:\Users\nawfi\OneDrive\Documents\My remote vault"
$timestamp = Get-Date -Format "yyyy-MM-dd HH:mm"
$synced    = 0

# -- Ensure vault game directory exists ----------------------------------------
$vaultGame = "$vault\Game"
if (!(Test-Path $vaultGame)) {
    New-Item -ItemType Directory -Path $vaultGame -Force | Out-Null
}
if (!(Test-Path "$vaultGame\CLAUDE")) {
    New-Item -ItemType Directory -Path "$vaultGame\CLAUDE" -Force | Out-Null
}
if (!(Test-Path "$vaultGame\snapshots")) {
    New-Item -ItemType Directory -Path "$vaultGame\snapshots" -Force | Out-Null
}

# -- Sync CLAUDE.md ------------------------------------------------------------
$claudeSrc = Join-Path $game "CLAUDE.md"
$claudeDst = "$vaultGame\CLAUDE\CLAUDE.md"
if (Test-Path $claudeSrc) {
    Copy-Item $claudeSrc -Destination $claudeDst -Force
    $synced++
    Write-Host "synced: CLAUDE.md"
}

# -- Snapshot CLAUDE.md -- keep only last 5 ------------------------------------
$snapDest = "$vaultGame\snapshots\CLAUDE-$(Get-Date -Format 'yyyy-MM-dd-HHmm').md"
if (Test-Path $claudeSrc) {
    Copy-Item $claudeSrc -Destination $snapDest -Force
    Write-Host "snapshot: $snapDest"
}

# Delete snapshots beyond 5 most recent
$snaps = Get-ChildItem "$vaultGame\snapshots\" -Filter "CLAUDE-*.md" -ErrorAction SilentlyContinue |
    Sort-Object LastWriteTime -Descending |
    Select-Object -Skip 5
foreach ($snap in $snaps) {
    Remove-Item $snap.FullName -Force
    Write-Host "deleted old snapshot: $($snap.Name)"
}

# -- Sync docs/ folder (markdown only) -----------------------------------------
$sourceFolders = @("docs", "snapshots")
foreach ($folder in $sourceFolders) {
    $src = Join-Path $game $folder
    if (!(Test-Path $src)) { continue }

    Get-ChildItem -Path $src -Filter "*.md" -Recurse | ForEach-Object {
        $relative = $_.FullName.Substring($game.Length)
        $dest     = Join-Path $vaultGame $relative
        $destDir  = Split-Path $dest -Parent

        if (!(Test-Path $destDir)) {
            New-Item -ItemType Directory -Path $destDir -Force | Out-Null
        }

        Copy-Item $_.FullName -Destination $dest -Force
        $synced++
        Write-Host "synced: $relative"
    }
}

# -- Vault size check ----------------------------------------------------------
$vaultSize = 0
try {
    $vaultSize = [math]::Round(
        (Get-ChildItem $vault -Recurse -ErrorAction SilentlyContinue |
         Measure-Object -Property Length -Sum).Sum / 1GB,
        2
    )
} catch {
    Write-Host "WARNING: Could not measure vault size"
}

# -- Session log -- append only ------------------------------------------------
$logDir = "$vaultGame\docs\sessions"
if (!(Test-Path $logDir)) {
    New-Item -ItemType Directory -Path $logDir -Force | Out-Null
}
$log = "$logDir\session-log.md"
if (!(Test-Path $log)) {
    New-Item -ItemType File -Path $log -Force | Out-Null
    Add-Content $log "# Session Log"
    Add-Content $log ""
}
Add-Content $log "- $timestamp | $synced files synced | vault: ${vaultSize}GB/10GB"

# -- Report --------------------------------------------------------------------
Write-Host ""
Write-Host "============================="
Write-Host "sync complete: $synced files"
Write-Host "vault usage:   ${vaultSize}GB of 10GB"
if ($vaultSize -gt 8) {
    Write-Host "WARNING: vault over 8GB - clean up old files"
}
Write-Host "============================="
