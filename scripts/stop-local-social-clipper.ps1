$ErrorActionPreference = 'SilentlyContinue'
$listeners = Get-NetTCPConnection -LocalPort 4317 -State Listen
foreach ($listener in $listeners) {
  Stop-Process -Id $listener.OwningProcess -Force
}
Write-Host 'MuviDB desktop clipper stopped.' -ForegroundColor Yellow
