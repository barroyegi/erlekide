# Rasteriza bg.svg por teselas (el viewport headless esta limitado a ~718px de alto)
# Uso: .\render-bg.ps1 -Mode desktop -W 1600 -H 1000 -Out bg-d.png
param([string]$Mode = 'desktop', [int]$W = 1600, [int]$H = 1000, [string]$Out = 'bg-d.png')

$edge = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
if (-not (Test-Path $edge)) { $edge = "C:\Program Files\Microsoft\Edge\Application\msedge.exe" }

node gen-bg.js $Mode | Out-Host

# el viewport = window-size menos el marco (medido en esta maquina: 24 x 126)
$padW = 24; $padH = 126
$tile = 500
$n = [math]::Ceiling($H / $tile)
$uri = "file:///$($pwd.Path -replace '\\','/')/bg-harness.html"
for ($k = 0; $k -lt $n; $k++) {
  $y = $k * $tile
  $ww = $W + $padW; $wh = $tile + $padH
  & $edge --headless --disable-gpu --hide-scrollbars --screenshot="$pwd\_tile$k.png" --window-size=$ww,$wh "$uri`?y=$y" 2>$null
  Start-Sleep 3
}

Add-Type -AssemblyName System.Drawing
$bmp = New-Object System.Drawing.Bitmap($W, $H)
$g = [System.Drawing.Graphics]::FromImage($bmp)
for ($k = 0; $k -lt $n; $k++) {
  $t = [System.Drawing.Bitmap]::FromFile("$pwd\_tile$k.png")
  # recortar la tesela al contenido util ($W x $tile) y pegarla en su fila
  $r = New-Object System.Drawing.Rectangle(0, 0, $W, [math]::Min($tile, $t.Height))
  $c = $t.Clone($r, $t.PixelFormat)
  $g.DrawImageUnscaled($c, 0, $k * $tile)
  $c.Dispose(); $t.Dispose()
}
$g.Dispose()
$bmp.Save("$pwd\$Out")
$bmp.Dispose()
Remove-Item "$pwd\_tile*.png" -Confirm:$false
Write-Output "OK: $Out ($W x $H, $n teselas)"
