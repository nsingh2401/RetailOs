#!/usr/bin/env python3
"""
Auto-labeling script for BillFlow YOLOv8 training images.
Uses pretrained YOLOv8n (COCO) to generate initial bounding-box labels.

Install:
  pip install ultralytics opencv-python pillow tqdm

Usage:
  python scripts/training/auto_label.py --all
  python scripts/training/auto_label.py --industry=GROCERY --conf=0.3
  python scripts/training/auto_label.py --all --review
"""

import argparse
import json
import os
import sys
from pathlib import Path

from tqdm import tqdm

try:
    from ultralytics import YOLO
except ImportError:
    print("ERROR: ultralytics not installed. Run: pip install ultralytics")
    sys.exit(1)

try:
    from PIL import Image
except ImportError:
    print("ERROR: Pillow not installed. Run: pip install pillow")
    sys.exit(1)

# ── Config ─────────────────────────────────────────────────────

UPLOAD_DIR = os.environ.get("UPLOAD_DIR", os.path.join(os.getcwd(), "uploads"))

# COCO class name → BillFlow label
COCO_TO_BILLFLOW: dict[str, str] = {
    # Grocery / food
    "bottle":        "grocery_product",
    "cup":           "grocery_product",
    "bowl":          "grocery_product",
    "fork":          "grocery_product",
    "knife":         "grocery_product",
    "spoon":         "grocery_product",
    "banana":        "grocery_product",
    "apple":         "grocery_product",
    "sandwich":      "grocery_product",
    "orange":        "grocery_product",
    "broccoli":      "grocery_product",
    "carrot":        "grocery_product",
    "hot dog":       "grocery_product",
    "pizza":         "grocery_product",
    "donut":         "grocery_product",
    "cake":          "grocery_product",
    # Electronics
    "cell phone":    "smartphone",
    "laptop":        "laptop",
    "keyboard":      "electronics",
    "mouse":         "electronics",
    "remote":        "electronics",
    "tv":            "electronics",
    "microwave":     "electronics",
    "oven":          "electronics",
    "toaster":       "electronics",
    "refrigerator":  "electronics",
    "clock":         "electronics",
    # Stationery
    "scissors":      "stationery",
    "book":          "stationery",
    # Bags
    "backpack":      "bags",
    "handbag":       "bags",
    "suitcase":      "bags",
    # Furniture
    "chair":         "furniture",
    "couch":         "furniture",
    "bed":           "furniture",
    "dining table":  "furniture",
    "toilet":        "furniture",
    # Toys / sports
    "sports ball":   "toys",
    "kite":          "toys",
    "baseball bat":  "toys",
    "baseball glove":"toys",
    "tennis racket": "toys",
    "skateboard":    "toys",
    "frisbee":       "toys",
    "snowboard":     "toys",
    "skis":          "toys",
    "surfboard":     "toys",
    # Apparel
    "umbrella":      "apparel",
    "tie":           "apparel",
    # Hardware / tools
    "scissors":      "hand_tool",
    # Vehicles (skip — not BillFlow products)
    # Person (skip)
}

# All BillFlow classes in order — determines class_id in YOLO labels
BILLFLOW_CLASSES = [
    "grocery_product", "packaged_food", "beverage", "snack",
    "gold_jewelry", "silver_jewelry", "diamond_jewelry",
    "hand_tool", "power_tool", "pipe_fitting",
    "led_bulb", "electrical_switch", "circuit_breaker", "ceiling_fan",
    "kurta", "saree", "jeans", "tshirt", "apparel",
    "shoes", "sandals", "sports_shoes",
    "smartphone", "laptop", "earbuds", "smartwatch", "electronics",
    "bread", "cake", "biscuit_pack", "namkeen",
    "toy_car", "doll", "puzzle", "building_blocks", "toys",
    "barcode", "price_tag", "expiry_date", "product_label",
    "stationery", "bags", "furniture",
]

CLASS_TO_ID = {cls: i for i, cls in enumerate(BILLFLOW_CLASSES)}

SKIP_COCO = {"person", "bicycle", "car", "motorcycle", "airplane", "bus",
             "train", "truck", "boat", "traffic light", "fire hydrant",
             "stop sign", "parking meter", "bench", "bird", "cat", "dog",
             "horse", "sheep", "cow", "elephant", "bear", "zebra", "giraffe"}

IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".webp", ".bmp"}


# ── Helpers ────────────────────────────────────────────────────

def map_coco(coco_name: str) -> str | None:
    """Map COCO class name to BillFlow label. None = skip."""
    if coco_name in SKIP_COCO:
        return None
    if coco_name in COCO_TO_BILLFLOW:
        return COCO_TO_BILLFLOW[coco_name]
    # Unknown COCO class — use as-is if it fits, else keep original
    if coco_name in CLASS_TO_ID:
        return coco_name
    return coco_name  # keep original, will land in classes.txt as unknown


def collect_images(industries: list[str]) -> list[Path]:
    training_root = Path(UPLOAD_DIR) / "training"
    images: list[Path] = []
    for industry in industries:
        ind_dir = training_root / industry.lower()
        if not ind_dir.exists():
            print(f"  WARNING: {ind_dir} not found — skipping")
            continue
        for p in ind_dir.rglob("*"):
            if p.suffix.lower() in IMAGE_EXTS:
                images.append(p)
    return images


def write_yolo_label(label_path: Path, boxes: list[tuple[int, float, float, float, float]]) -> None:
    lines = [f"{cls_id} {cx:.6f} {cy:.6f} {w:.6f} {h:.6f}" for cls_id, cx, cy, w, h in boxes]
    label_path.write_text("\n".join(lines))


