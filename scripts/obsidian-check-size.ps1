# obsidian-check-size.ps1
# Reports vault size breakdown and warns if approaching 10GB limit.

$vault = "C:\Users\nawfi\OneDrive\Documents\My remote vault"

if (!(Test-Path $vault)) {
    Write-Host "ERROR: vault not found at $vault"
    exit 1
}

$totalBytes = (Get-ChildItem $vault -Recurse -ErrorAction SilentlyContinue |
    Measure-Object -Property Length -Sum).Sum

$totalGB = [math]::Round($totalBytes / 1GB, 3)
$pct     = [math]::Round(($totalBytes / 10GB) * 100, 1)

Write-Host ""
Write-Host "============================="
Write-Host "Vault: $vault"
Write-Host "Usage: ${totalGB}GB / 10GB  ($pct%)"
Write-Host "============================="

if ($totalGB -gt 9) {
    Write-Host "CRITICAL: Over 9GB — clean up immediately"
} elseif ($totalGB -gt 8) {
    Write-Host "WARNING: Over 8GB — clean up old files soon"
} else {
    Write-Host "OK: Vault size is healthy"
}

# Per-folder breakdown
Write-Host ""
Write-Host "Folder breakdown:"
Get-ChildItem $vault -Directory | ForEach-Object {
    $sz = (Get-ChildItem $_.FullName -Recurse -ErrorAction SilentlyContinue |
        Measure-Object -Property Length -Sum).Sum
    $szMB = [math]::Round($sz / 1MB, 1)
    Write-Host ("  {0,-30} {1,8} MB" -f $_.Name, $szMB)
}
Write-Host ""
