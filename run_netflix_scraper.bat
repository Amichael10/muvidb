@echo off
cd /d "C:\Users\User\Filmdba\lumi"
SET PATH=C:\Program Files\nodejs;C:\Users\User\AppData\Roaming\npm;%PATH%
echo Running Netflix scraper...
echo.
node_modules\.bin\tsx.cmd scripts\netflix_sync.ts
pause
