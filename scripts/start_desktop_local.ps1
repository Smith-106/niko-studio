param(
  [Alias('Host')]
  [string]$GatewayHost = '127.0.0.1',
  [int]$PreferredPort = 8000,
  [int]$FallbackPort = 8010,
  [switch]$BinaryDesktop,
  [switch]$NoDesktop,
  [switch]$NoReuseGateway,
  [switch]$ForceDesktop
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
$desktopDir = Join-Path $projectRoot 'desktop'
$desktopExe = Join-Path $desktopDir 'src-tauri\target\debug\niko-studio-desktop.exe'
$logDir = Join-Path $projectRoot '.codex-run'
$statePath = Join-Path $logDir 'desktop-local-state.json'

New-Item -ItemType Directory -Force -Path $logDir | Out-Null

function Test-GatewayHealth {
  param(
    [string]$GatewayHostName,
    [int]$Port
  )

  try {
    $response = Invoke-RestMethod -Method Get -Uri "http://${GatewayHostName}:$Port/health" -TimeoutSec 3
    return $response.status -in @('healthy', 'ok', 'degraded')
  }
  catch {
    return $false
  }
}

function Resolve-ListenerAddress {
  param(
    [string]$GatewayHostName
  )

  try {
    return [System.Net.IPAddress]::Parse($GatewayHostName)
  }
  catch {
    $addresses = [System.Net.Dns]::GetHostAddresses($GatewayHostName)
    $ipv4 = $addresses | Where-Object { $_.AddressFamily -eq [System.Net.Sockets.AddressFamily]::InterNetwork } | Select-Object -First 1
    if ($null -eq $ipv4) {
      throw "Unable to resolve IPv4 address for host '$GatewayHostName'."
    }
    return $ipv4
  }
}

function Test-PortAvailable {
  param(
    [string]$GatewayHostName,
    [int]$Port
  )

  $listener = $null
  try {
    $address = Resolve-ListenerAddress -GatewayHostName $GatewayHostName
    $listener = [System.Net.Sockets.TcpListener]::new($address, $Port)
    $listener.Start()
    return $true
  }
  catch {
    return $false
  }
  finally {
    if ($null -ne $listener) {
      $listener.Stop()
    }
  }
}

function Get-FreePort {
  param(
    [string]$GatewayHostName
  )

  $listener = [System.Net.Sockets.TcpListener]::new((Resolve-ListenerAddress -GatewayHostName $GatewayHostName), 0)
  $listener.Start()
  try {
    return $listener.LocalEndpoint.Port
  }
  finally {
    $listener.Stop()
  }
}

function Wait-GatewayHealthy {
  param(
    [string]$GatewayHostName,
    [int]$Port,
    [int]$TimeoutSeconds = 20
  )

  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  do {
    if (Test-GatewayHealth -GatewayHostName $GatewayHostName -Port $Port) {
      return $true
    }
    Start-Sleep -Milliseconds 500
  } while ((Get-Date) -lt $deadline)

  return $false
}

function Get-DesktopProcesses {
  return @(Get-Process niko-studio-desktop -ErrorAction SilentlyContinue | Sort-Object StartTime -Descending)
}

function Get-ExistingDesktopProcess {
  $existing = @(Get-DesktopProcesses)
  if ($existing.Count -eq 0) {
    return $null
  }

  return $existing[0]
}

function Wait-NewDesktopProcess {
  param(
    [int[]]$ExistingIds = @(),
    [int]$TimeoutSeconds = 20
  )

  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  do {
    $current = @(Get-DesktopProcesses)
    $newProcesses = @($current | Where-Object { $_.Id -notin $ExistingIds })
    if ($newProcesses.Count -gt 0) {
      return ($newProcesses | Sort-Object StartTime -Descending | Select-Object -First 1)
    }

    Start-Sleep -Milliseconds 500
  } while ((Get-Date) -lt $deadline)

  return $null
}

function Start-ManagedProcess {
  param(
    [string]$FilePath,
    [string[]]$ArgumentList = @(),
    [string]$WorkingDirectory,
    [hashtable]$EnvironmentVariables = @{},
    [string]$StdoutPath,
    [string]$StderrPath
  )

  function Format-CmdArgument {
    param(
      [string]$Value
    )

    if ($null -eq $Value) {
      return '""'
    }

    if ($Value -notmatch '[\s"&|<>^()]') {
      return $Value
    }

    return '"' + ($Value -replace '"', '""') + '"'
  }

  $startInfo = [System.Diagnostics.ProcessStartInfo]::new()
  $startInfo.FileName = 'cmd.exe'
  $startInfo.WorkingDirectory = $WorkingDirectory
  $startInfo.UseShellExecute = $false
  $startInfo.RedirectStandardOutput = $false
  $startInfo.RedirectStandardError = $false

  $invocationParts = @((Format-CmdArgument -Value $FilePath)) + @($ArgumentList | ForEach-Object { Format-CmdArgument -Value $_ })
  $commandLine = ($invocationParts -join ' ') + ' 1>' + (Format-CmdArgument -Value $StdoutPath) + ' 2>' + (Format-CmdArgument -Value $StderrPath)
  $startInfo.Arguments = '/d /s /c "' + $commandLine + '"'

  foreach ($entry in $EnvironmentVariables.GetEnumerator()) {
    $startInfo.Environment[$entry.Key] = [string]$entry.Value
  }

  $process = [System.Diagnostics.Process]::new()
  $process.StartInfo = $startInfo

  if (-not $process.Start()) {
    throw "Failed to start process: $FilePath"
  }

  return $process
}

$gatewayBase = $null
$gatewayProc = $null
$selectedPort = $null
$reusedGateway = $false

if (-not $NoReuseGateway) {
  foreach ($candidatePort in @($PreferredPort, $FallbackPort)) {
    if (Test-GatewayHealth -GatewayHostName $GatewayHost -Port $candidatePort) {
      $selectedPort = $candidatePort
      $reusedGateway = $true
      break
    }
  }
}

if ($null -eq $selectedPort) {
  foreach ($candidatePort in @($PreferredPort, $FallbackPort)) {
    if (Test-PortAvailable -GatewayHostName $GatewayHost -Port $candidatePort) {
      $selectedPort = $candidatePort
      break
    }
  }
}

if ($null -eq $selectedPort) {
  $selectedPort = Get-FreePort -GatewayHostName $GatewayHost
}

$gatewayBase = "http://${GatewayHost}:$selectedPort"

if (-not $reusedGateway) {
  $gatewayOut = Join-Path $logDir "gateway-$selectedPort.out.log"
  $gatewayErr = Join-Path $logDir "gateway-$selectedPort.err.log"
  $gatewayArgs = @(
    'scripts/start_gateway.py',
    '--host',
    $GatewayHost,
    '--port',
    [string]$selectedPort
  )

  $gatewayProc = Start-Process -FilePath python -ArgumentList $gatewayArgs -WorkingDirectory $projectRoot -PassThru -RedirectStandardOutput $gatewayOut -RedirectStandardError $gatewayErr

  if (-not (Wait-GatewayHealthy -GatewayHostName $GatewayHost -Port $selectedPort)) {
    throw "Gateway did not become healthy on $gatewayBase. Check $gatewayOut and $gatewayErr."
  }
}

$desktopProc = $null
$desktopLauncherProc = $null
$desktopOut = $null
$desktopErr = $null
$desktopManaged = $false
$desktopMode = 'disabled'
$reusedDesktop = $false

if (-not $NoDesktop) {
  $existingDesktop = $null
  $currentDesktop = Get-ExistingDesktopProcess
  if (-not $ForceDesktop) {
    $existingDesktop = $currentDesktop
  }

  if ($null -ne $existingDesktop) {
    $desktopProc = $existingDesktop
    $desktopMode = 'existing'
    $reusedDesktop = $true
  }
  else {
    $existingDesktopIds = @(Get-DesktopProcesses | Select-Object -ExpandProperty Id)
    $desktopOut = Join-Path $logDir "desktop-$selectedPort.out.log"
    $desktopErr = Join-Path $logDir "desktop-$selectedPort.err.log"
    $desktopEnv = @{
      NIKO_GATEWAY_URL = $gatewayBase
    }

    $preferBinaryDesktop = $BinaryDesktop -or ($ForceDesktop -and $null -ne $currentDesktop)

    if ($preferBinaryDesktop) {
      if (-not (Test-Path $desktopExe)) {
        throw "Desktop binary is unavailable: $desktopExe"
      }

      $desktopLauncherProc = Start-ManagedProcess -FilePath $desktopExe -WorkingDirectory $desktopDir -StdoutPath $desktopOut -StderrPath $desktopErr -EnvironmentVariables $desktopEnv
      $desktopProc = Wait-NewDesktopProcess -ExistingIds $existingDesktopIds -TimeoutSeconds 10
      if ($null -eq $desktopProc) {
        $desktopProc = $desktopLauncherProc
      }
      $desktopMode = if ($ForceDesktop -and $null -ne $currentDesktop -and -not $BinaryDesktop) { 'binary-force' } else { 'binary' }
    }
    else {
      $desktopLauncherProc = Start-ManagedProcess -FilePath 'npm.cmd' -ArgumentList @('run', 'tauri:dev') -WorkingDirectory $desktopDir -StdoutPath $desktopOut -StderrPath $desktopErr -EnvironmentVariables $desktopEnv
      $desktopProc = Wait-NewDesktopProcess -ExistingIds $existingDesktopIds
      if ($null -eq $desktopProc -and $desktopLauncherProc.HasExited) {
        if (-not (Test-Path $desktopExe)) {
          throw "tauri-dev launcher exited before a new desktop window appeared. Check $desktopOut and $desktopErr."
        }

        $desktopLauncherProc = Start-ManagedProcess -FilePath $desktopExe -WorkingDirectory $desktopDir -StdoutPath $desktopOut -StderrPath $desktopErr -EnvironmentVariables $desktopEnv
        $desktopProc = Wait-NewDesktopProcess -ExistingIds $existingDesktopIds -TimeoutSeconds 10
        if ($null -eq $desktopProc) {
          $desktopProc = $desktopLauncherProc
        }
        $desktopMode = 'binary-fallback'
      }
      else {
        $desktopMode = 'tauri-dev'
      }
    }

    $desktopManaged = $true
  }
}

$statePayload = [ordered]@{
  savedAt = (Get-Date).ToString('o')
  gateway = [ordered]@{
    base = $gatewayBase
    host = $GatewayHost
    port = $selectedPort
    mode = if ($reusedGateway) { 'reused-existing' } else { 'started-new' }
    pid = if ($null -ne $gatewayProc) { $gatewayProc.Id } else { $null }
    managed = ($null -ne $gatewayProc)
  }
  desktop = [ordered]@{
    pid = if ($null -ne $desktopProc) { $desktopProc.Id } else { $null }
    launcherPid = if ($null -ne $desktopLauncherProc) { $desktopLauncherProc.Id } else { $null }
    managed = $desktopManaged
    mode = $desktopMode
  }
  logs = [ordered]@{
    gatewayOut = if ($null -ne $gatewayProc) { $gatewayOut } else { $null }
    gatewayErr = if ($null -ne $gatewayProc) { $gatewayErr } else { $null }
    desktopOut = $desktopOut
    desktopErr = $desktopErr
  }
}

$statePayload | ConvertTo-Json -Depth 5 | Set-Content -Path $statePath -Encoding utf8

Write-Host ''
Write-Host 'Niko Studio local launcher' -ForegroundColor Cyan
Write-Host "Gateway base: $gatewayBase"
Write-Host "Gateway mode: $(if ($reusedGateway) { 'reused-existing' } else { 'started-new' })"
if ($null -ne $gatewayProc) {
  Write-Host "Gateway PID: $($gatewayProc.Id)"
  Write-Host "Gateway logs: $(Join-Path $logDir "gateway-$selectedPort.out.log")"
}
if ($null -ne $desktopProc) {
  Write-Host "Desktop PID: $($desktopProc.Id)"
  Write-Host "Desktop mode: $(if ($reusedDesktop) { 'reused-existing' } else { $desktopMode })"
  if ($desktopManaged -and -not [string]::IsNullOrWhiteSpace($desktopOut)) {
    Write-Host "Desktop logs: $desktopOut"
  }
}
elseif ($null -ne $desktopLauncherProc) {
  Write-Host "Desktop launcher PID: $($desktopLauncherProc.Id)"
  Write-Host "Desktop mode: $desktopMode"
  if ($desktopManaged -and -not [string]::IsNullOrWhiteSpace($desktopOut)) {
    Write-Host "Desktop logs: $desktopOut"
  }
}
Write-Host "State file: $statePath"
Write-Host ''

exit 0
