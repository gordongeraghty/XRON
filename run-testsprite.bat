@echo off
cd /d "H:\My Drive\GitHub\Toon v2\xron"
echo.
echo ============================================
echo  XRON Monorepo Migration - TestSprite
echo  Validating the newly segregated workspace.
echo ============================================
echo.
npx -y @testsprite/testsprite-mcp@latest
