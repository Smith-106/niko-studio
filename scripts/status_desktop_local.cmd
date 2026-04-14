@echo off
setlocal
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0status_desktop_local.ps1" %*
