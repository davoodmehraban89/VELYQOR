$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing
$destination = Join-Path $PSScriptRoot "Assets.xcassets\AppIcon.appiconset\AppIcon-1024.png"
$bmp = New-Object System.Drawing.Bitmap(1024, 1024)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$rect = New-Object System.Drawing.Rectangle(0, 0, 1024, 1024)
$col1 = [System.Drawing.ColorTranslator]::FromHtml("#e5f8f7")
$col2 = [System.Drawing.ColorTranslator]::FromHtml("#b8e9f2")
$bg = New-Object System.Drawing.Drawing2D.LinearGradientBrush($rect, $col1, $col2, 45)
$g.FillRectangle($bg, $rect)
$deep = [System.Drawing.ColorTranslator]::FromHtml("#087F99")
$cyan = [System.Drawing.ColorTranslator]::FromHtml("#1CB9BE")
$white = [System.Drawing.Color]::FromArgb(180, 255, 255, 255)
$pen = New-Object System.Drawing.Pen($cyan, 86)
$pen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
$pen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
$g.DrawArc($pen, 172, 180, 650, 650, 42, 274)
$orb = New-Object System.Drawing.Pen($white, 30)
$g.DrawEllipse($orb, 180, 435, 660, 235)
$bars = New-Object System.Drawing.SolidBrush($deep)
$g.FillRectangle($bars, 365, 500, 95, 250)
$g.FillRectangle($bars, 500, 390, 95, 350)
$g.FillRectangle($bars, 635, 310, 95, 375)
$accentPen = New-Object System.Drawing.Pen($cyan, 24)
$g.DrawLine($accentPen, 680, 280, 790, 195)
$g.DrawLine($accentPen, 720, 197, 790, 195)
$g.DrawLine($accentPen, 790, 195, 780, 260)
$bmp.Save($destination, [System.Drawing.Imaging.ImageFormat]::Png)
$g.Dispose()
$bmp.Dispose()
$bg.Dispose()
$pen.Dispose()
$orb.Dispose()
$bars.Dispose()
$accentPen.Dispose()
Write-Output "Icon saved: $destination"
