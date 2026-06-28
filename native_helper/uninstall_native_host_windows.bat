@echo off
setlocal EnableExtensions
chcp 65001 >nul
set HOST_NAME=ai_chat_logbook_native
set MANIFEST_PATH=%LOCALAPPDATA%\AIChatLogbook\%HOST_NAME%.json
set REG_KEY=HKCU\Software\Mozilla\NativeMessagingHosts\%HOST_NAME%

echo ============================================================
echo   AI Chat Logbook - Native Host Uninstaller
echo ============================================================
reg delete "%REG_KEY%" /f >nul 2>nul
if exist "%MANIFEST_PATH%" del "%MANIFEST_PATH%"
echo [OK] Native host registration removed for current user.
pause
