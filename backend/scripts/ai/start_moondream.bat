@echo off
echo ============================================================
echo  BillFlow Moondream2 Vision Server
echo  URL: http://localhost:8001
echo  Health: http://localhost:8001/health
echo ============================================================
echo.

:: Activate yolo_env (two levels up from scripts/ai/)
set SCRIPT_DIR=%~dp0
set ENV_ACTIVATE=%SCRIPT_DIR%..\..\yolo_env\Scripts\activate.bat

if not exist "%ENV_ACTIVATE%" (
    echo ERROR: yolo_env not found at %ENV_ACTIVATE%
    echo Run setup_training_env.bat first.
    pause
    exit /b 1
)

call "%ENV_ACTIVATE%"

:: Install dependencies if needed
echo Checking dependencies...
python -c "import fastapi, uvicorn, transformers, torch" 2>nul
if errorlevel 1 (
    echo Installing requirements...
    pip install -r "%SCRIPT_DIR%requirements_moondream.txt" --quiet
)

echo.
echo Starting Moondream2 server on http://localhost:8001
echo Press Ctrl+C to stop.
echo.

:: Run from the script directory so uvicorn finds moondream_server.py
cd /d "%SCRIPT_DIR%"
uvicorn moondream_server:app --host 0.0.0.0 --port 8001 --reload

pause
