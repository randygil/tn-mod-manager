@echo off
setlocal enabledelayedexpansion

REM 🚀 Create Release Script for Windows
REM Usage: scripts\create-release.bat v1.0.0

echo.
echo 🚀 Minecraft Mod Manager Release Builder
echo =====================================

if "%1"=="" (
    echo ❌ Usage: %0 ^<version^> (e.g., v1.0.0)
    exit /b 1
)

set VERSION=%1
set RELEASE_DIR=release-%VERSION%

echo 📋 Creating release %VERSION%

REM Check if we're in the right directory
if not exist "main.ts" (
    echo ❌ Please run this script from the project root directory
    exit /b 1
)

if not exist "deno.json" (
    echo ❌ deno.json not found. Are you in the right directory?
    exit /b 1
)

REM Check if Deno is installed
deno --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Deno is not installed or not in PATH
    echo Please install Deno from https://deno.land/
    exit /b 1
)

echo ✅ Deno found

REM Run pre-release checks
echo.
echo 🧪 Running pre-release checks...

echo 🔍 Linting code...
deno lint
if errorlevel 1 (
    echo ❌ Linting failed
    exit /b 1
)

echo 🎯 Type checking...
deno check main.ts
if errorlevel 1 (
    echo ❌ Type checking failed
    exit /b 1
)

echo 🔨 Testing compilation...
deno task build-windows >nul 2>&1
if errorlevel 1 (
    echo ❌ Windows build failed
    exit /b 1
)

if exist "mod-manager.exe" del "mod-manager.exe"

echo ✅ Pre-release checks passed

REM Create release directory
echo.
echo 📁 Creating release directory: %RELEASE_DIR%
if exist "%RELEASE_DIR%" rmdir /s /q "%RELEASE_DIR%"
mkdir "%RELEASE_DIR%"

REM Build for all platforms
echo.
echo 🔨 Building for Windows (x64)...
deno task build-windows
if errorlevel 1 (
    echo ❌ Windows build failed
    exit /b 1
)
move "mod-manager.exe" "%RELEASE_DIR%\mod-manager-windows-x64.exe"

echo 🔨 Building for Linux (x64)...
deno task build-linux
if errorlevel 1 (
    echo ❌ Linux build failed
    exit /b 1
)
move "mod-manager" "%RELEASE_DIR%\mod-manager-linux-x64"

echo 🔨 Building for macOS (ARM64)...
deno task build-macos
if errorlevel 1 (
    echo ❌ macOS build failed
    exit /b 1
)
move "mod-manager" "%RELEASE_DIR%\mod-manager-macos-arm64"

REM Create README for release
echo.
echo 📝 Creating release documentation...

for /f "tokens=2-4 delims=/ " %%a in ('date /t') do (set BUILD_DATE=%%c-%%a-%%b)
for /f "tokens=1-2 delims=/:" %%a in ('time /t') do (set BUILD_TIME=%%a:%%b)

echo # Minecraft Mod Manager %VERSION% > "%RELEASE_DIR%\README.txt"
echo. >> "%RELEASE_DIR%\README.txt"
echo Built on: %BUILD_DATE% %BUILD_TIME% >> "%RELEASE_DIR%\README.txt"
echo. >> "%RELEASE_DIR%\README.txt"
echo ## Quick Start >> "%RELEASE_DIR%\README.txt"
echo. >> "%RELEASE_DIR%\README.txt"
echo 1. Download the executable for your platform: >> "%RELEASE_DIR%\README.txt"
echo    - Windows: mod-manager-windows-x64.exe >> "%RELEASE_DIR%\README.txt"
echo    - Linux: mod-manager-linux-x64 >> "%RELEASE_DIR%\README.txt"
echo    - macOS: mod-manager-macos-arm64 >> "%RELEASE_DIR%\README.txt"
echo. >> "%RELEASE_DIR%\README.txt"
echo 2. Place it in your modpack folder >> "%RELEASE_DIR%\README.txt"
echo. >> "%RELEASE_DIR%\README.txt"
echo 3. Create tn.mods.json: >> "%RELEASE_DIR%\README.txt"
echo    { >> "%RELEASE_DIR%\README.txt"
echo      "modLoader": "fabric", >> "%RELEASE_DIR%\README.txt"
echo      "gameVersion": "1.20.1", >> "%RELEASE_DIR%\README.txt"
echo      "mods": [ >> "%RELEASE_DIR%\README.txt"
echo        { "name": "Fabric API", "source": "modrinth" }, >> "%RELEASE_DIR%\README.txt"
echo        { "name": "Sodium", "source": "modrinth" } >> "%RELEASE_DIR%\README.txt"
echo      ] >> "%RELEASE_DIR%\README.txt"
echo    } >> "%RELEASE_DIR%\README.txt"
echo. >> "%RELEASE_DIR%\README.txt"
echo 4. Run the executable >> "%RELEASE_DIR%\README.txt"
echo. >> "%RELEASE_DIR%\README.txt"
echo Built with ❤️ and TypeScript >> "%RELEASE_DIR%\README.txt"

REM Create checksums (if certutil is available)
echo.
echo 🔐 Generating checksums...
cd "%RELEASE_DIR%"
(
    for %%f in (mod-manager-*) do (
        for /f %%h in ('certutil -hashfile "%%f" SHA256 ^| find /v ":" ^| find /v "CertUtil"') do echo %%h  %%f
    )
) > SHA256SUMS.txt 2>nul
cd ..

REM Create zip archive (if PowerShell is available)
echo.
echo 📦 Creating archive...
powershell -command "Compress-Archive -Path '%RELEASE_DIR%\*' -DestinationPath '%RELEASE_DIR%.zip'" 2>nul
if errorlevel 1 (
    echo ⚠️  Could not create zip archive (PowerShell required)
) else (
    echo ✅ Archive created: %RELEASE_DIR%.zip
)

echo.
echo ✅ Release built successfully!
echo.
echo 📦 Release files in: %RELEASE_DIR%\
echo.
echo 🔗 Files:
dir /b "%RELEASE_DIR%"
echo.
echo 📝 Next steps:
echo 1. Test the executables
echo 2. Create git tag: git tag %VERSION%
echo 3. Push tag: git push origin %VERSION%
echo 4. GitHub Actions will automatically create the release
echo.
echo ⚠️  Don't forget to update the version in your documentation!

pause