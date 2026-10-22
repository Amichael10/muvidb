@echo off
setlocal
cd /d "%~dp0.."
title MuviDB Clipper Setup
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0install-local-clipper-launcher.ps1"
echo.
echo Setup finished. You can close this window and use Start desktop clipper in Social Studio.
pause
