# Start backend script for Windows
$SCRIPT_DIR = $PSScriptRoot
$PYTHON_EXEC = Join-Path $SCRIPT_DIR "python\python.exe"
$BACKEND_SCRIPT = Join-Path $SCRIPT_DIR "start_backend.py"

if (-not $env:NOWLEDGE_CLOUDFLARED_PATH) {
    $cloudflaredCandidate = Join-Path $SCRIPT_DIR "cloudflared.exe"
    if (Test-Path $cloudflaredCandidate) {
        $env:NOWLEDGE_CLOUDFLARED_PATH = $cloudflaredCandidate
        Write-Host "Using bundled cloudflared: $cloudflaredCandidate"
    }
}

if (-not (Test-Path $PYTHON_EXEC)) {
    Write-Host "ERROR: Python executable not found: $PYTHON_EXEC"
    exit 1
}

if (-not (Test-Path $BACKEND_SCRIPT)) {
    Write-Host "ERROR: Backend script not found: $BACKEND_SCRIPT"
    exit 1
}

Write-Host "Starting Nowledge Graph backend..."
& $PYTHON_EXEC $BACKEND_SCRIPT
