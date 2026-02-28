@echo off
REM nmem - Nowledge Mem CLI
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

REM Find ncli module
SET "NCLI="
IF EXIST "%INSTALL_DIR%\_up_\python-standalone\app\src\nowledge_graph_server\ncli.py" SET "NCLI=%INSTALL_DIR%\_up_\python-standalone\app\src\nowledge_graph_server\ncli.py"
IF EXIST "%INSTALL_DIR%\python-standalone\app\src\nowledge_graph_server\ncli.py" SET "NCLI=%INSTALL_DIR%\python-standalone\app\src\nowledge_graph_server\ncli.py"

IF "%NCLI%"=="" (
    echo Error: Could not find nmem CLI module
    exit /b 1
)

REM Verify nmem_cli package is installed
"%PYTHON%" -c "import nmem_cli" >nul 2>&1
IF %ERRORLEVEL% neq 0 (
    echo Error: nmem_cli package not found in bundled Python
    echo This may indicate a corrupted installation.
    echo Try reinstalling Nowledge Mem.
    exit /b 1
)

REM Get the app source directory for PYTHONPATH
FOR %%I IN ("%NCLI%") DO SET "NCLI_DIR=%%~dpI"
FOR %%I IN ("%NCLI_DIR%..") DO SET "APP_SRC=%%~fI"
SET "PYTHONPATH=%APP_SRC%;%PYTHONPATH%"

REM Run the CLI
"%PYTHON%" "%NCLI%" %*
