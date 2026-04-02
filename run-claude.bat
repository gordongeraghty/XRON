@echo off
cd /d "C:\Users\Gordon Geraghty\OneDrive\Documents\GitHub\Toon v2\xron"
echo.
echo ============================================
echo  XRON - Claude Code Auto-Executor
echo  Reading HANDOFF.md and executing...
echo ============================================
echo.
npx @anthropic-ai/claude-code "Read HANDOFF.md and execute the implementation plan. Run npm test before committing. Set STATUS to review when done."
