@echo off
setlocal
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0start_desktop_local.ps1" %*
