@echo off
REM publish-all.bat — Publishes all XRON packages in dependency order
REM Usage: publish-all.bat [--dry-run]

setlocal enabledelayedexpansion

set DRY_RUN=
if "%1"=="--dry-run" set DRY_RUN=--dry-run

echo === Step 1/3: Building all packages ===
call npm run build
if errorlevel 1 (
    echo BUILD FAILED — aborting publish.
    exit /b 1
)

echo === Step 2/3: Running all tests ===
call npm test
if errorlevel 1 (
    echo TESTS FAILED — aborting publish.
    exit /b 1
)

echo === Step 3/3: Publishing packages (format -> mcp -> cli) ===

echo --- Publishing xron-format ---
cd packages\format
call npm publish %DRY_RUN%
if errorlevel 1 (
    echo xron-format publish failed.
    exit /b 1
)
cd ..\..

echo --- Publishing xron-mcp ---
cd packages\mcp
call npm publish %DRY_RUN%
if errorlevel 1 (
    echo xron-mcp publish failed.
    exit /b 1
)
cd ..\..

echo --- Publishing xron-cli ---
cd packages\cli
call npm publish %DRY_RUN%
if errorlevel 1 (
    echo xron-cli publish failed.
    exit /b 1
)
cd ..\..

echo --- Publishing xron-langchain ---
cd packages\integrations\langchain
call npm publish %DRY_RUN%
if errorlevel 1 (
    echo xron-langchain publish failed.
    exit /b 1
)
cd ..\..\..

echo --- Publishing xron-vercel ---
cd packages\integrations\vercel
call npm publish %DRY_RUN%
if errorlevel 1 (
    echo xron-vercel publish failed.
    exit /b 1
)
cd ..\..\..

echo === All packages published successfully ===
