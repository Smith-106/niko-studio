@echo off
REM browse-now - Browser Automation CLI
REM Uses bundled Python from the Nowledge Mem installation

SET "INSTALL_DIR=C:\Users\WeyGu\AppData\Local\Nowledge Mem"

REM Find bundled Python
SET "PYTHON="
IF EXIST "%INSTALL_DIR%\_up_\python-standalone\python\python.exe" SET "PYTHON=%INSTALL_DIR%\_up_\python-standalone\python\python.exe"
IF EXIST "%INSTALL_DIR%\python-standalone\python\python.exe" SET "PYTHON=%INSTALL_DIR%\python-standalone\python\python.exe"

IF "%PYTHON%"=="" (
    echo Error: Could not find bundled Python
    echo Make sure Nowledge Mem is installed correctly.
    exit /b 1
)

REM Run browse-now via module entry point
"%PYTHON%" -c "from browse_now.cli import main; main()" %*
