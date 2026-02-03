@echo off
setlocal enabledelayedexpansion

REM Create Release Script for Windows
REM Usage: scripts\create-release.bat v1.0.0

echo.
echo Minecraft Mod Manager Release Builder
echo =====================================

if "%~1"=="" (
    echo Usage: %0 ^<version^> (e.g., v1.0.0^)
    exit /b 1
)
set "VERSION=%~1"
set "RELEASE_DIR=release-%VERSION%"

echo Creating release %VERSION%

REM Check if we're in the right directory
if not exist "main.ts" (
    echo Please run this script from the project root directory
    exit /b 1
)

if not exist "deno.json" (
    echo deno.json not found. Are you in the right directory?
    exit /b 1
)

REM Check if Deno is installed
where deno >nul 2>&1
if %errorlevel% neq 0 (
    echo Deno is not installed or not in PATH
    exit /b 1
)

echo Deno found

REM Run pre-release checks
echo.
echo Running pre-release checks...

echo Linting code...
deno lint
if %errorlevel% neq 0 (
    echo Linting failed
    exit /b 1
)

echo Type checking...
cmd /c deno check main.ts
if %errorlevel% neq 0 (
    echo Type checking failed
    exit /b 1
)

echo Testing compilation...
cmd /c deno task build-windows >nul 2>&1
if %errorlevel% neq 0 (
    echo Windows build failed
    exit /b 1
)

if exist "mod-manager.exe" del "mod-manager.exe"

echo Pre-release checks passed

REM Create release directory
echo.
echo Creating release directory: %RELEASE_DIR%
if exist "%RELEASE_DIR%" rmdir /s /q "%RELEASE_DIR%"
mkdir "%RELEASE_DIR%"

REM Build for all platforms
echo.
echo Building for Windows (x64)...
call deno task build-windows
if %errorlevel% neq 0 (
    echo Windows build failed
    exit /b 1
)
move /Y "mod-manager.exe" "%RELEASE_DIR%\mod-manager-windows-x64.exe" >nul

echo Building for Linux (x64)...
call deno task build-linux
if %errorlevel% neq 0 (
    echo Linux build failed
    exit /b 1
)
move /Y "mod-manager" "%RELEASE_DIR%\mod-manager-linux-x64" >nul

echo Building for macOS (ARM64)...
call deno task build-macos
if %errorlevel% neq 0 (
    echo macOS build failed
    exit /b 1
)
move /Y "mod-manager" "%RELEASE_DIR%\mod-manager-macos-arm64" >nul

REM Create README for release
echo.
echo Creating release documentation...

for /f "tokens=2-4 delims=/ " %%a in ('date /t') do (set BUILD_DATE=%%c-%%a-%%b)
for /f "tokens=1-2 delims=/:" %%a in ('time /t') do (set BUILD_TIME=%%a:%%b)

(
echo # Minecraft Mod Manager %VERSION%
echo.
echo Built on: %date% %time%
echo.
echo ## Quick Start
echo.
echo 1. Download the executable for your platform:
echo    - Windows: mod-manager-windows-x64.exe
echo    - Linux: mod-manager-linux-x64
echo    - macOS: mod-manager-macos-arm64
echo.
echo 2. Place it in your modpack folder
echo.
echo 3. Create tn.mods.json:
echo    {
echo      "modLoader": "fabric",
echo      "gameVersion": "1.20.1",
echo      "mods": [
echo        { "name": "Fabric API", "source": "modrinth" },
echo        { "name": "Sodium", "source": "modrinth" }
echo      ]
echo    }
echo.
echo 4. Run the executable
echo.
echo Built with Love and TypeScript
) > "%RELEASE_DIR%\README.txt"

REM Create checksums (if certutil is available)
echo.
echo Generating checksums...
pushd "%RELEASE_DIR%"
(
    for %%f in (mod-manager-*) do (
        certutil -hashfile "%%f" SHA256 | find /v ":" | find /v "CertUtil"
    )
) > SHA256SUMS.txt 2>nul
popd

REM Create zip archive (if PowerShell is available)
echo.
echo Creating archive...
powershell -command "Compress-Archive -Path '%RELEASE_DIR%\*' -DestinationPath '%RELEASE_DIR%.zip' -Force" 2>nul
if %errorlevel% neq 0 (
    echo Could not create zip archive (PowerShell required)
) else (
    echo Archive created: %RELEASE_DIR%.zip
)

echo.
echo Release built successfully!
echo.
echo Release files in: %RELEASE_DIR%\
echo.
echo Files:
dir /b "%RELEASE_DIR%"
echo.
echo Next steps:
echo 1. Test the executables
echo 2. Create git tag: git tag %VERSION%
echo 3. Push tag: git push origin %VERSION%
echo 4. GitHub Actions will automatically create the release
echo.
echo Don't forget to update the version in your documentation!

pause