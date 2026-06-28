@echo off
setlocal EnableExtensions EnableDelayedExpansion
chcp 65001 >nul

set HOST_NAME=ai_chat_logbook_native
set HOST_DIR=%~dp0
set HOST_CMD=%HOST_DIR%run_native_host.cmd
set MANIFEST_DIR=%LOCALAPPDATA%\AIChatLogbook
set MANIFEST_PATH=%MANIFEST_DIR%\%HOST_NAME%.json
set REG_KEY=HKCU\Software\Mozilla\NativeMessagingHosts\%HOST_NAME%

echo ============================================================
echo   AI Chat Logbook - Native Host Installer
echo ============================================================
echo.
echo Host command: %HOST_CMD%
echo Manifest:     %MANIFEST_PATH%
echo.

if not exist "%HOST_CMD%" (
  echo [ERROR] Missing run_native_host.cmd next to this installer.
  exit /b 1
)

if not exist "%MANIFEST_DIR%" mkdir "%MANIFEST_DIR%"

powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$path = '%HOST_CMD%'.Replace('\\','\\\\');" ^
  "$manifest = [ordered]@{ name='%HOST_NAME%'; description='AI Chat Logbook native Markdown writer'; path=$path; type='stdio'; allowed_extensions=@('ai-chat-logbook@zeittresor.local') };" ^
  "$json = $manifest | ConvertTo-Json -Depth 5;" ^
  "Set-Content -LiteralPath '%MANIFEST_PATH%' -Value $json -Encoding UTF8"

if errorlevel 1 (
  echo [ERROR] Failed to write native messaging manifest.
  exit /b 1
)

reg add "%REG_KEY%" /ve /t REG_SZ /d "%MANIFEST_PATH%" /f >nul
if errorlevel 1 (
  echo [ERROR] Failed to write registry key.
  exit /b 1
)

echo [OK] Native host registered for Firefox under current user.
echo [INFO] In the extension options, set Save mode to "Native helper" and choose a root path such as D:\AI_Chat_Logs.
echo.
pause
