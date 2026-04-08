# create-icons.ps1 — generates moon and sun .ico files for desktop shortcuts
Add-Type -AssemblyName System.Drawing

$iconsDir = "$PSScriptRoot\icons"
if (!(Test-Path $iconsDir)) {
  New-Item -ItemType Directory -Path $iconsDir -Force | Out-Null
}

function Create-Icon {
  param($path, $color, $shape)

  $bmp = New-Object System.Drawing.Bitmap(256, 256)
  $g   = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.Clear([System.Drawing.Color]::Transparent)

  $brush = New-Object System.Drawing.SolidBrush($color)

  if ($shape -eq "moon") {
    # Draw crescent: large circle - offset circle
    $g.FillEllipse($brush, 20, 20, 200, 216)
    $g.CompositingMode = [System.Drawing.Drawing2D.CompositingMode]::SourceCopy
    $eraseBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(0,0,0,0))
    $g.FillEllipse($eraseBrush, 55, 0, 200, 200)
    # Stars
    $g.CompositingMode = [System.Drawing.Drawing2D.CompositingMode]::SourceOver
    $starBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)
    $g.FillEllipse($starBrush, 158, 28, 22, 22)
    $g.FillEllipse($starBrush, 188, 78, 15, 15)
    $g.FillEllipse($starBrush, 148, 92, 11, 11)
  }

  if ($shape -eq "sun") {
    # Rays first
    $pen = New-Object System.Drawing.Pen($color, 14)
    $pen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
    $pen.EndCap   = [System.Drawing.Drawing2D.LineCap]::Round
    $cx = 128; $cy = 128
    foreach ($angle in @(0,45,90,135,180,225,270,315)) {
      $rad = $angle * [Math]::PI / 180
      $g.DrawLine($pen,
        [float]($cx + [Math]::Cos($rad)*82), [float]($cy + [Math]::Sin($rad)*82),
        [float]($cx + [Math]::Cos($rad)*116), [float]($cy + [Math]::Sin($rad)*116))
    }
    # Sun disc on top
    $g.FillEllipse($brush, 58, 58, 140, 140)
  }

  $g.Dispose()

  # Save as ICO via HICON
  $hIcon = $bmp.GetHicon()
  $icon  = [System.Drawing.Icon]::FromHandle($hIcon)
  $stream = [System.IO.File]::Create($path)
  $icon.Save($stream)
  $stream.Close()
  $icon.Dispose()
  $bmp.Dispose()

  Write-Host "created: $path"
}

# Moon — deep purple
Create-Icon "$iconsDir\sleep.ico" `
  ([System.Drawing.Color]::FromArgb(255, 75, 0, 180)) "moon"

# Sun — warm gold
Create-Icon "$iconsDir\wake.ico" `
  ([System.Drawing.Color]::FromArgb(255, 255, 180, 0)) "sun"

Write-Host "icons ready in: $iconsDir"
