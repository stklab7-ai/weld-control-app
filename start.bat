@echo off
chcp 65001 >nul 2>&1
setlocal enabledelayedexpansion

:: Get local IP
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /c:"IPv4"') do (
    set "IP=%%a"
    set "IP=!IP: =!"
    if not "!IP!"=="127.0.0.1" goto :found
)
:found
if "%IP%"=="" set "IP=localhost"

echo ============================================
echo   WELD CONTROL - Request Management
echo ============================================
echo.
echo Starting local server on port 8080...
echo.
echo Local access:     http://localhost:8080
echo Network access:   http://%IP%:8080
echo.

:: Try to find VS Code in common locations
set "VSCodePath="
if exist "C:\Program Files\Microsoft VS Code\bin\code.exe" (
    set "VSCodePath=C:\Program Files\Microsoft VS Code\bin\code.exe"
)
if exist "C:\Program Files (x86)\Microsoft VS Code\bin\code.exe" (
    set "VSCodePath=C:\Program Files (x86)\Microsoft VS Code\bin\code.exe"
)
if exist "%USERPROFILE%\AppData\Local\Programs\Microsoft VS Code\bin\code.exe" (
    set "VSCodePath=%USERPROFILE%\AppData\Local\Programs\Microsoft VS Code\bin\code.exe"
)

if defined VSCodePath (
    echo Opening VS Code with Ports view...
    start "" "%VSCodePath%" .
    timeout /t 3 /nobreak >nul
    
    echo.
    echo To share via VS Code:
    echo 1. In VS Code, press Ctrl+Shift+P
    echo 2. Type "Ports: Focus on Ports View" and press Enter
    echo 3. Click "Forward a Port" -> enter 8080
    echo 4. Copy the public URL from the list
    echo.
) else (
    echo VS Code not found. To share manually:
    echo 1. Install VS Code from https://code.visualstudio.com/
    echo 2. Or use ngrok: https://ngrok.com/
    echo 3. Or configure port forwarding on your router
    echo.
)

echo Press Ctrl+C to stop server
echo ============================================
echo.

cd /d "%~dp0"

:: Check for Python
python --version >nul 2>&1
if %errorlevel% equ 0 (
    echo Starting via Python...
    start "" "http://localhost:8080/"
    python -m http.server 8080 --bind 0.0.0.0
    goto :end
)

:: Check for Node.js http-server
where http-server >nul 2>&1
if %errorlevel% equ 0 (
    echo Starting via Node.js http-server...
    start "" "http://localhost:8080/"
    http-server -p 8080 -a 0.0.0.0
    goto :end
)

:: Fallback
echo Warning: Python or Node.js not found.
start index.html

:end
pause