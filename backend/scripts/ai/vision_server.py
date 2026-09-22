#!/usr/bin/env python3
"""
BillFlow AI Vision Server — powered by Ollama LLaVA.

Prerequisites:
  1. Install Ollama: https://ollama.com/download
  2. Pull model:  ollama pull llava
  3. Start Ollama (runs automatically as a service on Windows after install)

Install server deps:
  pip install -r requirements_moondream.txt

Run:
  uvicorn vision_server:app --host 0.0.0.0 --port 8001 --reload
  (or double-click start_ai_server.bat)
"""

import base64
import io
import json
import platform
import re
from contextlib import asynccontextmanager
from typing import Optional

import cv2
import httpx
import numpy as np
import pytesseract
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.responses import JSONResponse
from PIL import Image

# Tesseract binary path — Windows only
if platform.system() == "Windows":
    pytesseract.pytesseract.tesseract_cmd = (
        r"C:\Program Files\Tesseract-OCR\tesseract.exe"
    )

# ── Config ─────────────────────────────────────────────────────

OLLAMA_URL   = "http://localhost:11434"
OLLAMA_MODEL = "llava"
QWEN_MODEL   = "qwen2.5:7b"

PRODUCT_PROMPT = (
    "You are a product identification AI for an Indian retail POS system. "
    "Analyze this product image and return ONLY a JSON object with these fields: "
    "product_name, brand, category, "
    "weight_or_volume, unit (one of: PCS/KG/GM/LTR/ML/MTR/BOX/PAIR/DOZEN/SQFT/PACK), "
    "color, material, "
    "hsn_code_suggestion (4-digit HSN code if determinable), "
    "mrp_if_visible (number only, no currency symbol, null if not visible), "
    "expiry_date_if_visible (YYYY-MM-DD format, null if not visible), "
    "barcode_if_visible (null if not readable), "
    "industry_type (one of: GROCERY/PHARMACY/APPAREL/FOOTWEAR/OPTICAL/BAKERY/"
    "HARDWARE/ELECTRONICS/ELECTRICAL/JEWELRY/FURNITURE/PAINT/STATIONERY/GIFT/"
    "KITCHENWARE/TOYS/TEA_CAFE/BAGS/GENERAL), "
    "confidence (0.0-1.0). "
    "Return null for unknown fields. Return ONLY the JSON object, no other text."
)

BILL_OCR_PROMPT = """\
You are a bill/invoice parser. The OCR text below is from an Indian vendor bill.

IMPORTANT RULES:
1. Find the items TABLE in the bill — it has column headers like: Item/Description, HSN/SAC, Batch, Expiry/Exp Date, Qty/Quantity, Rate/Price, Tax%, Amount
2. Extract ONLY the data rows from the table — NOT the vendor header, company name, address, or footer text
3. Map columns correctly: Items/Description column -> name, HSN column -> hsn_code, Batch column -> batch_number, Exp Date column -> expiry_date, Qty/Quantity column -> quantity, Rate column -> rate, Tax% column -> gst_rate, Amount column -> amount
4. vendor_name = the company selling TO you (BILL FROM section, NOT your company name at top)
5. quantity must be a NUMBER only — extract digits, remove units like KG/PCS/Bags
6. rate must be a NUMBER only — the price per unit
7. amount must be a NUMBER only — total for that line item
8. expiry_date format: YYYY-MM-DD (convert 31 Jan 2027 -> 2027-01-31, 30 Sept 2026 -> 2026-09-30)

Return ONLY valid JSON, no explanation:
{{"vendor_name": "", "bill_number": "", "bill_date": "", "items": [{{"name": "", "hsn_code": null, "quantity": 0, "unit": "", "rate": 0, "discount": null, "gst_rate": null, "amount": 0, "batch_number": null, "expiry_date": null}}], "subtotal": null, "gst_total": null, "total_amount": 0}}

OCR TEXT:
{ocr_text}"""

BILL_DEFAULTS: dict = {
    "vendor_name":  "",
    "bill_number":  "",
    "bill_date":    "",
    "items":        [],
    "subtotal":     None,
    "gst_total":    None,
    "total_amount": 0,
}

RESPONSE_DEFAULTS: dict = {
    "product_name":           "",
    "brand":                  "",
    "category":               "",
    "weight_or_volume":       "",
    "unit":                   "PCS",
    "color":                  "",
    "material":               "",
    "hsn_code_suggestion":    "",
    "mrp_if_visible":         None,
    "expiry_date_if_visible": None,
    "barcode_if_visible":     None,
    "industry_type":          "GENERAL",
    "confidence":             0.5,
}

