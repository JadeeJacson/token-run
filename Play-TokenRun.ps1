# 双击友好：另开一个保持打开的 PowerShell 窗口跑游戏
$script = Join-Path $PSScriptRoot 'start-game.ps1'
$psExe = Join-Path $env:WINDIR 'System32\WindowsPowerShell\v1.0\powershell.exe'
if (-not (Test-Path $psExe)) { $psExe = 'powershell' }

Start-Process -FilePath $psExe -ArgumentList @(
  '-NoExit',
  '-NoProfile',
  '-ExecutionPolicy', 'Bypass',
  '-File', "`"$script`""
) -WorkingDirectory $PSScriptRoot
