$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $PSScriptRoot
$serviceRoot = Join-Path $repoRoot 'services\local-clipper'
$venvRoot = Join-Path $repoRoot '.local-clipper-venv'
$pythonPath = Join-Path $venvRoot 'Scripts\python.exe'

# FFmpeg is called as a bare `ffmpeg`/`ffprobe` by the clipper service, so it
# has to be on PATH. winget installs it but does not always create its PATH
# shim, which left the clipper refusing to start even though FFmpeg was
# present. Look for it properly before giving up.
function Resolve-FfmpegBin {
  if (Get-Command ffmpeg -ErrorAction SilentlyContinue) { return $null }  # already usable

  $candidates = @(
    (Join-Path $env:LOCALAPPDATA 'Microsoft\WinGet\Links\ffmpeg.exe'),
    (Join-Path $env:ProgramData 'chocolatey\bin\ffmpeg.exe'),
    'C:\ffmpeg\bin\ffmpeg.exe',
    (Join-Path $env:ProgramFiles 'ffmpeg\bin\ffmpeg.exe')
  )
  foreach ($candidate in $candidates) {
    if (Test-Path $candidate) { return (Split-Path -Parent $candidate) }
  }

  # winget keeps the real binaries under a versioned package directory.
  $roots = @(
    (Join-Path $env:LOCALAPPDATA 'Microsoft\WinGet\Packages'),
    (Join-Path $env:ProgramFiles 'WinGet\Packages')
  )
  foreach ($root in $roots) {
    if (-not (Test-Path $root)) { continue }
    $match = Get-ChildItem $root -Recurse -Filter 'ffmpeg.exe' -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($match) { return $match.DirectoryName }
  }
  return 'NOTFOUND'
}

$ffmpegBin = Resolve-FfmpegBin
if ($ffmpegBin -eq 'NOTFOUND') {
  Write-Host 'FFmpeg is required. Install it with: winget install Gyan.FFmpeg' -ForegroundColor Yellow
  Write-Host 'If it is already installed, reopen this window so PATH refreshes, then try again.' -ForegroundColor DarkGray
  exit 1
}
if ($ffmpegBin) {
  # Only for this process and the clipper it launches - the user's PATH is untouched.
  $env:PATH = "$ffmpegBin;$env:PATH"
  Write-Host "Using FFmpeg from: $ffmpegBin" -ForegroundColor DarkGray
}

if (-not (Get-Command ffprobe -ErrorAction SilentlyContinue)) {
  Write-Host 'FFmpeg was found but ffprobe is missing beside it; install the full FFmpeg build.' -ForegroundColor Yellow
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
  $fileInfo = Get-Item $cookiePath
  if ($fileInfo.Length -gt 20) {
    $firstLines = Get-Content $cookiePath -Head 5 -ErrorAction SilentlyContinue
    if ($firstLines -match 'Netscape|# HTTP Cookie' -or ($firstLines -match "`t")) {
      $env:YT_COOKIES_FILE = $cookiePath
      Write-Host "Using local cookies file: $cookiePath" -ForegroundColor DarkGray
    }
  }
}

Write-Host ''
Write-Host 'MuviDB desktop clipper is ready at http://127.0.0.1:4317' -ForegroundColor Green
Write-Host 'Keep this window open while clipping. Press Ctrl+C when finished.' -ForegroundColor DarkGray
Write-Host ''

& $pythonPath -m uvicorn main:app --app-dir $serviceRoot --host 127.0.0.1 --port 4317
