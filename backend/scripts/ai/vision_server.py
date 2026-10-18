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
import os
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

OLLAMA_URL    = "http://localhost:11434"
OLLAMA_MODEL  = "llava"
QWEN_MODEL    = "qwen2.5:7b"
QWEN_VL_MODEL = "qwen2.5vl:7b"
VISION_MODEL  = os.getenv("VISION_MODEL", "tesseract")  # 'tesseract' | 'qwen2.5-vl'

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
You are a bill/invoice parser. The OCR text below is from an Indian vendor/supplier bill.

EXTRACTION RULES:

VENDOR (SELLER):
- vendor_name = the company at the TOP of the bill that is SELLING to you
  Look for: the first company name, text before "Invoice No", text after "From:", letterhead company
  Do NOT use the buyer/consignee/ship-to company name
- vendor_gstin = GSTIN/UIN of the SELLER/VENDOR (top section), labeled 'GSTIN/UIN', 'GSTIN', 'GST No'
  Do NOT use the buyer's GSTIN

BILL NUMBER AND DATE:
- bill_number = invoice/bill reference number, labeled 'Invoice No.', 'Invoice No', 'Bill No', 'Invoice #'
  Example formats: 'PS26-27/1248', 'INV-001', 'TAX/2024/001'
- bill_date = the date NEXT TO the invoice number, labeled 'Date', 'Dated', 'Invoice Date'
  Convert ALL date formats to YYYY-MM-DD. NEVER return the date in its original format.
  Examples:
    '28-Sep-26'       -> '2026-09-28'
    '28/09/26'        -> '2026-09-28'
    '28/09/2026'      -> '2026-09-28'
    '28 Sep 2026'     -> '2026-09-28'
    'September 28 2026' -> '2026-09-28'
    '28-09-2026'      -> '2026-09-28'
    '2-digit year: always assume 20XX (26 -> 2026, 27 -> 2027, 28 -> 2028)'

ITEMS TABLE:
- Find the table with columns: Description/Item, HSN/SAC, Qty, Rate, Amount (and optionally Batch, Expiry, Tax%)
- Extract ONLY data rows — not headers, not totals, not blank rows
- name = FULL product description from Description/Item column
  If the product name wraps across multiple lines, JOIN all lines into one string
  Example: line1="CP PLUS" line2="16CH 5MP-N DVR 1601F1-HC" → name="CP PLUS 16CH 5MP-N DVR 1601F1-HC"
  Do NOT drop any leading words — brand prefix (e.g. "CP PLUS", "HIKVISION") is part of the name
- hsn_code = numeric code from column labeled 'HSN/SAC', 'HSN', 'SAC' (e.g. 30049099, 1006)
- quantity = NUMBER only, strip units (KG/PCS/Bags/Nos etc.)
- unit = the unit label stripped from quantity (KG/PCS/NOS/BOX etc.), or "" if not present
- rate = TAXABLE VALUE / BASE PRICE per unit BEFORE tax — PRESERVE DECIMALS EXACTLY
  '8305.08' stays '8305.08' — do NOT strip decimal point or remove digits
  PRIORITY ORDER for rate column (use the FIRST match found):
    1. Column labeled 'Taxable Value', 'Taxable Amt', 'Basic Amt' → divide by quantity to get per-unit rate
    2. Column labeled 'Rate', 'Basic Rate', 'Price' (without tax qualifier)
    3. Column labeled 'Rate (Excl. Tax)', 'Rate (Ex. GST)'
  NEVER use 'Rate (Incl. of Tax)', 'Rate (Incl. GST)', 'MRP' or any tax-inclusive column
  Example: bill shows Rate(Incl. of Tax)=9799.99 AND Taxable Value=8305.08 → rate=8305.08
  Do NOT use the 'Amount' column value as rate
- discount = discount amount if shown, null otherwise
- gst_rate = GST percentage as a single number (e.g. 18, 12, 5), null if not shown
  Look for columns: GST%, Tax Rate, IGST%, CGST%+SGST%
  If bill shows CGST% and SGST% separately, add them: CGST=9% + SGST=9% → gst_rate=18
  If bill shows IGST%, use that directly: IGST=18% → gst_rate=18
  Extract the NUMBER only, not the % symbol
- amount = line total for that item (quantity × rate, before or after tax per bill format)
- batch_number = from Batch/Lot column, null if not present
- expiry_date = from Exp/Expiry column, convert to YYYY-MM-DD, null if not present

PHARMACY BILL SPECIFIC RULES (apply when bill has PACK/BATCH/EXP/MRP/DIS% columns):
- PACK column (e.g. '1*10', '2*15'): this is pack size, NOT quantity — ignore for quantity
- quantity = value from QTY column only
- batch_number = value from BATCH column
- EXP column: expiry in M/YY format → convert to YYYY-MM-DD (last day not needed, use 01):
    7/28  → 2028-07-01
    12/26 → 2026-12-01
    3/27  → 2027-03-01
- MRP column: Maximum Retail Price — NOT the taxable rate
- DIS% column: discount percentage → discount = MRP × DIS% / 100
- rate = MRP - (MRP × DIS% / 100)   [taxable value per unit after discount]
- amount = rate × quantity
- SGST + CGST: add both percentages for gst_rate (SGST=2.5 + CGST=2.5 → gst_rate=5, NOT 13)
- HSN codes for medicines are 8 digits max (30049029, 30041070). If OCR gives more digits, take last 8.
- Decimals: '470.50' must stay '470.50' — never drop or shift decimal point
- GSTIN is exactly 15 alphanumeric chars. If extracted value is shorter or garbled, return it as-is with a note in vendor_gstin

