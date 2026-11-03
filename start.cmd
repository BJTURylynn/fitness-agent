@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo 请先安装 Node.js 22.13 或更高版本。
  pause
  exit /b 1
)
node scripts/build.mjs
if errorlevel 1 goto failed
start "" http://127.0.0.1:4173
node scripts/dev.mjs
:failed
pause
