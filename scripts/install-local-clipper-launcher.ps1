$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path -Parent $PSScriptRoot
$startScript = Join-Path $repoRoot 'scripts\start-local-social-clipper.ps1'
$stopScript = Join-Path $repoRoot 'scripts\stop-local-social-clipper.ps1'
if (-not (Test-Path $startScript)) { throw "Clipper start script not found: $startScript" }

# Registers muvidb-clipper://start for the signed-in Windows user only.
$protocol = 'HKCU:\Software\Classes\muvidb-clipper'
New-Item -Path $protocol -Force | Out-Null
Set-ItemProperty -Path $protocol -Name '(Default)' -Value 'URL:MuviDB Desktop Clipper'
New-ItemProperty -Path $protocol -Name 'URL Protocol' -Value '' -PropertyType String -Force | Out-Null
$command = Join-Path $protocol 'shell\open\command'
New-Item -Path $command -Force | Out-Null
$escaped = $startScript.Replace('"', '\"')
$escapedStop = $stopScript.Replace('"', '\"')
# The protocol receives either start or stop as its final argument.
$dispatcher = Join-Path $repoRoot 'scripts\clipper-protocol-dispatch.ps1'
Set-ItemProperty -Path $command -Name '(Default)' -Value "powershell.exe -NoProfile -ExecutionPolicy Bypass -File `"$dispatcher`" `%1"
Write-Host 'MuviDB clipper launcher installed. Return to Social Studio and click Start desktop clipper.' -ForegroundColor Green
