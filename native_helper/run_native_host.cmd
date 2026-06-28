@echo off
setlocal
set PYTHONUTF8=1
where py >nul 2>nul
if %ERRORLEVEL%==0 (
  py -3 "%~dp0ai_chat_logbook_helper.py"
  exit /b %ERRORLEVEL%
)
python "%~dp0ai_chat_logbook_helper.py"
exit /b %ERRORLEVEL%