TOTALS:
- subtotal = taxable amount before GST (sum of all line amounts before tax)
- gst_total = total GST/tax amount
- total_amount = final invoice amount (bottom-right grand total)

Return ONLY valid JSON, no explanation:
{{"vendor_name": "", "vendor_gstin": null, "bill_number": "", "bill_date": "", "items": [{{"name": "", "hsn_code": null, "quantity": 0, "unit": "", "rate": 0, "discount": null, "gst_rate": null, "amount": 0, "batch_number": null, "expiry_date": null}}], "subtotal": null, "gst_total": null, "total_amount": 0}}

OCR TEXT:
{ocr_text}"""

BILL_DEFAULTS: dict = {
    "vendor_name":  "",
    "vendor_gstin": None,
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
    """Simple preprocessing for printed bills — upscale + grayscale + Otsu threshold."""
    arr  = cv2.cvtColor(np.array(img), cv2.COLOR_RGB2BGR)
    gray = cv2.cvtColor(arr, cv2.COLOR_BGR2GRAY)

    # Upscale 2x for better character recognition
    h, w = gray.shape
    gray = cv2.resize(gray, (w * 2, h * 2), interpolation=cv2.INTER_CUBIC)

    # Simple Otsu threshold — best for clean printed bills
    _, thresh = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    return thresh


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
                "status":       "ready" if llava_ready else "model_not_pulled",
                "ollama":       "running",
                "model":        OLLAMA_MODEL,
                "vision_model": VISION_MODEL,
                "llava_ready":  llava_ready,
                "models":       models,
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


async def extract_bill_qwen_vl(image_b64: str) -> dict:
    """Send bill image directly to Qwen2.5-VL for structured extraction (no Tesseract)."""
    # Strip the {ocr_text} section — vision model sees the image directly
    vision_prompt = re.sub(
        r"\n\nOCR TEXT:\n\{ocr_text\}$", "", BILL_OCR_PROMPT
    ) + "\n\nAnalyze the bill image above and extract all data per the rules above."

    payload = {
        "model":  QWEN_VL_MODEL,
        "prompt": vision_prompt,
        "images": [image_b64],
        "stream": False,
    }
    try:
        async with httpx.AsyncClient(timeout=300) as client:
            r = await client.post(f"{OLLAMA_URL}/api/generate", json=payload)
            r.raise_for_status()
            raw_text = r.json().get("response", "")
    except httpx.ConnectError:
        raise HTTPException(503, detail=(
            f"Cannot connect to Ollama at {OLLAMA_URL}. Is Ollama running?"
        ))
    except httpx.TimeoutException:
        raise HTTPException(504, detail="Qwen2.5-VL inference timed out (>300s)")
    except Exception as e:
        raise HTTPException(502, detail=f"Ollama error: {e}")

    raw = raw_text.strip()
    raw = re.sub(r"^```(?:json)?\s*", "", raw, flags=re.MULTILINE)
    raw = re.sub(r"\s*```$",          "", raw, flags=re.MULTILINE)
    raw = raw.strip()

    match = re.search(r"\{.*\}", raw, re.DOTALL)
    if not match:
        raise ValueError(f"No JSON in Qwen2.5-VL response: {raw[:200]}")

    parsed = json.loads(match.group())
    for k, v in BILL_DEFAULTS.items():
        parsed.setdefault(k, v)
    if not isinstance(parsed.get("items"), list):
        parsed["items"] = []
    return parsed


@app.post("/extract-bill-ocr")
async def extract_bill_ocr(
    file:         Optional[UploadFile] = File(None),
    base64_image: Optional[str]        = Form(None),
):
    """
    Extract line items from a vendor/supplier bill.
    Pipeline (VISION_MODEL=tesseract): image → preprocess → Tesseract → Qwen text → JSON.
    Pipeline (VISION_MODEL=qwen2.5-vl): image → Qwen2.5-VL vision → JSON (no Tesseract).
    Accepts either:
      - multipart file upload (field name: 'file')
      - base64-encoded image string (field name: 'base64_image')
    """
    # ── 1. Load image bytes ──────────────────────────────────────
    data = await load_image(file, base64_image)

    # ── 2a. Qwen2.5-VL path — skip Tesseract entirely ───────────
    if VISION_MODEL == "qwen2.5-vl":
        print(f"[extract-bill-ocr] Using Qwen2.5-VL vision model ({QWEN_VL_MODEL})")
        try:
            b64 = image_to_base64(data)
        except Exception as e:
            raise HTTPException(400, detail=f"Cannot decode image: {e}")
        try:
            parsed = await extract_bill_qwen_vl(b64)
        except HTTPException:
            raise
        except (json.JSONDecodeError, ValueError) as e:
            return JSONResponse(status_code=200, content={
                "success": False,
                **BILL_DEFAULTS,
                "_parse_error": str(e),
            })
        return {"success": True, "data": parsed, "raw_ocr": None}

    # ── 2b. Tesseract path — preprocess + OCR ───────────────────
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
            processed, lang="eng", config="--psm 6 --oem 3"
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
