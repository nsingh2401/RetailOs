@echo off
echo ============================================================
echo  BillFlow AI Vision Server (Ollama LLaVA)
echo  URL:    http://localhost:8001
echo  Health: http://localhost:8001/health
echo ============================================================
echo.
echo Prerequisites:
echo   1. Ollama installed: https://ollama.com/download
echo   2. Model pulled:     ollama pull llava
echo   3. Ollama running:   starts automatically on Windows
echo.

set SCRIPT_DIR=%~dp0

:: Install dependencies if needed
python -c "import fastapi, uvicorn, httpx" 2>nul
if errorlevel 1 (
    echo Installing requirements...
    pip install -r "%SCRIPT_DIR%requirements_moondream.txt" --quiet
    echo.
)

echo Starting AI server on http://localhost:8001
echo Press Ctrl+C to stop.
echo.

cd /d "%SCRIPT_DIR%"
uvicorn vision_server:app --host 0.0.0.0 --port 8001 --reload

pause
