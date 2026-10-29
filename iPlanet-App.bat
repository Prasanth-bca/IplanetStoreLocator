@echo off
setlocal enabledelayedexpansion
title iPlanet AI Store Locator

cd /d "%~dp0"

:MENU
cls
echo ===================================================
echo             iPlanet AI Store Locator
echo ===================================================
echo.
echo   1. Start Application (Dev Server)
echo   2. Stop Application (Port 3000)
echo   3. Check Status
echo   4. Generate Prisma Client
echo   5. Deploy to Vercel (Production)
echo   6. Exit
echo.
echo ===================================================
set /p choice="Enter your choice (1-6): "

if "%choice%"=="1" goto START
if "%choice%"=="2" goto STOP
if "%choice%"=="3" goto STATUS
if "%choice%"=="4" goto PRISMA
if "%choice%"=="5" goto VERCEL
if "%choice%"=="6" goto EXIT

echo.
echo Invalid choice.
pause
goto MENU

:START
cls
echo Starting iPlanet AI Store Locator...
echo.

if not exist "package.json" (
    echo ERROR: package.json not found in %~dp0
    pause
    goto MENU
)

if not exist ".env" (
    echo WARNING: .env file not found!
    if exist ".env.laptop2" (
        echo Found .env.laptop2, copying to .env...
        copy /y ".env.laptop2" ".env" >nul
    ) else if exist ".env.local" (
        echo Found .env.local, copying to .env...
        copy /y ".env.local" ".env" >nul
    )
)

echo Starting dev server on http://localhost:3000...
start "iPlanet AI Store Locator Server" cmd /k "cd /d ""%~dp0"" && npm run dev"

echo.
echo Server launched in a separate window.
echo Open http://localhost:3000 in your browser.
echo.
pause
goto MENU

:STOP
cls
echo Stopping application on port 3000...
powershell -NoProfile -ExecutionPolicy Bypass -Command "$p = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue; if ($p) { $p.OwningProcess | Sort-Object -Unique | ForEach-Object { Stop-Process -Id $_ -Force -ErrorAction SilentlyContinue; Write-Host ('Stopped process ID: ' + $_) } } else { Write-Host 'No application is currently listening on port 3000.' }"
echo.
pause
goto MENU

:STATUS
cls
echo Checking application status...
echo.
powershell -NoProfile -ExecutionPolicy Bypass -Command "$p = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue; if ($p) { Write-Host 'Application is RUNNING on http://localhost:3000 (PID: ' + ($p.OwningProcess -join ', ') + ')' -ForegroundColor Green } else { Write-Host 'Application is STOPPED (Port 3000 is free).' -ForegroundColor Yellow }"
echo.
pause
goto MENU

:PRISMA
cls
echo Regenerating Prisma Client...
cmd /c "npx prisma generate"
echo.
pause
goto MENU

:VERCEL
cls
echo Deploying to Vercel Production...
cmd /c "npx vercel --prod"
echo.
pause
goto MENU

:EXIT
endlocal
exit /b