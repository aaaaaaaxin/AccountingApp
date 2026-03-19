@echo off
setlocal
if "%~1"=="" exit /b 0
cmd /c %*
exit /b %ERRORLEVEL%