# ── Lifespan ───────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Verify Ollama is reachable on startup."""
    try:
        async with httpx.AsyncClient(timeout=5) as client:
            r = await client.get(f"{OLLAMA_URL}/api/tags")
            models = [m["name"] for m in r.json().get("models", [])]
            llava_ready = any(OLLAMA_MODEL in m for m in models)
            if llava_ready:
                print(f"Ollama ready — {OLLAMA_MODEL} available.")
            else:
                print(
                    f"WARNING: {OLLAMA_MODEL} not pulled yet. "
                    f"Run: ollama pull {OLLAMA_MODEL}"
                )
                print(f"Available models: {models or 'none'}")
    except Exception as e:
        print(f"WARNING: Cannot reach Ollama at {OLLAMA_URL}: {e}")
        print("Start Ollama first, then retry requests.")

    yield


app = FastAPI(
    title="BillFlow AI Vision Server",
    description="Product identification via Ollama LLaVA",
    version="2.0.0",
    lifespan=lifespan,
)


# ── Helpers ────────────────────────────────────────────────────

async def load_image(
    file:         Optional[UploadFile],
    base64_image: Optional[str],
) -> bytes:
    """Read raw image bytes from either a multipart upload or a base64 string."""
    if file is not None:
        data = await file.read()
    elif base64_image:
        b64 = re.sub(r"^data:image/[^;]+;base64,", "", base64_image.strip())
        try:
            data = base64.b64decode(b64)
        except Exception as e:
            raise HTTPException(400, detail=f"Invalid base64: {e}")
    else:
        raise HTTPException(
            400,
            detail="Provide 'file' (multipart upload) or 'base64_image' (form field)",
        )
    if not data:
        raise HTTPException(400, detail="Empty image data")
    return data


def image_to_base64(data: bytes) -> str:
    """Resize large images before sending to Ollama (keeps inference fast)."""
    img = Image.open(io.BytesIO(data)).convert("RGB")
    max_side = 1024
    if max(img.size) > max_side:
        img.thumbnail((max_side, max_side), Image.LANCZOS)
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=85)
    return base64.b64encode(buf.getvalue()).decode("utf-8")


def preprocess_for_ocr(img: Image.Image) -> np.ndarray:
    """Convert PIL image → grayscale → adaptive threshold → denoise."""
    arr    = cv2.cvtColor(np.array(img), cv2.COLOR_RGB2BGR)
    gray   = cv2.cvtColor(arr, cv2.COLOR_BGR2GRAY)
    thresh = cv2.adaptiveThreshold(
        gray, 255,
        cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv2.THRESH_BINARY, 31, 11,
    )
    denoised = cv2.fastNlMeansDenoising(thresh, h=10)
    return denoised


def parse_llava_response(raw: str) -> dict:
    """Extract JSON from LLaVA response text."""
    raw = raw.strip()
    raw = re.sub(r"^```(?:json)?\s*", "", raw, flags=re.MULTILINE)
    raw = re.sub(r"\s*```$",          "", raw, flags=re.MULTILINE)
    raw = raw.strip()

    match = re.search(r"\{.*\}", raw, re.DOTALL)
    if not match:
        raise ValueError(f"No JSON in response: {raw[:200]}")

    parsed = json.loads(match.group())

    for k, v in RESPONSE_DEFAULTS.items():
        parsed.setdefault(k, v)

    try:
        parsed["confidence"] = max(0.0, min(1.0, float(parsed["confidence"])))
    except (TypeError, ValueError):
        parsed["confidence"] = 0.5

    return parsed


# ── Endpoints ──────────────────────────────────────────────────

@app.get("/health")
async def health():
    """Check if Ollama is running and llava model is available."""
    try:
        async with httpx.AsyncClient(timeout=5) as client:
            r = await client.get(f"{OLLAMA_URL}/api/tags")
            r.raise_for_status()
            models = [m["name"] for m in r.json().get("models", [])]
            llava_ready = any(OLLAMA_MODEL in m for m in models)
            return {
                "status":      "ready" if llava_ready else "model_not_pulled",
                "ollama":      "running",
                "model":       OLLAMA_MODEL,
                "llava_ready": llava_ready,
                "models":      models,
            }
    except httpx.ConnectError:
        return JSONResponse(status_code=503, content={
            "status": "error",
            "ollama": "not_running",
            "detail": f"Cannot connect to Ollama at {OLLAMA_URL}. "
                      "Install from https://ollama.com/download and start it.",
        })
    except Exception as e:
        return JSONResponse(status_code=503, content={
            "status": "error",
            "detail": str(e),
        })


