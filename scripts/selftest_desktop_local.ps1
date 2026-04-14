param(
  [Alias('Host')]
  [string]$GatewayHost = '127.0.0.1',
  [int]$PreferredPort = 18100,
  [int]$FallbackPort = 18101
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
$statePath = Join-Path $projectRoot '.codex-run\desktop-local-state.json'

function Assert-True {
  param(
    [bool]$Condition,
    [string]$Message
  )

  if (-not $Condition) {
    throw $Message
  }
}

function Test-Health {
  param(
    [string]$Base
  )

  try {
    $response = Invoke-RestMethod -Method Get -Uri ($Base.TrimEnd('/') + '/health') -TimeoutSec 5
    return $response.status -in @('healthy', 'ok', 'degraded')
  }
  catch {
    return $false
  }
}

function Test-PortClosed {
  param(
    [int]$Port
  )

  return -not [bool](Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue)
}

try {
  Write-Host ''
  Write-Host 'Niko Studio local launcher self-test' -ForegroundColor Cyan

  if (Test-Path $statePath) {
    Remove-Item -LiteralPath $statePath -Force -ErrorAction SilentlyContinue
  }

  & (Join-Path $PSScriptRoot 'start_desktop_local.ps1') -NoDesktop -NoReuseGateway -GatewayHost $GatewayHost -PreferredPort $PreferredPort -FallbackPort $FallbackPort | Out-Host

  Assert-True -Condition (Test-Path $statePath) -Message "State file was not created: $statePath"

  $state = Get-Content -Path $statePath -Raw | ConvertFrom-Json
  $base = [string]$state.gateway.base
  $port = [int]$state.gateway.port

  Assert-True -Condition ([string]::IsNullOrWhiteSpace($base) -eq $false) -Message 'Gateway base was empty in state file.'
  Assert-True -Condition ($port -in @($PreferredPort, $FallbackPort) -or $port -gt 0) -Message "Invalid gateway port recorded: $port"
  Assert-True -Condition (Test-Health -Base $base) -Message "Gateway health check failed for $base"

  & (Join-Path $PSScriptRoot 'status_desktop_local.ps1') | Out-Host
  & (Join-Path $PSScriptRoot 'stop_desktop_local.ps1') | Out-Host

  Start-Sleep -Seconds 2
  Assert-True -Condition (Test-PortClosed -Port $port) -Message "Gateway port still listening after stop: $port"
  Assert-True -Condition (-not (Test-Path $statePath)) -Message "State file still exists after stop: $statePath"

  Write-Host 'Self-test: PASS' -ForegroundColor Green
  Write-Host ''
}
catch {
  Write-Error $_
  exit 1
}
