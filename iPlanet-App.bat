@echo off
setlocal
title iPlanet AI Store Locator

cd /d "D:\iPlanet AI Store Locator"

:MENU
cls
echo ==========================================
echo       iPlanet AI Store Locator
echo ==========================================
echo.
echo   1. Start Application
echo   2. Stop Application
echo   3. Exit
echo.
set /p choice="Enter your choice (1-3): "

if "%choice%"=="1" goto START
if "%choice%"=="2" goto STOP
if "%choice%"=="3" goto EXIT

echo Invalid choice.
pause
goto MENU

:START
cls
echo Starting iPlanet AI Store Locator...
echo.

if not exist "package.json" (
    echo ERROR: package.json not found.
    pause
    goto MENU
)

start "iPlanet AI Store Locator Server" cmd /k "cd /d ""D:\iPlanet AI Store Locator"" && npm run dev"

echo.
echo Server launched in a separate window.
echo Open http://localhost:3000 in your browser.
pause
goto MENU

:STOP
cls
echo Stopping application on port 3000...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$p = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue; if ($p) { $p.OwningProcess | Sort-Object -Unique | ForEach-Object { Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue; Write-Host ('Stopped process ID: ' + $_) } } else { Write-Host 'No application is listening on port 3000.' }"
echo.
pause
goto MENU

:EXIT
endlocal
exit /b