param(
  [switch]$Strict,
  [int]$Port = 8000,
  [string]$Host = "127.0.0.1"
)

$uri = "http://$Host:$Port/writing-helper/process"
$failedFile = Join-Path (Get-Location) "failed-writing-helper-cases.json"

function Test-StrictPolish {
  param(
    [string]$inputContent,
    [object]$response
  )
  if (-not $response.processed_text) { return $false }

  $inputHasParagraphGap = $inputContent -match "(\r?\n){2,}"
  if ($inputHasParagraphGap) {
    return ($response.processed_text -match "(\r?\n){2,}")
  }
  return $true
}

function Test-StrictExpand {
  param(
    [string]$inputContent,
    [object]$response
  )
  if (-not $response.processed_text) { return $false }

  $count = ([regex]::Matches($response.processed_text, "进一步展开：")).Count
  return ($count -eq 1)
}

$cases = @(
  @{
    name = "polish"
    body = @{
      content = "第一句。 第一句。`n`n`n第二句。"
      mode    = "polish"
    }
    assert = {
      param($r)
      ($r.mode -eq "polish") -and
      ($r.processed_text -match "第一句。") -and
      ($r.processed_text -match "第二句。") -and
      ($r.processed_text -notmatch "第一句。 第一句。")
    }
    expect = "mode=polish；去重后仍包含第一句/第二句"
    strictAssert = {
      param($inputBody, $r)
      Test-StrictPolish -inputContent $inputBody.content -response $r
    }
    strictExpect = "Strict: polish 保留段落空行（输入有双换行时输出也应有）"
  },
  @{
    name = "rewrite"
    body = @{
      content = "第一句。 第一句。"
      mode    = "rewrite"
    }
    assert = {
      param($r)
      ($r.mode -eq "rewrite") -and
      ($r.processed_text -eq "第一句。")
    }
    expect = "mode=rewrite；processed_text=第一句。"
  },
  @{
    name = "expand"
    body = @{
      content = "第一句。"
      mode    = "expand"
    }
    assert = {
      param($r)
      ($r.mode -eq "expand") -and
      ($r.processed_text -match "进一步展开：第一句。")
    }
    expect = "mode=expand；包含“进一步展开：第一句。”"
    strictAssert = {
      param($inputBody, $r)
      Test-StrictExpand -inputContent $inputBody.content -response $r
    }
    strictExpect = "Strict: expand 恰好新增 1 个“进一步展开：”段"
  },
  @{
    name = "summarize"
    body = @{
      content       = "第一句。第二句。第三句。"
      mode          = "summarize"
      max_sentences = 2
    }
    assert = {
      param($r)
      ($r.mode -eq "summarize") -and
      ($r.processed_text -eq "第一句。 第二句。")
    }
    expect = "mode=summarize；仅前两句"
  },
  @{
    name = "outline"
    body = @{
      content   = "第一段。`n第二段。"
      mode      = "outline"
      max_items = 2
    }
    assert = {
      param($r)
      ($r.mode -eq "outline") -and
      ($null -ne $r.outline) -and
      ($r.outline.Count -eq 2)
    }
    expect = "mode=outline；outline 两项"
  },
  @{
    name = "action-alias"
    body = @{
      content = "第一句。"
      action  = "rewrite"
    }
    assert = {
      param($r)
      ($r.mode -eq "rewrite")
    }
    expect = "仅 action=rewrite 时返回 mode=rewrite"
  },
  @{
    name = "mode-priority"
    body = @{
      content = "第一句。"
      mode    = "expand"
      action  = "rewrite"
    }
    assert = {
      param($r)
      ($r.mode -eq "expand") -and
      ($r.processed_text -match "进一步展开：第一句。")
    }
    expect = "mode 与 action 同时存在时，mode 优先"
  }
)

$passed = 0
$failed = 0
$results = @()
$failedCases = @()

foreach ($c in $cases) {
  Write-Host ""
  Write-Host "=== $($c.name) ===" -ForegroundColor Cyan

  $reqJson = $c.body | ConvertTo-Json -Depth 10 -Compress

  try {
    $resp = Invoke-RestMethod -Method Post -Uri $uri -ContentType "application/json" -Body $reqJson
    $baseOk = & $c.assert $resp
    $strictOk = $true

    if ($Strict -and $c.ContainsKey("strictAssert")) {
      $strictOk = & $c.strictAssert $c.body $resp
    }

    $ok = $baseOk -and $strictOk

    if ($ok) {
      $passed++
      Write-Host "PASS" -ForegroundColor Green
    } else {
      $failed++
      Write-Host "FAIL: assertion not met" -ForegroundColor Red
      Write-Host "Expected: $($c.expect)" -ForegroundColor Yellow
      if ($Strict -and $c.ContainsKey("strictExpect")) {
        Write-Host "$($c.strictExpect)" -ForegroundColor Yellow
      }

      $failedCases += [PSCustomObject]@{
        case       = $c.name
        reason     = "assertion_failed"
        strictMode = [bool]$Strict
        expected   = $c.expect
        strictExpected = if ($Strict -and $c.ContainsKey("strictExpect")) { $c.strictExpect } else { $null }
        request    = $c.body
        response   = $resp
      }
    }

    $results += [PSCustomObject]@{
      case           = $c.name
      status         = if ($ok) { "PASS" } else { "FAIL" }
      mode           = $resp.mode
      processed_text = $resp.processed_text
      outline        = if ($resp.outline) { ($resp.outline -join " | ") } else { $null }
      stats          = if ($resp.stats) { ($resp.stats | ConvertTo-Json -Compress) } else { $null }
    }
  }
  catch {
    $failed++
    $errMsg = $_.Exception.Message
    $errBody = if ($_.ErrorDetails -and $_.ErrorDetails.Message) { $_.ErrorDetails.Message } else { $null }

    Write-Host "FAIL: request error" -ForegroundColor Red
    Write-Host $errMsg -ForegroundColor Yellow
    if ($errBody) {
      Write-Host "Error body: $errBody" -ForegroundColor Yellow
    }

    $failedCases += [PSCustomObject]@{
      case       = $c.name
      reason     = "request_error"
      strictMode = [bool]$Strict
      expected   = $c.expect
      request    = $c.body
      error      = [PSCustomObject]@{
        message = $errMsg
        body    = $errBody
      }
    }

    $results += [PSCustomObject]@{
      case           = $c.name
      status         = "ERROR"
      mode           = $null
      processed_text = $null
      outline        = $null
      stats          = $null
    }
  }
}

$total = $cases.Count
$rate = if ($total -gt 0) { [Math]::Round(($passed * 100.0) / $total, 2) } else { 0 }

if ($failedCases.Count -gt 0) {
  $failedCases | ConvertTo-Json -Depth 20 | Set-Content -Path $failedFile -Encoding UTF8
} elseif (Test-Path $failedFile) {
  Remove-Item $failedFile -Force
}

Write-Host ""
Write-Host "===== SUMMARY =====" -ForegroundColor Magenta
Write-Host "Strict Mode: $Strict" -ForegroundColor Cyan
Write-Host "Passed: $passed / $total" -ForegroundColor Green
Write-Host "Failed: $failed / $total" -ForegroundColor Red
Write-Host "Pass Rate: $rate%" -ForegroundColor Cyan

if ($failedCases.Count -gt 0) {
  Write-Host "Failed cases exported: $failedFile" -ForegroundColor Yellow
} else {
  Write-Host "No failed cases. (no export file)" -ForegroundColor Green
}

Write-Host ""
$results | Format-Table -AutoSize case, status, mode
