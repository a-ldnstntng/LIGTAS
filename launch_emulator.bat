@echo off
setlocal
title LIGTAS METRO - Android Emulator Launcher
echo ======================================================================
echo           LIGTAS METRO: Android Emulator Launcher
echo ======================================================================
echo.

set SDK_DIR=%LOCALAPPDATA%\Android\Sdk
set EMULATOR_EXE=%SDK_DIR%\emulator\emulator.exe
set ADB_EXE=%SDK_DIR%\platform-tools\adb.exe
set AVD_NAME=medium_phone

if not exist "%EMULATOR_EXE%" (
    echo [ERROR] Android emulator not found at: "%EMULATOR_EXE%"
    echo Please make sure the Android SDK is installed.
    pause
    exit /b 1
)

echo [1/3] Clearing any stale AVD lock files...
del /f /q "%USERPROFILE%\.android\avd\%AVD_NAME%.avd\*.lock" 2>nul

echo [2/3] Launching Android Emulator window (%AVD_NAME%)...
echo Note: This window will stay open to show status and logs.
echo If the phone screen takes a moment to appear, please wait 15-30 seconds.
echo.

"%EMULATOR_EXE%" -avd %AVD_NAME% -gpu auto

if %ERRORLEVEL% neq 0 (
    echo.
    echo [WARNING] Hardware GPU auto failed. Attempting fallback with SwiftShader software renderer...
    "%EMULATOR_EXE%" -avd %AVD_NAME% -gpu swiftshader
)

echo.
echo Emulator closed.
pause
