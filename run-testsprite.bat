@echo off
cd /d "C:\Users\Gordon Geraghty\OneDrive\Documents\GitHub\Toon v2\xron"
echo.
echo ============================================
echo  XRON Monorepo Migration - TestSprite
echo  Validating the newly segregated workspace.
echo ============================================
echo.
npx -y @testsprite/testsprite-mcp@latest
