@echo off
setlocal enabledelayedexpansion

echo ============================================================
echo  BillFlow YOLOv8 Training Environment Setup
echo  Target: RTX 4050 + CUDA 11.8
echo ============================================================
echo.

:: ── 1. Check Python ──────────────────────────────────────────
echo [1/6] Checking Python version...
python --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Python not found. Install Python 3.10+ from https://python.org
    pause
    exit /b 1
)
for /f "tokens=2" %%v in ('python --version 2^>^&1') do set PY_VER=%%v
echo       Found Python %PY_VER%
echo.

:: ── 2. Create virtual environment ────────────────────────────
echo [2/6] Creating virtual environment: yolo_env\
if exist yolo_env (
    echo       yolo_env\ already exists — skipping creation
) else (
    python -m venv yolo_env
    if errorlevel 1 (
        echo ERROR: Failed to create virtual environment.
        pause
        exit /b 1
    )
    echo       Created yolo_env\
)
echo.

:: ── 3. Activate ───────────────────────────────────────────────
echo [3/6] Activating yolo_env...
call yolo_env\Scripts\activate.bat
if errorlevel 1 (
    echo ERROR: Failed to activate virtual environment.
    pause
    exit /b 1
)
echo       Activated: %VIRTUAL_ENV%
echo.

:: ── 4. Install PyTorch + CUDA 11.8 ───────────────────────────
echo [4/6] Installing PyTorch with CUDA 11.8 support...
echo       (This may take several minutes — ~2.5 GB download)
pip install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu118 --quiet
if errorlevel 1 (
    echo ERROR: PyTorch install failed.
    pause
    exit /b 1
)
echo       PyTorch installed.
echo.

:: Install ultralytics after torch so it picks up the right torch version
echo       Installing ultralytics...
pip install ultralytics --quiet
if errorlevel 1 (
    echo ERROR: ultralytics install failed.
    pause
    exit /b 1
)
echo       ultralytics installed.
echo.

:: ── 5. Install supporting tools ───────────────────────────────
echo [5/6] Installing label-studio-converter, roboflow, supervision, tqdm...
pip install label-studio-converter roboflow supervision tqdm opencv-python pillow --quiet
if errorlevel 1 (
    echo WARNING: Some supporting packages failed to install.
    echo          Training will still work — check errors above.
) else (
    echo       Supporting tools installed.
)
echo.

:: ── 6. Verify GPU ─────────────────────────────────────────────
echo [6/6] Verifying GPU / CUDA...
python -c "import torch; cuda=torch.cuda.is_available(); name=torch.cuda.get_device_name(0) if cuda else 'N/A'; print(f'  CUDA available: {cuda}'); print(f'  GPU:            {name}'); print(f'  PyTorch:        {torch.__version__}')"
if errorlevel 1 (
    echo WARNING: GPU check failed — verify CUDA drivers are installed.
    echo          Download CUDA 11.8: https://developer.nvidia.com/cuda-11-8-0-download-archive
)
echo.

:: ── Done ──────────────────────────────────────────────────────
echo ============================================================
echo  Setup complete!
echo ============================================================
echo.
echo  Next steps:
echo.
echo  1. Activate environment (each new terminal):
echo       yolo_env\Scripts\activate
echo.
echo  2. Run auto-labeling:
echo       python scripts\training\auto_label.py --all --review
echo.
echo  3. Start Label Studio:
echo       docker compose -f docker-compose.label-studio.yml up -d
echo.
echo  4. Import auto-labels:
echo       python scripts\training\import_to_label_studio.py ^
echo         --token=^<your_token^> --project-id=1
echo.
echo  5. After annotating, prepare dataset:
echo       npx ts-node scripts\training\prepare-dataset.ts
echo.
echo  6. Train (open in Jupyter / VS Code):
echo       scripts\training\train_yolov8.ipynb
echo.
echo  RTX 4050 tip: batch=16 imgsz=640 fits in 6GB VRAM with yolov8n.
echo  If CUDA out-of-memory: reduce to batch=8 or imgsz=416.
echo.
pause
