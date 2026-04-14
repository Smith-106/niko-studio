@echo off
setlocal
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0selftest_desktop_local.ps1" %*
