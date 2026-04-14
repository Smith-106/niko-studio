Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
$statePath = Join-Path $projectRoot '.codex-run\desktop-local-state.json'

if (-not (Test-Path $statePath)) {
  Write-Host "State file not found: $statePath"
  exit 0
}

$state = Get-Content -Path $statePath -Raw | ConvertFrom-Json
$stopped = @()

function Get-ChildProcessIds {
  param(
    [int]$ParentId
  )

  $children = @(Get-CimInstance Win32_Process -Filter "ParentProcessId = $ParentId" -ErrorAction SilentlyContinue)
  foreach ($child in $children) {
    $grandChildren = @(Get-ChildProcessIds -ParentId $child.ProcessId)
    foreach ($grandChildId in $grandChildren) {
      $grandChildId
    }
    $child.ProcessId
  }
}

function Stop-ManagedProcess {
  param(
    [string]$Label,
    [Nullable[int]]$ProcessId,
    [bool]$Managed
  )

  if (-not $Managed) {
    return
  }

  if ($null -eq $ProcessId) {
    return
  }

  $process = Get-Process -Id $ProcessId -ErrorAction SilentlyContinue
  if ($null -eq $process) {
    return
  }

  $childIds = @(Get-ChildProcessIds -ParentId $ProcessId)
  foreach ($childId in ($childIds | Sort-Object -Descending -Unique)) {
    $childProcess = Get-Process -Id $childId -ErrorAction SilentlyContinue
    if ($null -eq $childProcess) {
      continue
    }

    Stop-Process -Id $childId -Force -ErrorAction SilentlyContinue
    $script:stopped += "${Label}-child:$childId"
  }

  Stop-Process -Id $ProcessId -Force -ErrorAction SilentlyContinue
  $script:stopped += "${Label}:$ProcessId"
}

function Stop-ListenerOnPort {
  param(
    [Nullable[int]]$Port,
    [bool]$Managed
  )

  if (-not $Managed) {
    return
  }

  if ($null -eq $Port) {
    return
  }

  for ($attempt = 0; $attempt -lt 5; $attempt++) {
    $listeners = @(Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue)
    if ($listeners.Count -eq 0) {
      break
    }

    foreach ($listener in $listeners) {
      $processId = [int]$listener.OwningProcess
      $process = Get-Process -Id $processId -ErrorAction SilentlyContinue
      if ($null -eq $process) {
        continue
      }

      Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue
      $script:stopped += "gateway-port:$Port(pid=$processId)"
    }

    Start-Sleep -Milliseconds 500
  }
}

Stop-ManagedProcess -Label 'desktop' -ProcessId $state.desktop.pid -Managed ([bool]$state.desktop.managed)
Stop-ManagedProcess -Label 'desktop-launcher' -ProcessId $state.desktop.launcherPid -Managed ([bool]$state.desktop.managed)
Stop-ManagedProcess -Label 'gateway' -ProcessId $state.gateway.pid -Managed ([bool]$state.gateway.managed)
Stop-ListenerOnPort -Port $state.gateway.port -Managed ([bool]$state.gateway.managed)

Remove-Item -LiteralPath $statePath -Force -ErrorAction SilentlyContinue

if ($stopped.Count -eq 0) {
  Write-Host 'No managed local launcher processes were running.'
}
else {
  Write-Host ('Stopped ' + ($stopped -join ', '))
}

Write-Host "Removed state file: $statePath"
