$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $PSScriptRoot
$serviceRoot = Join-Path $repoRoot 'services\local-clipper'
$venvRoot = Join-Path $repoRoot '.local-clipper-venv'
$pythonPath = Join-Path $venvRoot 'Scripts\python.exe'

if (-not (Get-Command ffmpeg -ErrorAction SilentlyContinue)) {
  Write-Host 'FFmpeg is required. Install it with: winget install Gyan.FFmpeg' -ForegroundColor Yellow
  exit 1
}

if (-not (Test-Path $pythonPath)) {
  Write-Host 'Preparing the free MuviDB desktop clipper...' -ForegroundColor Cyan
  py -3 -m venv $venvRoot
}

& $pythonPath -m pip install --disable-pip-version-check --prefer-binary --timeout 120 --retries 8 -q -r (Join-Path $serviceRoot 'requirements.txt')
if ($LASTEXITCODE -ne 0) {
  Write-Host 'The clipper dependencies could not be installed. Check the error above, then run this script again.' -ForegroundColor Red
  exit $LASTEXITCODE
}
$env:PYTHONPATH = $serviceRoot
$cookiePath = Join-Path $repoRoot 'cookies.txt'
if (Test-Path $cookiePath) {
  $env:YT_COOKIES_FILE = $cookiePath
  Write-Host "Using local cookies file: $cookiePath" -ForegroundColor DarkGray
}

Write-Host ''
Write-Host 'MuviDB desktop clipper is ready at http://127.0.0.1:4317' -ForegroundColor Green
Write-Host 'Keep this window open while clipping. Press Ctrl+C when finished.' -ForegroundColor DarkGray
Write-Host ''

& $pythonPath -m uvicorn main:app --app-dir $serviceRoot --host 127.0.0.1 --port 4317
