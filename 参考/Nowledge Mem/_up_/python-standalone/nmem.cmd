@echo off
REM nmem - Nowledge Mem CLI wrapper for Windows (batch file)
REM This redirects to the PowerShell script

SET "SCRIPT_DIR=%~dp0"

REM Check if PowerShell is available
where powershell >nul 2>nul
if %ERRORLEVEL% neq 0 (
    echo Error: PowerShell is required to run nmem
    exit /b 1
)

REM Run the PowerShell script
powershell -ExecutionPolicy Bypass -File "%SCRIPT_DIR%nmem.ps1" %*
