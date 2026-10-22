param([string]$Uri)
$repoRoot = Split-Path -Parent $PSScriptRoot
if ($Uri -match ':stop') { & (Join-Path $repoRoot 'scripts\stop-local-social-clipper.ps1') }
else { Start-Process powershell.exe -ArgumentList '-NoProfile','-ExecutionPolicy','Bypass','-File',(Join-Path $repoRoot 'scripts\start-local-social-clipper.ps1') }
