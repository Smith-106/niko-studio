# nmem - Nowledge Mem CLI wrapper for Windows
# This script uses the bundled Python from the Tauri app installation

$ErrorActionPreference = "Stop"

# Get the directory where this script is located
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

# Function to find Python executable
function Find-Python {
    $possiblePaths = @(
        # Installed with the app (NSIS installer)
        "$env:LOCALAPPDATA\Nowledge Mem\_up_\python-standalone\python\python.exe",
        "$env:LOCALAPPDATA\Nowledge Mem\python-standalone\python\python.exe",
        "$env:ProgramFiles\Nowledge Mem\_up_\python-standalone\python\python.exe",
        "$env:ProgramFiles\Nowledge Mem\python-standalone\python\python.exe",
        # Relative to script (when script is in python-standalone)
        "$ScriptDir\python\python.exe",
        "$ScriptDir\..\python-standalone\python\python.exe",
        # Development
        "$ScriptDir\..\python-standalone\python\python.exe",
        "$ScriptDir\..\..\python-standalone\python\python.exe"
    )
    
    foreach ($path in $possiblePaths) {
        $resolvedPath = [System.IO.Path]::GetFullPath($path)
        if (Test-Path $resolvedPath) {
            return $resolvedPath
        }
    }
    
    # Fallback to system Python if bundled not found
    $systemPython = Get-Command python -ErrorAction SilentlyContinue
    if ($systemPython) {
        return $systemPython.Source
    }
    
    return $null
}

# Function to find ncli module
function Find-NcliModule {
    $possiblePaths = @(
        # Installed with the app
        "$env:LOCALAPPDATA\Nowledge Mem\_up_\python-standalone\app\src\nowledge_graph_server\ncli.py",
        "$env:LOCALAPPDATA\Nowledge Mem\python-standalone\app\src\nowledge_graph_server\ncli.py",
        "$env:ProgramFiles\Nowledge Mem\_up_\python-standalone\app\src\nowledge_graph_server\ncli.py",
        "$env:ProgramFiles\Nowledge Mem\python-standalone\app\src\nowledge_graph_server\ncli.py",
        # Relative to script
        "$ScriptDir\app\src\nowledge_graph_server\ncli.py",
        "$ScriptDir\..\python-standalone\app\src\nowledge_graph_server\ncli.py",
        # Development
        "$ScriptDir\..\nowledge-graph-py\src\nowledge_graph_server\ncli.py",
        "$ScriptDir\..\..\nowledge-graph-py\src\nowledge_graph_server\ncli.py"
    )
    
    foreach ($path in $possiblePaths) {
        $resolvedPath = [System.IO.Path]::GetFullPath($path)
        if (Test-Path $resolvedPath) {
            return $resolvedPath
        }
    }
    
    return $null
}

# Find Python
$Python = Find-Python
if (-not $Python) {
    Write-Error "Error: Could not find Python executable"
    Write-Error "Make sure Nowledge Mem is installed correctly."
    exit 1
}

# Find ncli module
$NcliModule = Find-NcliModule
if (-not $NcliModule) {
    Write-Error "Error: Could not find nmem CLI module"
    Write-Error "Make sure Nowledge Mem is installed correctly."
    exit 1
}

# Set PYTHONPATH for the app modules
$NcliDir = Split-Path -Parent $NcliModule
$AppSrcDir = Split-Path -Parent $NcliDir
$env:PYTHONPATH = "$AppSrcDir;$env:PYTHONPATH"

# Run the CLI
& $Python $NcliModule $args
