@echo off
chcp 65001 >nul
echo ================================
echo   쇼핑몰 장부 앱 서버 시작
echo   Expo SDK 54 / React Native 0.76
echo ================================
echo.
set PATH=%~dp0node-v20.19.0-win-x64;%PATH%
set NODE_NO_WARNINGS=1
cd /d "%~dp0"
node_modules\.bin\expo.cmd start
pause