@app.post("/analyze")
async def analyze(
    file:         Optional[UploadFile] = File(None),
    base64_image: Optional[str]        = Form(None),
):
    """
    Analyze a product image and return structured JSON via LLaVA.
    Accepts either:
      - multipart file upload (field name: 'file')
      - base64-encoded image string (field name: 'base64_image')
    """
    data = await load_image(file, base64_image)

    try:
        b64_img = image_to_base64(data)
    except Exception as e:
        raise HTTPException(400, detail=f"Cannot decode image: {e}")

    payload = {
        "model":  OLLAMA_MODEL,
        "prompt": PRODUCT_PROMPT,
        "images": [b64_img],
        "stream": False,
    }

    try:
        async with httpx.AsyncClient(timeout=120) as client:
            r = await client.post(f"{OLLAMA_URL}/api/generate", json=payload)
            r.raise_for_status()
            raw_text = r.json().get("response", "")
    except httpx.ConnectError:
        raise HTTPException(503, detail=(
            f"Cannot connect to Ollama at {OLLAMA_URL}. "
            "Is Ollama running? Start it or install from https://ollama.com/download"
        ))
    except httpx.TimeoutException:
        raise HTTPException(504, detail="Ollama inference timed out (>120s)")
    except Exception as e:
        raise HTTPException(502, detail=f"Ollama error: {e}")

    try:
        result = parse_llava_response(raw_text)
    except (json.JSONDecodeError, ValueError) as e:
        return JSONResponse(status_code=200, content={
            **{k: v for k, v in RESPONSE_DEFAULTS.items()},
            "confidence": 0.1,
            "_parse_error": str(e),
            "_raw": raw_text[:500],
        })

    return result


@app.post("/extract-bill-ocr")
async def extract_bill_ocr(
    file:         Optional[UploadFile] = File(None),
    base64_image: Optional[str]        = Form(None),
):
    """
    Extract line items from a vendor/supplier bill using Tesseract OCR + Qwen 2.5 7B.
    Pipeline: image → preprocess → Tesseract OCR → Qwen text parsing → JSON.
    Accepts either:
      - multipart file upload (field name: 'file')
      - base64-encoded image string (field name: 'base64_image')
    """
    # ── 1. Load image bytes ──────────────────────────────────────
    data = await load_image(file, base64_image)

    # ── 2. Decode + preprocess for OCR ──────────────────────────
    try:
        pil_img = Image.open(io.BytesIO(data)).convert("RGB")
        # Scale up small images — Tesseract accuracy improves at higher DPI
        w, h = pil_img.size
        if max(w, h) < 1500:
            scale   = 1500 / max(w, h)
            pil_img = pil_img.resize(
                (int(w * scale), int(h * scale)), Image.LANCZOS
            )
        processed = preprocess_for_ocr(pil_img)
    except Exception as e:
        raise HTTPException(400, detail=f"Image processing failed: {e}")

    # ── 3. Tesseract OCR ─────────────────────────────────────────
    try:
        ocr_text = pytesseract.image_to_string(
            processed, lang="eng", config="--psm 6"
        )
    except Exception as e:
        raise HTTPException(500, detail=f"OCR failed: {e}")

    if not ocr_text.strip():
        return JSONResponse(status_code=200, content={
            "success": False,
            **BILL_DEFAULTS,
            "_error": "OCR returned empty text — check image quality",
        })

    # ── 4. Qwen 2.5 7B — structured parsing ─────────────────────
    print(f"[extract-bill-ocr] OCR complete — {len(ocr_text.strip())} chars extracted")
    prompt  = BILL_OCR_PROMPT.replace("{ocr_text}", ocr_text.strip())
    payload = {
        "model":  QWEN_MODEL,
        "prompt": prompt,
        "stream": False,
    }
    try:
        async with httpx.AsyncClient(timeout=300) as client:
            r = await client.post(f"{OLLAMA_URL}/api/generate", json=payload)
            r.raise_for_status()
            raw_text = r.json().get("response", "")
    except httpx.ConnectError:
        raise HTTPException(503, detail=(
            f"Cannot connect to Ollama at {OLLAMA_URL}. "
            "Is Ollama running? Start it or install from https://ollama.com/download"
        ))
    except httpx.TimeoutException:
        raise HTTPException(504, detail="Qwen inference timed out (>300s)")
    except Exception as e:
        raise HTTPException(502, detail=f"Ollama error: {e}")

    # ── 5. Parse JSON from Qwen response ─────────────────────────
    raw = raw_text.strip()
    raw = re.sub(r"^```(?:json)?\s*", "", raw, flags=re.MULTILINE)
    raw = re.sub(r"\s*```$",          "", raw, flags=re.MULTILINE)
    raw = raw.strip()

    match = re.search(r"\{.*\}", raw, re.DOTALL)
    if not match:
        return JSONResponse(status_code=200, content={
            "success": False,
            **BILL_DEFAULTS,
            "_parse_error": "No JSON in Qwen response",
            "_raw_ocr":     ocr_text[:500],
            "_raw_llm":     raw_text[:500],
        })

    try:
        parsed = json.loads(match.group())
    except json.JSONDecodeError as e:
        return JSONResponse(status_code=200, content={
            "success": False,
            **BILL_DEFAULTS,
            "_parse_error": str(e),
            "_raw_ocr":     ocr_text[:500],
        })

    # Apply defaults for any missing top-level keys
    for k, v in BILL_DEFAULTS.items():
        parsed.setdefault(k, v)

    if not isinstance(parsed.get("items"), list):
        parsed["items"] = []

    return {"success": True, "data": parsed, "raw_ocr": ocr_text}


# ── Entrypoint ─────────────────────────────────────────────────

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("vision_server:app", host="0.0.0.0", port=8001, reload=False)
