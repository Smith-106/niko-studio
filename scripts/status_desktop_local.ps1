Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
$statePath = Join-Path $projectRoot '.codex-run\desktop-local-state.json'

function Test-GatewayHealth {
  param(
    [string]$GatewayBase
  )

  if ([string]::IsNullOrWhiteSpace($GatewayBase)) {
    return $false
  }

  $base = $GatewayBase.TrimEnd('/')
  try {
    $response = Invoke-RestMethod -Method Get -Uri "$base/health" -TimeoutSec 3
    return $response.status -in @('healthy', 'ok', 'degraded')
  }
  catch {
    return $false
  }
}

$discoveredGateways = @()
foreach ($candidatePort in @(8000, 8010)) {
  $candidateBase = "http://127.0.0.1:$candidatePort"
  if (Test-GatewayHealth -GatewayBase $candidateBase) {
    $discoveredGateways += $candidateBase
  }
}

$state = $null
if (Test-Path $statePath) {
  $state = Get-Content -Path $statePath -Raw | ConvertFrom-Json
}

$desktopProcesses = @(Get-Process niko-studio-desktop -ErrorAction SilentlyContinue | Sort-Object StartTime -Descending)
$trackedGatewayBase = if ($null -ne $state) { [string]$state.gateway.base } else { '' }
$trackedGatewayHealthy = Test-GatewayHealth -GatewayBase $trackedGatewayBase
$trackedDesktopPid = if ($null -ne $state) { $state.desktop.pid } else { $null }
$trackedDesktopLauncherPid = if ($null -ne $state) { $state.desktop.launcherPid } else { $null }
$trackedDesktopAlive = $false
if ($null -ne $trackedDesktopPid) {
  $trackedDesktopAlive = [bool](Get-Process -Id $trackedDesktopPid -ErrorAction SilentlyContinue)
}
$trackedDesktopLauncherAlive = $false
if ($null -ne $trackedDesktopLauncherPid) {
  $trackedDesktopLauncherAlive = [bool](Get-Process -Id $trackedDesktopLauncherPid -ErrorAction SilentlyContinue)
}

Write-Host ''
Write-Host 'Niko Studio local status' -ForegroundColor Cyan
Write-Host "State file: $(if (Test-Path $statePath) { $statePath } else { 'missing' })"

if ($null -ne $state) {
  Write-Host "Tracked gateway: $($state.gateway.base)"
  Write-Host "Tracked gateway mode: $($state.gateway.mode)"
  Write-Host "Tracked gateway managed: $($state.gateway.managed)"
  Write-Host "Tracked gateway healthy: $trackedGatewayHealthy"
  Write-Host "Tracked desktop pid: $($state.desktop.pid)"
  Write-Host "Tracked desktop launcher pid: $($state.desktop.launcherPid)"
  Write-Host "Tracked desktop managed: $($state.desktop.managed)"
  Write-Host "Tracked desktop alive: $trackedDesktopAlive"
  Write-Host "Tracked desktop launcher alive: $trackedDesktopLauncherAlive"
}
else {
  Write-Host 'Tracked gateway: none'
}

if ($discoveredGateways.Count -eq 0) {
  Write-Host 'Discovered healthy gateways: none'
}
else {
  Write-Host ('Discovered healthy gateways: ' + ($discoveredGateways -join ', '))
}

if ($desktopProcesses.Count -eq 0) {
  Write-Host 'Desktop processes: none'
}
else {
  Write-Host 'Desktop processes:'
  foreach ($process in $desktopProcesses) {
    Write-Host "  - pid=$($process.Id) title=$($process.MainWindowTitle) started=$($process.StartTime.ToString('o'))"
  }
}

Write-Host ''