def make_ls_task(image_path: Path, boxes: list[tuple[int, float, float, float, float]],
                 base_url: str = "http://localhost:8080/data/local-files/?d=") -> dict:
    """Generate a Label Studio JSON task with pre-annotations."""
    rel = image_path.relative_to(Path(UPLOAD_DIR) / "training")
    image_url = base_url + str(rel).replace("\\", "/")

    results = []
    for cls_id, cx, cy, w, h in boxes:
        cls_name = BILLFLOW_CLASSES[cls_id] if cls_id < len(BILLFLOW_CLASSES) else f"class_{cls_id}"
        # Label Studio uses top-left x/y as %, width/height as %
        x_pct = (cx - w / 2) * 100
        y_pct = (cy - h / 2) * 100
        w_pct = w * 100
        h_pct = h * 100
        results.append({
            "type": "rectanglelabels",
            "from_name": "label",
            "to_name": "image",
            "original_width": 640,
            "original_height": 640,
            "value": {
                "x": round(x_pct, 2),
                "y": round(y_pct, 2),
                "width": round(w_pct, 2),
                "height": round(h_pct, 2),
                "rotation": 0,
                "rectanglelabels": [cls_name],
            },
        })

    return {
        "data": {"image": image_url},
        "annotations": [{"result": results}] if results else [],
    }


# ── Main ───────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(
        description="Auto-label BillFlow training images using pretrained YOLOv8n"
    )
    parser.add_argument("--industry", help="Single industry folder name (e.g. GROCERY)")
    parser.add_argument("--all", action="store_true", help="Process all industries")
    parser.add_argument("--conf", type=float, default=0.25, help="Confidence threshold (default 0.25)")
    parser.add_argument("--review", action="store_true", help="Also generate Label Studio import JSON")
    args = parser.parse_args()

    if not args.industry and not args.all:
        parser.error("Specify --industry=NAME or --all")

    training_root = Path(UPLOAD_DIR) / "training"

    if args.all:
        industries = [d.name for d in training_root.iterdir() if d.is_dir()]
    else:
        industries = [args.industry]

    print(f"UPLOAD_DIR:   {UPLOAD_DIR}")
    print(f"Industries:   {industries}")
    print(f"Conf thresh:  {args.conf}")
    print(f"Review JSON:  {args.review}\n")

    # Load pretrained model (downloads yolov8n.pt on first run ~6MB)
    print("Loading YOLOv8n pretrained weights...")
    model = YOLO("yolov8n.pt")
    coco_names: dict[int, str] = model.names  # {0: 'person', 1: 'bicycle', ...}
    print(f"Model loaded. COCO classes: {len(coco_names)}\n")

    # Collect images
    images = collect_images(industries)
    print(f"Found {len(images)} images\n")

    # Track stats
    processed        = 0
    labeled          = 0
    skipped_no_det   = 0
    skipped_existing = 0
    extra_classes: set[str] = set()
    ls_tasks: list[dict] = []

    for img_path in tqdm(images, desc="Auto-labeling", unit="img"):
        label_path = img_path.with_suffix(".txt")

        # Skip if manual label already exists
        if label_path.exists():
            skipped_existing += 1
            continue

        processed += 1

        # Run inference
        try:
            results = model(str(img_path), conf=args.conf, verbose=False)
        except Exception as e:
            tqdm.write(f"  ERROR {img_path.name}: {e}")
            continue

        boxes: list[tuple[int, float, float, float, float]] = []

        for result in results:
            img_w = result.orig_shape[1]
            img_h = result.orig_shape[0]

            for box in result.boxes:
                coco_id   = int(box.cls.item())
                coco_name = coco_names.get(coco_id, f"class_{coco_id}")

                bf_label = map_coco(coco_name)
                if bf_label is None:
                    continue  # skip vehicles, people, etc.

                # Resolve class_id in BillFlow class list
                if bf_label in CLASS_TO_ID:
                    cls_id = CLASS_TO_ID[bf_label]
                else:
                    # Unknown — append to dynamic list
                    extra_classes.add(bf_label)
                    cls_id = len(BILLFLOW_CLASSES) + sorted(extra_classes).index(bf_label)

                # Convert xyxy → normalized xywh
                x1, y1, x2, y2 = box.xyxy[0].tolist()
                cx = ((x1 + x2) / 2) / img_w
                cy = ((y1 + y2) / 2) / img_h
                w  = (x2 - x1) / img_w
                h  = (y2 - y1) / img_h
                boxes.append((cls_id, cx, cy, w, h))

        if not boxes:
            skipped_no_det += 1
            # Write empty label file so we know this image was processed
            label_path.write_text("")
            continue

        write_yolo_label(label_path, boxes)
        labeled += 1

        if args.review:
            ls_tasks.append(make_ls_task(img_path, boxes))

    # Write classes.txt
    all_classes = BILLFLOW_CLASSES + sorted(extra_classes)
    classes_path = training_root / "classes.txt"
    classes_path.write_text("\n".join(all_classes))

    # Write Label Studio import JSON
    if args.review and ls_tasks:
        ls_path = training_root / "auto_labels_import.json"
        ls_path.write_text(json.dumps(ls_tasks, indent=2))
        print(f"\nLabel Studio import: {ls_path}  ({len(ls_tasks)} tasks)")
        print("  In Label Studio: Project → Import → upload auto_labels_import.json")

    print(f"""
Summary
-------
Images found:        {len(images)}
Already labeled:     {skipped_existing}  (skipped — manual labels preserved)
Processed:           {processed}
  With detections:   {labeled}
  No detections:     {skipped_no_det}  (empty .txt written)
Extra COCO classes:  {sorted(extra_classes) or 'none'}
classes.txt:         {classes_path}
""")


if __name__ == "__main__":
    main()
