@echo off
setlocal
cd /d "%~dp0"

echo.
echo ========================================
echo  browser-bantou daily check
echo ========================================
echo.

node run-daily-check.mjs
set EXIT_CODE=%ERRORLEVEL%

echo.
if not "%EXIT_CODE%"=="0" (
  echo [ERROR] daily check failed. exit code: %EXIT_CODE%
  pause
  exit /b %EXIT_CODE%
)

echo Daily check finished.
echo.
pause
exit /b 0
