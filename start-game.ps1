# Token Run 2.0 launcher (PowerShell)
# Usage:
#   powershell -NoProfile -ExecutionPolicy Bypass -File .\start-game.ps1
#   .\start-game.ps1 -Port 5174
#   .\start-game.ps1 -Preview

[CmdletBinding()]
param(
  [int]$Port = 5173,
  [switch]$Preview,
  [switch]$SkipOpen
)

$ErrorActionPreference = 'Continue'
try { $host.UI.RawUI.WindowTitle = 'Token Run 2.0' } catch {}
Set-Location -LiteralPath $PSScriptRoot

function Write-Step([string]$msg, [string]$color = 'Cyan') {
  Write-Host "[token-run] $msg" -ForegroundColor $color
}

Write-Host '============================================' -ForegroundColor DarkCyan
Write-Host ' Token Run 2.0 launcher' -ForegroundColor Cyan
Write-Host " Path: $PSScriptRoot"
Write-Host '============================================' -ForegroundColor DarkCyan
Write-Host ''

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Write-Step 'Node.js not found. Install Node 20+ and reopen terminal.' 'Red'
  Read-Host 'Press Enter to exit'
  exit 1
}

Write-Step "Node $(node -v)"

$hasModules = Test-Path (Join-Path $PSScriptRoot 'node_modules/vite')
if (-not $hasModules) {
  Write-Step 'First run: installing dependencies (npm ci)...'
  if (Test-Path (Join-Path $PSScriptRoot 'package-lock.json')) { npm ci } else { npm install }
  if ($LASTEXITCODE -ne 0) {
    Write-Step 'Dependency install failed. Check network, then retry.' 'Red'
    Read-Host 'Press Enter to exit'
    exit 1
  }
} else {
  Write-Step 'Dependencies already present'
}

Write-Host ''
Write-Step "Open: http://127.0.0.1:$Port/"
Write-Step 'If the browser does not open, visit the URL manually. Close this window to stop.'

if ($Preview) {
  Write-Step 'Building production bundle...'
  npm run build
  if ($LASTEXITCODE -ne 0) {
    Read-Host 'Press Enter to exit'
    exit 1
  }
  npm run preview -- --host 127.0.0.1 --port $Port
} elseif ($SkipOpen) {
  npm run dev -- --host 127.0.0.1 --port $Port
} else {
  npm run play -- --port $Port
}

Write-Host ''
Write-Step "Process ended, exit code $LASTEXITCODE" 'Yellow'
Read-Host 'Press Enter to exit'
exit $LASTEXITCODE
